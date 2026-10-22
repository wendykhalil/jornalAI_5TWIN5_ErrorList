"""
Tests of the AI layer. Ollama is always mocked: no LLM needs to be running.
"""

import json
from datetime import date, timedelta
from unittest.mock import MagicMock, patch

import requests
from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.journal.models import JournalEntry

from . import ai
from .models import Goal, Habit, HabitCheck

User = get_user_model()
POST = "apps.goals.ai.requests.post"


def fake_ollama(payload):
    response = MagicMock()
    response.raise_for_status.return_value = None
    response.json.return_value = {"response": json.dumps(payload)}
    return response


def sent_prompt(mock_post):
    return mock_post.call_args.kwargs["json"]["prompt"]


class AiBaseTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="salma", email="salma@example.com", password="pass123"
        )
        self.other = User.objects.create_user(
            username="other", email="other@example.com", password="pass123"
        )
        self.today = date.today()


class HelpersTest(AiBaseTest):
    def test_habit_stats_streak_and_rate(self):
        habit = Habit.objects.create(user=self.user, name="Méditer")
        today = date(2026, 10, 20)
        for offset in (0, 1, 2):
            HabitCheck.objects.create(
                habit=habit, date=today - timedelta(days=offset)
            )

        stats = ai.habit_stats(habit, today=today)
        self.assertEqual(stats["streak"], 3)
        self.assertEqual(stats["rate"], 43)
        self.assertTrue(stats["done_today"])

    def test_streak_survives_when_today_is_not_done_yet(self):
        habit = Habit.objects.create(user=self.user, name="Lire")
        today = date(2026, 10, 20)
        HabitCheck.objects.create(habit=habit, date=today - timedelta(days=1))

        stats = ai.habit_stats(habit, today=today)
        self.assertEqual(stats["streak"], 1)
        self.assertFalse(stats["done_today"])

    def test_rules_with_no_data(self):
        data = ai.collect_user_data(self.user)
        insights = ai.rule_based_insights(data)
        self.assertEqual(len(insights), 1)

    def test_rules_detect_overdue_goal(self):
        Goal.objects.create(
            user=self.user,
            title="Économiser",
            start_date=self.today - timedelta(days=60),
            end_date=self.today - timedelta(days=5),
            progress=20,
        )
        insights = ai.rule_based_insights(ai.collect_user_data(self.user))
        self.assertTrue(any("Économiser" in s and "dépassé" in s for s in insights))

    def test_retrieve_prefers_matching_documents(self):
        Goal.objects.create(
            user=self.user, title="Courir 10 km", start_date=self.today
        )
        Goal.objects.create(
            user=self.user, title="Lire douze livres", start_date=self.today
        )
        docs = ai.build_documents(self.user)
        selected = ai.retrieve(docs, "Où j'en suis pour courir ?", k=1)
        self.assertEqual(selected[0]["title"], "Courir 10 km")

    def test_retrieve_falls_back_to_goals_and_habits(self):
        Goal.objects.create(
            user=self.user, title="Courir 10 km", start_date=self.today
        )
        docs = ai.build_documents(self.user)
        selected = ai.retrieve(docs, "Comment je vais ?", k=3)
        self.assertEqual(len(selected), 1)

    def test_documents_include_journal_but_not_drafts(self):
        JournalEntry.objects.create(
            user=self.user,
            title="Séance de sport",
            content="J'ai couru ce matin.",
            date=self.today,
        )
        JournalEntry.objects.create(
            user=self.user,
            title="Brouillon secret",
            content="Pas fini.",
            date=self.today,
            draft=True,
        )
        titles = [d["title"] for d in ai.build_documents(self.user)]
        self.assertIn("Séance de sport", titles)
        self.assertNotIn("Brouillon secret", titles)


