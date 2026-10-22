from datetime import date

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from .models import Goal, Habit, HabitCheck

User = get_user_model()


class GoalsBaseTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user1 = User.objects.create_user(
            username="user1", email="user1@example.com", password="pass123"
        )
        self.user2 = User.objects.create_user(
            username="user2", email="user2@example.com", password="pass123"
        )


class GoalApiTest(GoalsBaseTest):
    def setUp(self):
        super().setUp()
        self.goal1 = Goal.objects.create(
            user=self.user1, title="Run 10 km", start_date=date(2026, 10, 1)
        )
        self.goal2 = Goal.objects.create(
            user=self.user2, title="Read a book", start_date=date(2026, 10, 1)
        )

    def test_list_requires_auth(self):
        response = self.client.get(reverse("goal-list"))
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_user_isolation(self):
        self.client.force_authenticate(user=self.user1)
        response = self.client.get(reverse("goal-list"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        titles = [g["title"] for g in response.data["results"]]
        self.assertEqual(titles, ["Run 10 km"])

    def test_create_goal(self):
        self.client.force_authenticate(user=self.user1)
        data = {
            "title": "Learn Django",
            "start_date": "2026-10-20",
            "end_date": "2026-12-20",
            "status": "in-progress",
            "progress": 30,
        }
        response = self.client.post(reverse("goal-list"), data, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        goal = Goal.objects.get(id=response.data["id"])
        self.assertEqual(goal.user, self.user1)
        self.assertEqual(goal.progress, 30)

    def test_progress_above_100_is_rejected(self):
        self.client.force_authenticate(user=self.user1)
        data = {"title": "Bad", "start_date": "2026-10-20", "progress": 150}
        response = self.client.post(reverse("goal-list"), data, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("progress", response.data)

    def test_end_date_before_start_date_is_rejected(self):
        self.client.force_authenticate(user=self.user1)
        data = {
            "title": "Bad dates",
            "start_date": "2026-10-20",
            "end_date": "2026-10-01",
        }
        response = self.client.post(reverse("goal-list"), data, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("end_date", response.data)

    def test_cannot_access_other_user_goal(self):
        self.client.force_authenticate(user=self.user1)
        response = self.client.get(reverse("goal-detail", args=[self.goal2.id]))
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_partial_update_and_delete(self):
        self.client.force_authenticate(user=self.user1)
        url = reverse("goal-detail", args=[self.goal1.id])
        response = self.client.patch(
            url, {"progress": 100, "status": "completed"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "completed")
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

    def test_filter_by_status(self):
        self.client.force_authenticate(user=self.user1)
        Goal.objects.create(
            user=self.user1,
            title="Done goal",
            start_date=date(2026, 9, 1),
            status="completed",
        )
        response = self.client.get(reverse("goal-list"), {"status": "completed"})
        titles = [g["title"] for g in response.data["results"]]
        self.assertEqual(titles, ["Done goal"])


class HabitApiTest(GoalsBaseTest):
    def setUp(self):
        super().setUp()
        self.habit1 = Habit.objects.create(user=self.user1, name="Meditate")
        self.habit2 = Habit.objects.create(user=self.user2, name="Walk")

    def test_user_isolation(self):
        self.client.force_authenticate(user=self.user1)
        response = self.client.get(reverse("habit-list"))
        names = [h["name"] for h in response.data["results"]]
        self.assertEqual(names, ["Meditate"])

    def test_create_habit(self):
        self.client.force_authenticate(user=self.user1)
        response = self.client.post(
            reverse("habit-list"),
            {"name": "Drink water", "frequency": "daily"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertFalse(response.data["completed_today"])

    def test_invalid_frequency(self):
        self.client.force_authenticate(user=self.user1)
        response = self.client.post(
            reverse("habit-list"),
            {"name": "X", "frequency": "yearly"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("frequency", response.data)

    def test_check_today_then_uncheck(self):
        self.client.force_authenticate(user=self.user1)
        url = reverse("habit-check", args=[self.habit1.id])

        response = self.client.post(url, {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data["completed"])

        detail = self.client.get(reverse("habit-detail", args=[self.habit1.id]))
        self.assertTrue(detail.data["completed_today"])

        response = self.client.post(url, {"completed": False}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data["completed"])
        self.assertEqual(HabitCheck.objects.filter(habit=self.habit1).count(), 1)

    def test_check_invalid_date(self):
        self.client.force_authenticate(user=self.user1)
        url = reverse("habit-check", args=[self.habit1.id])
        response = self.client.post(url, {"date": "not-a-date"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cannot_check_other_user_habit(self):
        self.client.force_authenticate(user=self.user1)
        url = reverse("habit-check", args=[self.habit2.id])
        response = self.client.post(url, {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_checks_history(self):
        self.client.force_authenticate(user=self.user1)
        HabitCheck.objects.create(habit=self.habit1, date=date(2026, 10, 18))
        HabitCheck.objects.create(habit=self.habit1, date=date(2026, 10, 19))
        response = self.client.get(reverse("habit-checks", args=[self.habit1.id]))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)
