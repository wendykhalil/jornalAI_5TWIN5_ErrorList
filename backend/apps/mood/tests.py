from datetime import timedelta
import json
from unittest.mock import patch

import requests
from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from .models import MoodCheck

User = get_user_model()


class MoodCheckAPITest(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="mooduser",
            email="mood@example.com",
            password="testpass123",
        )
        self.other = User.objects.create_user(
            username="otheruser",
            email="other@example.com",
            password="testpass123",
        )
        self.client.force_authenticate(self.user)
        self.list_url = reverse("mood-list")

    def _create(self, user=None, **overrides):
        data = {
            "user": user or self.user,
            "mood": "Calme",
            "intensity": 3,
            "note": "Une note",
            "date": timezone.now() - timedelta(hours=1),
        }
        data.update(overrides)
        return MoodCheck.objects.create(**data)

    def test_authentication_required(self):
        self.client.force_authenticate(user=None)
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_jwt_can_create_and_list_own_mood(self):
        self.client.force_authenticate(user=None)
        access = str(RefreshToken.for_user(self.user).access_token)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        response = self.client.post(self.list_url, {
            "mood": "Heureux",
            "intensity": 4,
            "note": "Belle journée",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["mood"], "Heureux")
        self.assertNotIn("user", response.data)
        created = MoodCheck.objects.get(pk=response.data["id"])
        self.assertEqual(created.user, self.user)

        listing = self.client.get(self.list_url)
        self.assertEqual(listing.status_code, status.HTTP_200_OK)
        self.assertEqual(listing.data["count"], 1)

    def test_create_ignores_submitted_user(self):
        response = self.client.post(self.list_url, {
            "mood": "Neutre",
            "intensity": 2,
            "user": self.other.pk,
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        created = MoodCheck.objects.get(pk=response.data["id"])
        self.assertEqual(created.user, self.user)

    def test_user_cannot_access_another_users_mood(self):
        private = self._create(user=self.other, mood="Triste")
        detail = reverse("mood-detail", args=[private.pk])

        self.assertEqual(self.client.get(detail).status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(
            self.client.patch(detail, {"note": "intrusion"}, format="json").status_code,
            status.HTTP_404_NOT_FOUND,
        )
        self.assertEqual(self.client.delete(detail).status_code, status.HTTP_404_NOT_FOUND)
        self.assertTrue(MoodCheck.objects.filter(pk=private.pk).exists())

        listing = self.client.get(self.list_url)
        ids = [item["id"] for item in listing.data["results"]]
        self.assertNotIn(str(private.pk), ids)

    def test_update_and_delete_own_mood(self):
        mood = self._create()
        detail = reverse("mood-detail", args=[mood.pk])
        updated = self.client.patch(detail, {
            "mood": "Motivé",
            "intensity": 5,
            "note": "Mieux",
            "user": self.other.pk,
        }, format="json")
        self.assertEqual(updated.status_code, status.HTTP_200_OK)
        mood.refresh_from_db()
        self.assertEqual(mood.mood, "Motivé")
        self.assertEqual(mood.intensity, 5)
        self.assertEqual(mood.user, self.user)

        deleted = self.client.delete(detail)
        self.assertEqual(deleted.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(MoodCheck.objects.filter(pk=mood.pk).exists())

    def test_invalid_intensity_and_mood_are_rejected(self):
        too_low = self.client.post(self.list_url, {
            "mood": "Calme",
            "intensity": 0,
        }, format="json")
        too_high = self.client.post(self.list_url, {
            "mood": "Calme",
            "intensity": 6,
        }, format="json")
        unknown = self.client.post(self.list_url, {
            "mood": "Inconnue",
            "intensity": 3,
        }, format="json")
        self.assertEqual(too_low.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(too_high.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(unknown.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(MoodCheck.objects.count(), 0)

    def test_future_date_is_rejected(self):
        response = self.client.post(self.list_url, {
            "mood": "Calme",
            "intensity": 3,
            "date": (timezone.now() + timedelta(days=1)).isoformat(),
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_filters_by_period_and_mood(self):
        now = timezone.now()
        today = timezone.localdate()
        self._create(mood="Calme", date=now - timedelta(minutes=30))
        self._create(mood="Triste", date=now - timedelta(minutes=10))
        self._create(mood="Calme", date=now - timedelta(days=40))

        today_response = self.client.get(self.list_url, {"period": "today", "mood": "Calme"})
        self.assertEqual(today_response.data["count"], 1)
        self.assertEqual(today_response.data["results"][0]["mood"], "Calme")

        week = self.client.get(self.list_url, {"period": "week", "mood": "Triste"})
        self.assertEqual(week.data["count"], 1)

        custom = self.client.get(self.list_url, {
            "mood": "Calme",
            "date_from": (today - timedelta(days=50)).isoformat(),
            "date_to": (today - timedelta(days=30)).isoformat(),
        })
        self.assertEqual(custom.data["count"], 1)

    def test_stats_use_only_the_current_user_and_active_filters(self):
        self._create(mood="Heureux", intensity=4, date=timezone.now() - timedelta(hours=2))
        self._create(mood="Calme", intensity=2, date=timezone.now() - timedelta(hours=1))
        self._create(user=self.other, mood="Anxieux", intensity=5)

        response = self.client.get(reverse("mood-stats"), {"period": "week"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 2)
        self.assertEqual(response.data["average_intensity"], 3.0)
        moods = {item["mood"] for item in response.data["distribution"]}
        self.assertEqual(moods, {"Heureux", "Calme"})
        self.assertEqual(len(response.data["intensity_over_time"]), 2)
        self.assertLess(
            response.data["intensity_over_time"][0]["date"],
            response.data["intensity_over_time"][1]["date"],
        )


class MoodSummaryAPITest(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="summaryuser",
            email="summary@example.com",
            password="testpass123",
        )
        self.other = User.objects.create_user(
            username="summaryother",
            email="summary-other@example.com",
            password="testpass123",
        )
        self.client.force_authenticate(self.user)
        self.url = reverse("mood-summary")

    def _create(self, user=None, **overrides):
        data = {
            "user": user or self.user,
            "mood": "Calme",
            "intensity": 3,
            "note": "NOTE-SECRETE-ALPHA",
            "date": timezone.now() - timedelta(hours=1),
        }
        data.update(overrides)
        return MoodCheck.objects.create(**data)

    def _ollama(self, post, text="Deux humeurs ont été enregistrées."):
        post.return_value.raise_for_status.return_value = None
        post.return_value.json.return_value = {
            "response": json.dumps({"summary": text})
        }

    def test_invalid_period_is_rejected(self):
        response = self.client.post(self.url, {"days": 10}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_empty_period_does_not_call_the_model(self):
        with patch("apps.mood.views.requests.post") as post:
            response = self.client.post(self.url, {"days": 7}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["summary_status"], "insufficient_data")
        self.assertIsNone(response.data["summary"])
        self.assertEqual(response.data["statistics"]["count"], 0)
        post.assert_not_called()

    def test_single_entry_does_not_invent_a_trend(self):
        self._create()
        with patch("apps.mood.views.requests.post") as post:
            response = self.client.post(self.url, {"days": 14}, format="json")
        self.assertEqual(response.data["summary_status"], "insufficient_data")
        self.assertFalse(response.data["sufficient_data"])
        self.assertEqual(response.data["statistics"]["count"], 1)
        post.assert_not_called()

    @patch("apps.mood.views.requests.post")
    def test_statistics_ignore_other_users_and_personal_notes(self, post):
        self._create(
            mood="Calme",
            intensity=2,
            note="NOTE-SECRETE-ALPHA",
            date=timezone.now() - timedelta(days=2),
        )
        self._create(
            mood="Heureux",
            intensity=4,
            note="NOTE-SECRETE-BETA",
            date=timezone.now() - timedelta(hours=1),
        )
        self._create(
            user=self.other,
            mood="Anxieux",
            intensity=5,
            note="NOTE-AUTRE-UTILISATEUR",
            date=timezone.now() - timedelta(hours=1),
        )
        self._ollama(post)
        with patch.dict("os.environ", {"OLLAMA_MOOD_MODEL": "phi3:latest"}):
            response = self.client.post(self.url, {
                "days": 7,
                "user": self.other.pk,
                "statistics": {"count": 999},
            }, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        stats = response.data["statistics"]
        self.assertEqual(stats["count"], 2)
        self.assertEqual(stats["average_intensity"], 3.0)
        self.assertEqual(stats["most_frequent"][0]["mood"], "Calme")
        self.assertEqual(stats["variation"]["direction"], "up")
        self.assertEqual(stats["variation"]["delta"], 2.0)
        self.assertEqual(response.data["summary_status"], "generated")
        payload = post.call_args.kwargs["json"]
        self.assertEqual(payload["model"], "phi3:latest")
        self.assertNotEqual(payload["model"], "llama3.2:latest")
        prompt = payload["prompt"]
        self.assertNotIn("NOTE-SECRETE-ALPHA", prompt)
        self.assertNotIn("NOTE-SECRETE-BETA", prompt)
        self.assertNotIn("NOTE-AUTRE-UTILISATEUR", prompt)
        self.assertNotIn("Anxieux", prompt)

    @patch("apps.mood.views.requests.post")
    def test_mood_model_comes_from_its_own_setting(self, post):
        self._create(date=timezone.now() - timedelta(days=1))
        self._create()
        self._ollama(post)
        with patch.dict("os.environ", {
            "OLLAMA_MOOD_MODEL": "phi3:latest",
            "OLLAMA_MODEL": "llama3.2:latest",
        }):
            response = self.client.post(self.url, {"days": 7}, format="json")
        self.assertEqual(response.data["summary_status"], "generated")
        self.assertEqual(post.call_args.kwargs["json"]["model"], "phi3:latest")

    @patch("apps.mood.views.requests.post")
    def test_ollama_unavailable_keeps_statistics(self, post):
        self._create(date=timezone.now() - timedelta(days=1), intensity=2)
        self._create(intensity=4)
        post.side_effect = requests.exceptions.ConnectionError()
        response = self.client.post(self.url, {"days": 7}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["statistics"]["count"], 2)
        self.assertIsNone(response.data["summary"])
        self.assertEqual(response.data["summary_status"], "unavailable")
        self.assertIn("indisponible", response.data["message"])

    @patch("apps.mood.views.requests.post")
    def test_invalid_model_response_is_not_shown_as_text(self, post):
        self._create(date=timezone.now() - timedelta(days=1))
        self._create()
        post.return_value.raise_for_status.return_value = None
        post.return_value.json.return_value = {"response": "pas du json"}
        response = self.client.post(self.url, {"days": 30}, format="json")
        self.assertEqual(response.data["summary_status"], "invalid_response")
        self.assertIsNone(response.data["summary"])
        self.assertEqual(response.data["statistics"]["count"], 2)

    def test_jwt_can_request_a_summary(self):
        self.client.force_authenticate(user=None)
        access = str(RefreshToken.for_user(self.user).access_token)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        response = self.client.post(self.url, {"days": 7}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["summary_status"], "insufficient_data")