class InsightsEndpointTest(AiBaseTest):
    def setUp(self):
        super().setUp()
        self.client.force_authenticate(user=self.user)
        self.url = reverse("goal-insights")
        Goal.objects.create(
            user=self.user, title="Courir 10 km", start_date=self.today
        )

    def test_requires_auth(self):
        response = APIClient().get(self.url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    @patch(POST)
    def test_returns_llm_insights(self, mock_post):
        mock_post.return_value = fake_ollama({"insights": ["Courez demain.", " "]})
        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["source"], "ai")
        self.assertEqual(response.data["insights"], ["Courez demain."])
        self.assertIn("Courir 10 km", sent_prompt(mock_post))

    @patch(POST)
    def test_falls_back_to_rules_when_ollama_is_down(self, mock_post):
        mock_post.side_effect = requests.exceptions.ConnectionError()
        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["source"], "rules")
        self.assertIn("warning", response.data)
        self.assertTrue(response.data["insights"])

    @patch(POST)
    def test_falls_back_on_invalid_llm_answer(self, mock_post):
        mock_post.return_value = fake_ollama({"unexpected": True})
        response = self.client.get(self.url)
        self.assertEqual(response.data["source"], "rules")

    @patch(POST)
    def test_mode_rules_never_calls_the_llm(self, mock_post):
        response = self.client.get(self.url, {"mode": "rules"})
        self.assertEqual(response.data["source"], "rules")
        mock_post.assert_not_called()

    @patch(POST)
    def test_other_users_data_is_not_sent_to_the_llm(self, mock_post):
        Goal.objects.create(
            user=self.other, title="Objectif confidentiel", start_date=self.today
        )
        mock_post.return_value = fake_ollama({"insights": ["ok"]})
        self.client.get(self.url)
        self.assertNotIn("Objectif confidentiel", sent_prompt(mock_post))


class CoachEndpointTest(AiBaseTest):
    def setUp(self):
        super().setUp()
        self.client.force_authenticate(user=self.user)
        self.url = reverse("goal-coach")
        self.goal = Goal.objects.create(
            user=self.user,
            title="Courir 10 km",
            start_date=self.today,
            progress=40,
        )

    def test_requires_auth(self):
        response = APIClient().post(self.url, {"question": "Salut"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_empty_question_is_rejected(self):
        response = self.client.post(self.url, {"question": "  "}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_too_long_question_is_rejected(self):
        response = self.client.post(
            self.url, {"question": "a" * 1001}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    @patch(POST)
    def test_answer_is_grounded_in_retrieved_sources(self, mock_post):
        mock_post.return_value = fake_ollama({"answer": "Vous êtes à 40%."})
        response = self.client.post(
            self.url, {"question": "Où j'en suis pour courir ?"}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["answer"], "Vous êtes à 40%.")
        self.assertEqual(response.data["sources"][0]["id"], str(self.goal.id))
        self.assertIn("progression 40%", sent_prompt(mock_post))

    @patch(POST)
    def test_journal_entries_are_part_of_the_context(self, mock_post):
        JournalEntry.objects.create(
            user=self.user,
            title="Footing du matin",
            content="Fatigué mais fier de ma course.",
            date=self.today,
        )
        mock_post.return_value = fake_ollama({"answer": "Bravo."})
        response = self.client.post(
            self.url, {"question": "Parle-moi de mon footing"}, format="json"
        )

        types = [s["type"] for s in response.data["sources"]]
        self.assertIn("journal", types)
        self.assertIn("Fatigué mais fier", sent_prompt(mock_post))

    @patch(POST)
    def test_other_users_data_is_never_retrieved(self, mock_post):
        Goal.objects.create(
            user=self.other, title="Courir un marathon secret", start_date=self.today
        )
        JournalEntry.objects.create(
            user=self.other,
            title="Journal privé",
            content="Contenu privé sur la course.",
            date=self.today,
        )
        mock_post.return_value = fake_ollama({"answer": "ok"})
        self.client.post(self.url, {"question": "courir"}, format="json")

        prompt = sent_prompt(mock_post)
        self.assertNotIn("marathon secret", prompt)
        self.assertNotIn("Contenu privé", prompt)

    @patch(POST)
    def test_history_is_forwarded(self, mock_post):
        mock_post.return_value = fake_ollama({"answer": "ok"})
        history = [
            {"role": "user", "content": "Bonjour"},
            {"role": "assistant", "content": "Bonjour, comment puis-je aider ?"},
            "not a dict",
        ]
        self.client.post(
            self.url, {"question": "courir", "history": history}, format="json"
        )
        self.assertIn("Bonjour, comment puis-je aider", sent_prompt(mock_post))

    @patch(POST)
    def test_ollama_down_returns_503(self, mock_post):
        mock_post.side_effect = requests.exceptions.ConnectionError()
        response = self.client.post(
            self.url, {"question": "courir"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)

    @patch(POST)
    def test_timeout_returns_504(self, mock_post):
        mock_post.side_effect = requests.exceptions.Timeout()
        response = self.client.post(
            self.url, {"question": "courir"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_504_GATEWAY_TIMEOUT)

    @patch(POST)
    def test_invalid_llm_answer_returns_502(self, mock_post):
        mock_post.return_value = fake_ollama({"nope": 1})
        response = self.client.post(
            self.url, {"question": "courir"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_502_BAD_GATEWAY)

    def test_no_data_at_all(self):
        Goal.objects.all().delete()
        response = self.client.post(
            self.url, {"question": "Comment je vais ?"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["sources"], [])
