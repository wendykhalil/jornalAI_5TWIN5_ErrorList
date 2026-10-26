import json
from datetime import date, timedelta
from unittest.mock import MagicMock, patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from . import ai
from .models import Goal, GoalProgress, GoalStep

User = get_user_model()
POST = "apps.goals.ai.requests.post"


def fake_ollama(payload):
    response = MagicMock()
    response.raise_for_status.return_value = None
    response.json.return_value = {"response": json.dumps(payload)}
    return response


class GoalStepsApiTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="steps-user", email="steps@example.com", password="test-pass"
        )
        self.other = User.objects.create_user(
            username="steps-other", email="other@example.com", password="test-pass"
        )
        self.client.force_authenticate(user=self.user)
        self.goal = Goal.objects.create(
            user=self.user, title="Courir 10 km", start_date=date.today()
        )

    def test_create_goal_records_initial_history_and_title_update_does_not_add_point(self):
        response = self.client.post(
            reverse("goal-list"),
            {"title": "Nouvel objectif", "start_date": date.today().isoformat()},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        created_goal = Goal.objects.get(id=response.data["id"])
        self.assertEqual(GoalProgress.objects.filter(goal=created_goal).count(), 1)
        response = self.client.patch(
            reverse("goal-detail", args=[self.goal.id]),
            {"title": "Courir 12 km"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(GoalProgress.objects.filter(goal=self.goal).count(), 1)
        self.client.patch(
            reverse("goal-detail", args=[self.goal.id]),
            {"progress": 25},
            format="json",
        )
        self.assertEqual(GoalProgress.objects.filter(goal=self.goal).count(), 2)

    def test_history_is_created_when_empty_and_isolated(self):
        response = self.client.get(reverse("goal-history", args=[self.goal.id]))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        other_goal = Goal.objects.create(
            user=self.other, title="Secret", start_date=date.today()
        )
        response = self.client.get(reverse("goal-history", args=[other_goal.id]))
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_create_steps_simple_and_in_batch_with_limit(self):
        response = self.client.post(
            reverse("goal-steps", args=[self.goal.id]),
            {"title": "Commencer à courir"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        response = self.client.post(
            reverse("goal-steps", args=[self.goal.id]),
            {"steps": [{"title": "Courir 5 km"}, {"title": "Courir 10 km"}]},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(GoalStep.objects.filter(goal=self.goal).count(), 3)
        response = self.client.post(
            reverse("goal-steps", args=[self.goal.id]),
            {"steps": [{"title": str(index)} for index in range(48)]},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_steps_sync_progress_and_status_on_update_and_delete(self):
        steps = [
            GoalStep.objects.create(goal=self.goal, title=str(index), order=index)
            for index in range(4)
        ]
        for step in steps[:2]:
            response = self.client.patch(
                reverse("goal-step-detail", args=[step.id]),
                {"done": True},
                format="json",
            )
            self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.goal.refresh_from_db()
        self.assertEqual(self.goal.progress, 50)
        self.assertEqual(self.goal.status, "in-progress")
        for step in steps[2:]:
            self.client.patch(
                reverse("goal-step-detail", args=[step.id]),
                {"done": True},
                format="json",
            )
        self.goal.refresh_from_db()
        self.assertEqual(self.goal.progress, 100)
        self.assertEqual(self.goal.status, "completed")
        self.client.patch(
            reverse("goal-step-detail", args=[steps[0].id]),
            {"done": False},
            format="json",
        )
        self.goal.refresh_from_db()
        self.assertEqual(self.goal.progress, 75)
        self.client.delete(reverse("goal-step-detail", args=[steps[1].id]))
        self.goal.refresh_from_db()
        self.assertEqual(self.goal.progress, 67)

    def test_step_isolated(self):
        other_goal = Goal.objects.create(
            user=self.other, title="Secret", start_date=date.today()
        )
        step = GoalStep.objects.create(goal=other_goal, title="Secret step")
        response = self.client.get(reverse("goal-step-detail", args=[step.id]))
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    @patch(POST)
    def test_breakdown_is_not_saved_and_dates_are_capped_and_duplicates_removed(
        self, mock_post
    ):
        self.goal.end_date = date.today() + timedelta(days=3)
        self.goal.save(update_fields=["end_date"])
        mock_post.return_value = fake_ollama(
            {
                "steps": [
                    {"title": "Planifier", "due_in_days": 1},
                    {"title": "planifier", "due_in_days": 2},
                    {"title": "Courir", "due_in_days": 30},
                ]
            }
        )
        response = self.client.post(
            reverse("goal-breakdown", args=[self.goal.id]), {}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["steps"]), 2)
        self.assertEqual(
            response.data["steps"][1]["due_date"], self.goal.end_date.isoformat()
        )
        self.assertEqual(GoalStep.objects.filter(goal=self.goal).count(), 0)

    @patch(POST)
    def test_breakdown_invalid_response_returns_502(self, mock_post):
        mock_post.return_value = fake_ollama({"steps": [{"title": "", "due_in_days": 1}]})
        response = self.client.post(
            reverse("goal-breakdown", args=[self.goal.id]), {}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_502_BAD_GATEWAY)

    @patch(POST)
    def test_breakdown_ollama_down_returns_503(self, mock_post):
        import requests

        mock_post.side_effect = requests.exceptions.ConnectionError()
        response = self.client.post(
            reverse("goal-breakdown", args=[self.goal.id]), {}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)

    def test_collect_user_data_exposes_steps(self):
        first = GoalStep.objects.create(goal=self.goal, title="Première", order=0)
        GoalStep.objects.create(goal=self.goal, title="Deuxième", order=1, done=True)
        data = ai.collect_user_data(self.user)
        self.assertEqual(data["goals"][0]["steps_total"], 2)
        self.assertEqual(data["goals"][0]["steps_done"], 1)
        self.assertEqual(data["goals"][0]["next_step"], first.title)
