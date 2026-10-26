from datetime import timedelta
import io
import json
import os
from unittest.mock import patch

import requests
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from django.utils import timezone
from PIL import Image
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from .ai import DEFAULT_MOOD_MODEL
from .embeddings import (
    MoodEmbeddingError,
    MoodEmbeddingUnavailable,
    cosine_similarity,
    embed_text,
    ensure_embedding,
)
from .models import MoodCheck, MoodNoteAnalysis, MoodNoteEmbedding, mood_note_fingerprint
from .ocr import OcrRejected

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

    @patch("apps.mood.views.requests.post")
    def test_default_mood_model_is_qwen_when_unset(self, post):
        self._create(date=timezone.now() - timedelta(days=1))
        self._create()
        self._ollama(post)
        with patch.dict(os.environ):
            os.environ.pop("OLLAMA_MOOD_MODEL", None)
            response = self.client.post(self.url, {"days": 7}, format="json")
        self.assertEqual(response.data["summary_status"], "generated")
        self.assertEqual(post.call_args.kwargs["json"]["model"], DEFAULT_MOOD_MODEL)
        self.assertEqual(DEFAULT_MOOD_MODEL, "qwen2.5:7b")


class MoodNoteAnalysisAPITest(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="analysisuser",
            email="analysis@example.com",
            password="testpass123",
        )
        self.other = User.objects.create_user(
            username="analysisother",
            email="analysis-other@example.com",
            password="testpass123",
        )
        self.client.force_authenticate(self.user)
        self.note = "J'ai dormi peu avant l'examen et je me sens tendu."

    def _create(self, user=None, **overrides):
        data = {
            "user": user or self.user,
            "mood": "Stressé",
            "intensity": 4,
            "note": self.note,
            "date": timezone.now() - timedelta(hours=1),
        }
        data.update(overrides)
        return MoodCheck.objects.create(**data)

    def _url(self, mood):
        return reverse("mood-analyze-note", args=[mood.pk])

    def _reading(self, note=None):
        source = self.note if note is None else note
        return {
            "emotions_secondary": ["tension", "fatigue"],
            "themes": ["examen", "sommeil"],
            "evidence": ["dormi peu avant l'examen"],
            "summary": "La personne a peu dormi avant un examen et se sent tendue.",
            "limitations": "",
        } if "dormi peu avant l'examen" in source else {
            "emotions_secondary": ["soulagement"],
            "themes": ["repos"],
            "evidence": ["journée plus calme"],
            "summary": "La journée a été plus calme.",
            "limitations": "",
        }

    def _ollama(self, post, note=None, raw=None):
        post.return_value.raise_for_status.return_value = None
        post.return_value.json.return_value = {
            "response": raw if raw is not None else json.dumps(self._reading(note))
        }

    @patch("apps.mood.ai.requests.post")
    def test_valid_note_keeps_quotes_present_in_the_source(self, post):
        mood = self._create()
        self._ollama(post)
        with self.assertLogs("apps.mood.ai", level="INFO") as captured:
            response = self.client.post(self._url(mood), {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["analysis_status"], "available")
        analysis = response.data["note_analysis"]
        self.assertEqual(analysis["status"], "available")
        self.assertEqual(analysis["themes"], ["examen", "sommeil"])
        self.assertEqual(analysis["emotions_secondary"], ["tension", "fatigue"])
        self.assertEqual(analysis["evidence"], ["dormi peu avant l'examen"])
        self.assertIn(analysis["evidence"][0], mood.note)
        self.assertEqual(analysis["model_name"], DEFAULT_MOOD_MODEL)
        mood.refresh_from_db()
        self.assertEqual(mood.mood, "Stressé")
        self.assertEqual(mood.intensity, 4)
        self.assertEqual(MoodNoteAnalysis.objects.filter(mood_check=mood).count(), 1)
        logged = "\n".join(captured.output)
        self.assertNotIn(self.note, logged)
        self.assertNotIn("dormi peu avant l'examen", logged)
        prompt = post.call_args.kwargs["json"]["prompt"]
        self.assertIn(self.note, prompt)
        self.assertNotIn(prompt, logged)

    @patch("apps.mood.ai.requests.post")
    def test_empty_note_does_not_call_the_model(self, post):
        mood = self._create(note="")
        response = self.client.post(self._url(mood), {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("vide", str(response.data))
        post.assert_not_called()
        self.assertFalse(MoodNoteAnalysis.objects.filter(mood_check=mood).exists())

    @patch("apps.mood.ai.requests.post")
    def test_other_users_checkin_returns_404(self, post):
        private = self._create(user=self.other)
        response = self.client.post(self._url(private), {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        post.assert_not_called()

    @patch("apps.mood.ai.requests.post")
    def test_note_change_makes_the_previous_analysis_stale(self, post):
        mood = self._create()
        self._ollama(post)
        created = self.client.post(self._url(mood), {}, format="json")
        self.assertEqual(created.data["analysis_status"], "available")
        detail = reverse("mood-detail", args=[mood.pk])
        updated = self.client.patch(detail, {"note": "Une journée plus calme."}, format="json")
        self.assertEqual(updated.status_code, status.HTTP_200_OK)
        self.assertEqual(updated.data["note_analysis"]["status"], "stale")
        self.assertEqual(updated.data["mood"], "Stressé")
        self.assertEqual(post.call_count, 1)
        mood.delete()
        self.assertFalse(MoodNoteAnalysis.objects.exists())

    @patch("apps.mood.ai.requests.post")
    def test_current_analysis_is_reused_without_another_call(self, post):
        mood = self._create()
        self._ollama(post)
        first = self.client.post(self._url(mood), {}, format="json")
        self.assertEqual(first.data["analysis_status"], "available")
        second = self.client.post(self._url(mood), {"regenerate": False}, format="json")
        self.assertEqual(second.status_code, status.HTTP_200_OK)
        self.assertEqual(second.data["analysis_status"], "available")
        self.assertEqual(second.data["note_analysis"]["summary"], first.data["note_analysis"]["summary"])
        self.assertEqual(post.call_count, 1)
        third = self.client.post(self._url(mood), {"regenerate": True}, format="json")
        self.assertEqual(third.data["analysis_status"], "available")
        self.assertEqual(post.call_count, 2)

    @patch("apps.mood.ai.requests.post")
    def test_malformed_or_incomplete_json_is_rejected(self, post):
        mood = self._create()
        self._ollama(post, raw="pas du json")
        with self.assertLogs("apps.mood.ai", level="WARNING") as captured:
            malformed = self.client.post(self._url(mood), {}, format="json")
        self.assertEqual(malformed.status_code, status.HTTP_200_OK)
        self.assertNotEqual(malformed.status_code, status.HTTP_500_INTERNAL_SERVER_ERROR)
        self.assertEqual(malformed.data["analysis_status"], "error")
        self.assertIsNone(malformed.data["note_analysis"])
        self.assertNotIn(self.note, "\n".join(captured.output))
        self.assertFalse(MoodNoteAnalysis.objects.filter(mood_check=mood).exists())

        self._ollama(post, raw=json.dumps({"summary": "seulement un résumé"}))
        incomplete = self.client.post(self._url(mood), {}, format="json")
        self.assertEqual(incomplete.data["analysis_status"], "error")
        self.assertFalse(MoodNoteAnalysis.objects.filter(mood_check=mood).exists())

        invented = self._reading()
        invented["evidence"] = ["extrait inventé qui n'est pas dans la note"]
        self._ollama(post, raw=json.dumps(invented))
        rejected = self.client.post(self._url(mood), {}, format="json")
        self.assertEqual(rejected.data["analysis_status"], "error")
        self.assertFalse(MoodNoteAnalysis.objects.filter(mood_check=mood).exists())

    @patch("apps.mood.ai.requests.post")
    def test_timeout_or_connection_error_is_not_a_server_error(self, post):
        mood = self._create()
        post.side_effect = requests.exceptions.Timeout()
        timed_out = self.client.post(self._url(mood), {}, format="json")
        self.assertEqual(timed_out.status_code, status.HTTP_200_OK)
        self.assertEqual(timed_out.data["analysis_status"], "unavailable")
        self.assertIn("expiré", timed_out.data["message"])
        self.assertIsNone(timed_out.data["note_analysis"])

        post.side_effect = requests.exceptions.ConnectionError()
        refused = self.client.post(self._url(mood), {}, format="json")
        self.assertEqual(refused.status_code, status.HTTP_200_OK)
        self.assertEqual(refused.data["analysis_status"], "unavailable")
        self.assertIn("indisponible", refused.data["message"])
        self.assertNotEqual(refused.status_code, status.HTTP_500_INTERNAL_SERVER_ERROR)

    def test_summary_endpoint_stays_compatible(self):
        MoodCheck.objects.create(
            user=self.user,
            mood="Calme",
            intensity=3,
            note="NOTE-SECRETE-ALPHA",
            date=timezone.now() - timedelta(days=1),
        )
        MoodCheck.objects.create(
            user=self.user,
            mood="Heureux",
            intensity=4,
            note="NOTE-SECRETE-BETA",
            date=timezone.now() - timedelta(hours=1),
        )
        with patch("apps.mood.views.requests.post") as post:
            post.return_value.raise_for_status.return_value = None
            post.return_value.json.return_value = {
                "response": json.dumps({"summary": "Deux humeurs ont été enregistrées."})
            }
            response = self.client.post(reverse("mood-summary"), {"days": 7}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["summary_status"], "generated")
        self.assertEqual(response.data["statistics"]["count"], 2)
        prompt = post.call_args.kwargs["json"]["prompt"]
        self.assertNotIn("NOTE-SECRETE-ALPHA", prompt)
        self.assertNotIn("NOTE-SECRETE-BETA", prompt)


def build_pdf(page_texts):
    """Minimal text PDF kept in memory. Empty strings produce a page without text."""
    streams = []
    for text in page_texts:
        if not text:
            streams.append(b"")
            continue
        safe = (
            text.replace("\\", "\\\\")
            .replace("(", "\\(")
            .replace(")", "\\)")
            .encode("latin-1")
        )
        streams.append(b"BT /F1 18 Tf 50 120 Td (" + safe + b") Tj ET")

    font_num = 3 + len(streams) * 2
    objects = {
        1: b"<< /Type /Catalog /Pages 2 0 R >>",
        2: (
            f"<< /Type /Pages /Count {len(streams)} /Kids ["
            + " ".join(f"{3 + index * 2} 0 R" for index in range(len(streams)))
            + "] >>"
        ).encode(),
    }
    for index, stream in enumerate(streams):
        page_num = 3 + index * 2
        content_num = page_num + 1
        objects[page_num] = (
            f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
            f"/Contents {content_num} 0 R "
            f"/Resources << /Font << /F1 {font_num} 0 R >> >> >>"
        ).encode()
        objects[content_num] = (
            f"<< /Length {len(stream)} >>\nstream\n".encode()
            + stream
            + b"\nendstream"
        )
    objects[font_num] = b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"

    output = bytearray(b"%PDF-1.4\n")
    offsets = [0] * (font_num + 1)
    for number in range(1, font_num + 1):
        offsets[number] = len(output)
        output += f"{number} 0 obj\n".encode() + objects[number] + b"\nendobj\n"
    xref_pos = len(output)
    output += f"xref\n0 {font_num + 1}\n".encode()
    output += b"0000000000 65535 f \n"
    for number in range(1, font_num + 1):
        output += f"{offsets[number]:010d} 00000 n \n".encode()
    output += (
        f"trailer << /Size {font_num + 1} /Root 1 0 R >>\n"
        f"startxref\n{xref_pos}\n%%EOF\n"
    ).encode()
    return bytes(output)


class MoodOcrAPITest(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="ocruser",
            email="ocr@example.com",
            password="testpass123",
        )
        self.other = User.objects.create_user(
            username="ocrother",
            email="ocr-other@example.com",
            password="testpass123",
        )
        self.client.force_authenticate(self.user)
        self.url = reverse("mood-ocr")

    def _png(self):
        buffer = io.BytesIO()
        Image.new("RGB", (40, 20), "white").save(buffer, format="PNG")
        return SimpleUploadedFile("note.png", buffer.getvalue(), content_type="image/png")

    def _post(self, uploaded, **extra):
        payload = {"file": uploaded}
        payload.update(extra)
        return self.client.post(self.url, payload, format="multipart")

    def test_anonymous_access_is_refused(self):
        self.client.force_authenticate(user=None)
        response = self._post(self._png())
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    @patch("apps.mood.ocr.read_image_text", return_value="NOTE-OCR-VISIBLE")
    @patch("apps.mood.ocr.installed_languages", return_value=["fra", "eng", "osd"])
    def test_valid_image_returns_mocked_ocr_text(self, _langs, reader):
        before = MoodCheck.objects.count()
        with self.assertLogs("apps.mood.ocr", level="INFO") as captured:
            response = self._post(self._png(), user=self.other.pk)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "success")
        self.assertEqual(response.data["text"], "NOTE-OCR-VISIBLE")
        self.assertEqual(response.data["document_type"], "image")
        self.assertEqual(response.data["language"], "fra+eng")
        reader.assert_called_once()
        self.assertEqual(MoodCheck.objects.count(), before)
        logged = "\n".join(captured.output)
        self.assertNotIn("NOTE-OCR-VISIBLE", logged)

    def test_text_pdf_is_extracted_without_tesseract(self):
        secret = "PDF-SECRET-ALPHA"
        uploaded = SimpleUploadedFile(
            "journal.pdf",
            build_pdf([secret]),
            content_type="application/pdf",
        )
        with patch("apps.mood.ocr.read_image_text") as reader:
            with self.assertLogs("apps.mood.ocr", level="INFO") as captured:
                response = self._post(uploaded)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "success")
        self.assertIn(secret, response.data["text"])
        self.assertEqual(response.data["document_type"], "pdf")
        self.assertEqual(response.data["page_count"], 1)
        self.assertIsNone(response.data["language"])
        reader.assert_not_called()
        self.assertNotIn(secret, "\n".join(captured.output))

    def test_empty_file_is_rejected(self):
        uploaded = SimpleUploadedFile("note.png", b"", content_type="image/png")
        response = self._post(uploaded)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("vide", str(response.data))

    def test_oversized_file_is_rejected(self):
        uploaded = SimpleUploadedFile("note.png", b"x" * 40, content_type="image/png")
        with patch.dict(os.environ, {"MOOD_OCR_MAX_BYTES": "20"}):
            response = self._post(uploaded)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("limite", str(response.data))

    def test_allowed_extension_with_forbidden_content_is_rejected(self):
        uploaded = SimpleUploadedFile(
            "photo.jpg",
            b"this is plain text, not a jpeg",
            content_type="image/jpeg",
        )
        response = self._post(uploaded)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Format", str(response.data))

    def test_corrupt_file_is_rejected(self):
        uploaded = SimpleUploadedFile(
            "note.png",
            b"\x89PNG\r\n\x1a\n" + b"not-a-real-png",
            content_type="image/png",
        )
        with self.assertLogs("apps.mood.ocr", level="WARNING") as captured:
            response = self._post(uploaded)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertNotEqual(response.status_code, status.HTTP_500_INTERNAL_SERVER_ERROR)
        self.assertNotIn("not-a-real-png", "\n".join(captured.output))
        self.assertNotIn("Traceback", str(response.data))

    @patch("apps.mood.ocr.poppler_executable", return_value=None)
    def test_pdf_without_text_reports_a_scanned_document(self, _poppler):
        uploaded = SimpleUploadedFile(
            "scan.pdf",
            build_pdf([""]),
            content_type="application/pdf",
        )
        response = self._post(uploaded)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "no_text")
        self.assertEqual(response.data["text"], "")
        self.assertIn("scann", response.data["message"])
        self.assertIn("Poppler", response.data["message"])
        self.assertEqual(MoodCheck.objects.count(), 0)

    @patch("apps.mood.ocr.read_image_text", return_value="SCAN-NOTE-77")
    @patch("apps.mood.ocr.installed_languages", return_value=["fra", "eng"])
    @patch("apps.mood.ocr.tesseract_command", return_value=r"C:\Tesseract-OCR\tesseract.exe")
    @patch("apps.mood.ocr.poppler_executable", return_value=r"C:\poppler\pdftoppm.exe")
    def test_scanned_pdf_uses_mocked_ocr_without_creating_a_checkin(
        self, _poppler, _tesseract, _langs, reader
    ):
        buffer = io.BytesIO()
        Image.new("RGB", (40, 20), "white").save(buffer, format="PNG")
        uploaded = SimpleUploadedFile(
            "scan.pdf",
            build_pdf([""]),
            content_type="application/pdf",
        )
        with patch("apps.mood.ocr.render_pdf_pages", return_value=[buffer.getvalue()]) as render:
            with self.assertLogs("apps.mood.ocr", level="INFO") as captured:
                response = self._post(uploaded)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "success")
        self.assertEqual(response.data["text"], "SCAN-NOTE-77")
        self.assertEqual(response.data["document_type"], "pdf")
        self.assertEqual(response.data["language"], "fra+eng")
        self.assertEqual(response.data["page_count"], 1)
        render.assert_called_once()
        reader.assert_called_once()
        self.assertEqual(MoodCheck.objects.count(), 0)
        self.assertNotIn("SCAN-NOTE-77", "\n".join(captured.output))

    @patch("apps.mood.ocr.render_pdf_pages")
    @patch("apps.mood.ocr.poppler_executable", return_value=r"C:\poppler\pdftoppm.exe")
    def test_scanned_pdf_can_be_disabled(self, _poppler, render):
        uploaded = SimpleUploadedFile(
            "scan.pdf",
            build_pdf([""]),
            content_type="application/pdf",
        )
        with patch.dict(os.environ, {"MOOD_OCR_SCANNED_PDF": "0"}):
            response = self._post(uploaded)
        render.assert_not_called()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "no_text")
        self.assertIn("désactivée", response.data["message"])

    @patch(
        "apps.mood.ocr.render_pdf_pages",
        side_effect=OcrRejected("Le PDF scanné n'a pas pu être converti."),
    )
    @patch("apps.mood.ocr.installed_languages", return_value=["fra", "eng"])
    @patch("apps.mood.ocr.tesseract_command", return_value=r"C:\Tesseract-OCR\tesseract.exe")
    @patch("apps.mood.ocr.poppler_executable", return_value=r"C:\poppler\pdftoppm.exe")
    def test_scanned_pdf_conversion_failure_is_rejected(
        self, _poppler, _tesseract, _langs, _render
    ):
        uploaded = SimpleUploadedFile(
            "scan.pdf",
            build_pdf([""]),
            content_type="application/pdf",
        )
        response = self._post(uploaded)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("converti", str(response.data))
        self.assertNotIn("Traceback", str(response.data))
        self.assertEqual(MoodCheck.objects.count(), 0)

    def test_pdf_over_the_page_limit_is_rejected(self):
        uploaded = SimpleUploadedFile(
            "long.pdf",
            build_pdf(["un", "deux"]),
            content_type="application/pdf",
        )
        with patch.dict(os.environ, {"MOOD_OCR_MAX_PAGES": "1"}):
            response = self._post(uploaded)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("pages", str(response.data))

    @patch("apps.mood.ocr.read_image_text")
    @patch("apps.mood.ocr.tesseract_command", return_value=None)
    def test_missing_tesseract_is_unavailable(self, _command, reader):
        response = self._post(self._png())
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertNotEqual(response.status_code, status.HTTP_500_INTERNAL_SERVER_ERROR)
        self.assertEqual(response.data["status"], "unavailable")
        self.assertIn("Tesseract", response.data["message"])
        reader.assert_not_called()

    @patch("apps.mood.ocr.read_image_text")
    @patch("apps.mood.ocr.installed_languages", return_value=["eng"])
    def test_missing_ocr_language_is_unavailable(self, _langs, reader):
        with patch.dict(os.environ, {"MOOD_OCR_LANGS": "fra+ara"}):
            response = self._post(self._png())
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "unavailable")
        self.assertIn("fra", response.data["message"])
        self.assertIn("ara", response.data["message"])
        reader.assert_not_called()

    @patch("apps.mood.ocr.read_image_text", return_value="Texte confirme pour la note")
    @patch("apps.mood.ocr.installed_languages", return_value=["fra", "eng"])
    def test_confirmed_text_can_be_saved_by_the_existing_form(self, _langs, _reader):
        extracted = self._post(self._png())
        self.assertEqual(extracted.data["status"], "success")
        before = MoodCheck.objects.count()
        created = self.client.post(reverse("mood-list"), {
            "mood": "Heureux",
            "intensity": 2,
            "note": extracted.data["text"],
            "user": self.other.pk,
        }, format="json")
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)
        self.assertEqual(created.data["note"], "Texte confirme pour la note")
        self.assertEqual(created.data["mood"], "Heureux")
        self.assertEqual(created.data["intensity"], 2)
        self.assertEqual(MoodCheck.objects.count(), before + 1)
        stored = MoodCheck.objects.get(pk=created.data["id"])
        self.assertEqual(stored.user, self.user)

    @patch("apps.mood.ocr.read_image_text", return_value="Nouveau texte")
    @patch("apps.mood.ocr.installed_languages", return_value=["fra", "eng"])
    def test_extraction_does_not_change_an_existing_note_or_owner(self, _langs, _reader):
        mood = MoodCheck.objects.create(
            user=self.user,
            mood="Calme",
            intensity=3,
            note="NOTE-DEJA-ENREGISTREE",
            date=timezone.now() - timedelta(hours=1),
        )
        response = self._post(self._png(), user=self.other.pk)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        mood.refresh_from_db()
        self.assertEqual(mood.note, "NOTE-DEJA-ENREGISTREE")
        self.assertEqual(mood.mood, "Calme")
        self.assertEqual(mood.intensity, 3)
        self.assertEqual(mood.user, self.user)
        self.assertNotIn("NOTE-DEJA-ENREGISTREE", response.data["text"])


def _embedding_response(payload, status_code=200):
    class _Response:
        def json(self):
            if isinstance(payload, Exception):
                raise payload
            return payload

        def raise_for_status(self):
            if status_code >= 400:
                raise requests.HTTPError("status")

    return _Response()


class MoodEmbeddingServiceTest(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="embeduser",
            email="embed@example.com",
            password="testpass123",
        )
        self.env = {
            "OLLAMA_MOOD_EMBEDDING_MODEL": "nomic-embed-text:latest",
            "OLLAMA_MOOD_EMBEDDING_DIMENSIONS": "2",
        }

    def _check(self, note="une note personnelle", mood="Calme", intensity=3):
        return MoodCheck.objects.create(
            user=self.user,
            mood=mood,
            intensity=intensity,
            note=note,
            date=timezone.now(),
        )

    def test_cosine_similarity_on_known_vectors(self):
        self.assertEqual(cosine_similarity([1, 0], [1, 0]), 1)
        self.assertEqual(cosine_similarity([1, 0], [0, 1]), 0)
        self.assertAlmostEqual(cosine_similarity([1, 0], [-1, 0]), -1)

    def test_cosine_similarity_rejects_invalid_vectors(self):
        self.assertIsNone(cosine_similarity([], [1]))
        self.assertIsNone(cosine_similarity([0, 0], [1, 0]))
        self.assertIsNone(cosine_similarity([1, 0], [1]))
        self.assertIsNone(cosine_similarity([1, "a"], [1, 0]))
        self.assertIsNone(cosine_similarity([1, float("nan")], [1, 0]))
        self.assertIsNone(cosine_similarity(None, [1, 0]))

    @patch("apps.mood.embeddings.requests.post")
    def test_valid_embedding_is_numeric(self, post):
        post.return_value = _embedding_response({"embedding": [0.25, -0.5]})
        with patch.dict(os.environ, self.env):
            with self.assertLogs("apps.mood.embeddings", level="INFO") as captured:
                vector = embed_text("bonjour-secret")
        self.assertEqual(vector, [0.25, -0.5])
        self.assertNotIn("bonjour-secret", "\n".join(captured.output))
        sent = post.call_args.kwargs["json"]
        self.assertEqual(sent["model"], "nomic-embed-text:latest")
        self.assertIn("bonjour-secret", sent["prompt"])
        self.assertNotIn("mood", sent)

    @patch("apps.mood.embeddings.requests.post")
    def test_malformed_embedding_is_rejected(self, post):
        post.return_value = _embedding_response({"embedding": []})
        with patch.dict(os.environ, self.env):
            with self.assertRaises(MoodEmbeddingError):
                embed_text("bonjour")

    @patch("apps.mood.embeddings.requests.post")
    def test_connection_error_and_timeout_are_controlled(self, post):
        post.side_effect = requests.ConnectionError("down")
        with patch.dict(os.environ, self.env):
            with self.assertRaises(MoodEmbeddingError) as connection:
                embed_text("bonjour")
        self.assertIn("indisponible", connection.exception.message)
        post.side_effect = requests.Timeout("slow")
        with patch.dict(os.environ, self.env):
            with self.assertRaises(MoodEmbeddingError) as timeout:
                embed_text("bonjour")
        self.assertIn("expiré", timeout.exception.message)

    @patch("apps.mood.embeddings.requests.post")
    def test_empty_note_is_rejected_without_calling_ollama(self, post):
        with self.assertRaises(MoodEmbeddingError) as raised:
            embed_text("   ")
        self.assertIn("vide", raised.exception.message)
        post.assert_not_called()

    @patch("apps.mood.embeddings.embed_text", return_value=[0.2, 0.4])
    def test_current_embedding_is_reused(self, embed):
        check = self._check("NOTE-REUTILISEE")
        with patch.dict(os.environ, self.env):
            first = ensure_embedding(check)
            second = ensure_embedding(check)
        embed.assert_called_once()
        self.assertEqual(first.pk, second.pk)
        self.assertEqual(MoodNoteEmbedding.objects.filter(mood_check=check).count(), 1)
        check.refresh_from_db()
        self.assertEqual(check.mood, "Calme")
        self.assertEqual(check.intensity, 3)

    @patch("apps.mood.embeddings.embed_text", return_value=[0.2, 0.4])
    def test_note_change_replaces_the_embedding(self, embed):
        check = self._check("NOTE-AVANT")
        with patch.dict(os.environ, self.env):
            ensure_embedding(check)
            check.note = "NOTE-APRES"
            check.save(update_fields=["note"])
            updated = ensure_embedding(check)
        self.assertEqual(embed.call_count, 2)
        self.assertEqual(updated.text_sha256, mood_note_fingerprint("NOTE-APRES"))
        check.refresh_from_db()
        self.assertEqual(check.mood, "Calme")
        self.assertEqual(check.intensity, 3)

    @patch("apps.mood.embeddings.embed_text", return_value=[0.2, 0.4])
    def test_model_change_replaces_the_embedding(self, embed):
        check = self._check("NOTE-MODELE")
        with patch.dict(os.environ, self.env):
            ensure_embedding(check)
        changed = dict(self.env)
        changed["OLLAMA_MOOD_EMBEDDING_MODEL"] = "other-embed:latest"
        with patch.dict(os.environ, changed):
            updated = ensure_embedding(check)
        self.assertEqual(embed.call_count, 2)
        self.assertEqual(updated.model_name, "other-embed:latest")
        self.assertEqual(MoodNoteEmbedding.objects.filter(mood_check=check).count(), 1)

    def test_empty_note_removes_a_stored_embedding(self):
        check = self._check("")
        MoodNoteEmbedding.objects.create(
            mood_check=check,
            vector=[0.1, 0.2],
            dimensions=2,
            text_sha256=mood_note_fingerprint("ancienne"),
            model_name="nomic-embed-text:latest",
            generated_at=timezone.now(),
        )
        with patch("apps.mood.embeddings.embed_text") as embed:
            self.assertIsNone(ensure_embedding(check))
        embed.assert_not_called()
        self.assertFalse(MoodNoteEmbedding.objects.filter(mood_check=check).exists())

    def test_deleting_a_checkin_deletes_its_embedding(self):
        check = self._check("NOTE-SUPPRIMEE")
        MoodNoteEmbedding.objects.create(
            mood_check=check,
            vector=[0.1, 0.2],
            dimensions=2,
            text_sha256=mood_note_fingerprint(check.note),
            model_name="nomic-embed-text:latest",
            generated_at=timezone.now(),
        )
        check.delete()
        self.assertEqual(MoodNoteEmbedding.objects.count(), 0)


class MoodSemanticSearchAPITest(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="searchuser",
            email="search@example.com",
            password="testpass123",
        )
        self.other = User.objects.create_user(
            username="searchother",
            email="search-other@example.com",
            password="testpass123",
        )
        self.client.force_authenticate(self.user)
        self.url = reverse("mood-semantic-search")
        self.env = {
            "OLLAMA_MOOD_EMBEDDING_MODEL": "nomic-embed-text:latest",
            "OLLAMA_MOOD_EMBEDDING_DIMENSIONS": "2",
            "MOOD_EMBEDDING_MIN_SIMILARITY": "0",
            "MOOD_EMBEDDING_BACKFILL_LIMIT": "20",
            "MOOD_EMBEDDING_MAX_CANDIDATES": "500",
        }

    def _check(self, user, note, mood="Fatigué", intensity=4, days_ago=0):
        return MoodCheck.objects.create(
            user=user,
            mood=mood,
            intensity=intensity,
            note=note,
            date=timezone.now() - timedelta(days=days_ago),
        )

    def _store(self, check, vector):
        return MoodNoteEmbedding.objects.create(
            mood_check=check,
            vector=vector,
            dimensions=len(vector),
            text_sha256=mood_note_fingerprint(check.note),
            model_name="nomic-embed-text:latest",
            generated_at=timezone.now(),
        )

    def _search(self, payload):
        with patch.dict(os.environ, self.env):
            return self.client.post(self.url, payload, format="json")

    def test_anonymous_search_is_refused(self):
        self.client.force_authenticate(user=None)
        response = self.client.post(self.url, {"query": "sommeil"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    @patch("apps.mood.embeddings.embed_text", return_value=[1.0, 0.0])
    def test_results_are_ranked_and_limited(self, embed):
        near = self._check(self.user, "NOTE-PROCHE", days_ago=1)
        middle = self._check(self.user, "NOTE-MOYENNE", mood="Calme", intensity=2, days_ago=2)
        far = self._check(self.user, "NOTE-LOINTAINE", days_ago=3)
        self._store(near, [1.0, 0.0])
        self._store(middle, [0.6, 0.8])
        self._store(far, [0.0, 1.0])
        response = self._search({"query": "REQUETE-RANG", "limit": 2})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            [item["id"] for item in response.data["results"]],
            [str(near.id), str(middle.id)],
        )
        self.assertGreater(
            response.data["results"][0]["similarity"],
            response.data["results"][1]["similarity"],
        )
        self.assertEqual(response.data["similarity_metric"], "cosine")
        self.assertNotIn("vector", response.data["results"][0])
        embed.assert_called_once()

    @patch("apps.mood.embeddings.embed_text", return_value=[1.0, 0.0])
    def test_results_below_the_threshold_are_excluded(self, _embed):
        kept = self._check(self.user, "NOTE-GARDEE")
        dropped = self._check(self.user, "NOTE-ECARTEE")
        self._store(kept, [1.0, 0.0])
        self._store(dropped, [0.1, 0.9])
        self.env["MOOD_EMBEDDING_MIN_SIMILARITY"] = "0.9"
        response = self._search({"query": "seuil"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([item["id"] for item in response.data["results"]], [str(kept.id)])

    @patch("apps.mood.embeddings.embed_text", return_value=[1.0, 0.0])
    def test_other_users_notes_are_never_returned(self, _embed):
        own = self._check(self.user, "NOTE-A-MOI", mood="Calme", intensity=2)
        secret = self._check(self.other, "NOTE-SECRETE-AUTRUI", mood="Anxieux", intensity=5)
        self._store(own, [0.2, 0.8])
        self._store(secret, [1.0, 0.0])
        with self.assertLogs("apps.mood.embeddings", level="INFO") as captured:
            response = self._search({"query": "REQUETE-PRIVEE"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([item["id"] for item in response.data["results"]], [str(own.id)])
        self.assertNotIn("NOTE-SECRETE-AUTRUI", str(response.data))
        logged = "\n".join(captured.output)
        self.assertNotIn("REQUETE-PRIVEE", logged)
        self.assertNotIn("NOTE-A-MOI", logged)
        self.assertNotIn("NOTE-SECRETE-AUTRUI", logged)
        own.refresh_from_db()
        self.assertEqual(own.mood, "Calme")
        self.assertEqual(own.intensity, 2)

    def test_search_without_checkins_does_not_call_ollama(self):
        with patch("apps.mood.embeddings.embed_text") as embed:
            response = self._search({"query": "rien"})
        embed.assert_not_called()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["results"], [])
        self.assertIn("Aucun check-in", response.data["message"])

    @patch("apps.mood.embeddings.embed_text", side_effect=[[1.0, 0.0], [0.0, 1.0]])
    def test_missing_embedding_is_generated_for_the_owner(self, embed):
        check = self._check(self.user, "NOTE-SANS-VECTEUR", mood="Stressé", intensity=4)
        before = MoodCheck.objects.count()
        response = self._search({"query": "generer"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["results"][0]["id"], str(check.id))
        self.assertEqual(response.data["results"][0]["mood"], "Stressé")
        self.assertEqual(response.data["results"][0]["intensity"], 4)
        self.assertEqual(embed.call_count, 2)
        self.assertEqual(MoodNoteEmbedding.objects.filter(mood_check=check).count(), 1)
        self.assertEqual(MoodCheck.objects.count(), before)
        check.refresh_from_db()
        self.assertEqual(check.note, "NOTE-SANS-VECTEUR")

    @patch("apps.mood.embeddings.embed_text", return_value=[1.0, 0.0])
    def test_invalid_embedding_is_skipped(self, embed):
        valid = self._check(self.user, "NOTE-VALIDE")
        broken = self._check(self.user, "NOTE-INVALIDE")
        self._store(valid, [1.0, 0.0])
        MoodNoteEmbedding.objects.create(
            mood_check=broken,
            vector=["pas-un-nombre", 1],
            dimensions=2,
            text_sha256=mood_note_fingerprint(broken.note),
            model_name="nomic-embed-text:latest",
            generated_at=timezone.now(),
        )
        response = self._search({"query": "valide"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([item["id"] for item in response.data["results"]], [str(valid.id)])
        embed.assert_called_once()

    @patch("apps.mood.embeddings.embed_text", return_value=[1.0, 0.0])
    def test_absent_embeddings_are_not_all_generated_at_once(self, embed):
        self._check(self.user, "NOTE-RECENTE", days_ago=0)
        self._check(self.user, "NOTE-ANCIENNE", days_ago=3)
        self.env["MOOD_EMBEDDING_BACKFILL_LIMIT"] = "0"
        response = self._search({"query": "attente"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["results"], [])
        self.assertEqual(response.data["pending"], 2)
        self.assertEqual(MoodNoteEmbedding.objects.count(), 0)
        embed.assert_called_once()

    @patch("apps.mood.embeddings.embed_text", side_effect=MoodEmbeddingUnavailable())
    def test_ollama_unavailable_does_not_return_success(self, _embed):
        self._check(self.user, "NOTE-PRESENTE")
        response = self._search({"query": "panne"})
        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertIn("indisponible", response.data["detail"])
        self.assertNotIn("NOTE-PRESENTE", str(response.data))

    def test_invalid_query_is_rejected(self):
        response = self._search({"query": "   "})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("query", response.data)
        long_query = self._search({"query": "a" * 1001})
        self.assertEqual(long_query.status_code, status.HTTP_400_BAD_REQUEST)
        too_many = self._search({"query": "sommeil", "limit": 11})
        self.assertEqual(too_many.status_code, status.HTTP_400_BAD_REQUEST)

    @patch("apps.mood.embeddings.embed_text")
    def test_creating_a_checkin_does_not_call_the_embedding_service(self, embed):
        response = self.client.post(reverse("mood-list"), {
            "mood": "Heureux",
            "intensity": 2,
            "note": "Une journée calme",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        embed.assert_not_called()
        self.assertFalse(MoodNoteEmbedding.objects.exists())


def _assistant_response(payload, status_code=200):
    class _Response:
        def json(self):
            if isinstance(payload, Exception):
                raise payload
            return payload

        def raise_for_status(self):
            if status_code >= 400:
                raise requests.HTTPError("status")

    return _Response()


class MoodAssistantAPITest(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="assistuser",
            email="assist@example.com",
            password="testpass123",
        )
        self.other = User.objects.create_user(
            username="assistother",
            email="assist-other@example.com",
            password="testpass123",
        )
        self.client.force_authenticate(self.user)
        self.url = reverse("mood-assistant")
        self.env = {
            "OLLAMA_MOOD_EMBEDDING_MODEL": "nomic-embed-text:latest",
            "OLLAMA_MOOD_EMBEDDING_DIMENSIONS": "2",
            "MOOD_EMBEDDING_MIN_SIMILARITY": "0",
            "MOOD_EMBEDDING_BACKFILL_LIMIT": "20",
            "MOOD_EMBEDDING_MAX_CANDIDATES": "500",
            "OLLAMA_MOOD_MODEL": "qwen2.5:7b",
        }

    def _check(self, user, note, mood="Stressé", intensity=4, days_ago=0):
        return MoodCheck.objects.create(
            user=user,
            mood=mood,
            intensity=intensity,
            note=note,
            date=timezone.now() - timedelta(days=days_ago),
        )

    def _store(self, check, vector):
        return MoodNoteEmbedding.objects.create(
            mood_check=check,
            vector=vector,
            dimensions=len(vector),
            text_sha256=mood_note_fingerprint(check.note),
            model_name="nomic-embed-text:latest",
            generated_at=timezone.now(),
        )

    def _ask(self, payload):
        with patch.dict(os.environ, self.env):
            return self.client.post(self.url, payload, format="json")

    def test_anonymous_access_is_refused(self):
        self.client.force_authenticate(user=None)
        response = self.client.post(self.url, {"question": "sommeil"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_empty_or_long_question_is_rejected(self):
        empty = self._ask({"question": "   "})
        self.assertEqual(empty.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("question", empty.data)
        too_long = self._ask({"question": "a" * 1001})
        self.assertEqual(too_long.status_code, status.HTTP_400_BAD_REQUEST)

    @patch("apps.mood.assistant.requests.post")
    @patch("apps.mood.embeddings.embed_text", return_value=[1.0, 0.0])
    def test_sources_match_the_owner_checkin_and_ignore_a_client_user_id(self, _embed, post):
        own = self._check(self.user, "NOTE-A-MOI", mood="Calme", intensity=2, days_ago=1)
        secret = self._check(self.other, "NOTE-SECRETE-AUTRUI", mood="Anxieux", intensity=5)
        self._store(own, [1.0, 0.0])
        self._store(secret, [1.0, 0.0])
        post.return_value = _assistant_response({"response": json.dumps({"answer": "Vos notes parlent de calme."})})
        before = MoodCheck.objects.count()
        with self.assertLogs("apps.mood.assistant", level="INFO") as captured:
            response = self._ask({
                "question": "QUESTION-PRIVEE",
                "user": self.other.pk,
                "user_id": self.other.pk,
            })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["answer"], "Vos notes parlent de calme.")
        self.assertEqual(len(response.data["sources"]), 1)
        source = response.data["sources"][0]
        self.assertEqual(source["id"], str(own.id))
        self.assertEqual(source["date"], own.date.isoformat())
        self.assertEqual(source["mood"], "Calme")
        self.assertEqual(source["intensity"], 2)
        self.assertEqual(source["excerpt"], "NOTE-A-MOI")
        self.assertNotIn("similarity", source)
        self.assertNotIn("NOTE-SECRETE-AUTRUI", str(response.data))
        sent = post.call_args.kwargs["json"]["prompt"]
        self.assertIn("NOTE-A-MOI", sent)
        self.assertNotIn("NOTE-SECRETE-AUTRUI", sent)
        self.assertEqual(sent and post.call_args.kwargs["json"]["model"], "qwen2.5:7b")
        logged = "\n".join(captured.output)
        self.assertNotIn("QUESTION-PRIVEE", logged)
        self.assertNotIn("NOTE-A-MOI", logged)
        self.assertNotIn("NOTE-SECRETE-AUTRUI", logged)
        own.refresh_from_db()
        self.assertEqual(own.note, "NOTE-A-MOI")
        self.assertEqual(own.mood, "Calme")
        self.assertEqual(own.intensity, 2)
        self.assertEqual(MoodCheck.objects.count(), before)

    @patch("apps.mood.assistant.requests.post")
    @patch("apps.mood.embeddings.embed_text", return_value=[1.0, 0.0])
    def test_irrelevant_notes_produce_no_sources_and_no_invented_answer(self, _embed, post):
        self._check(self.user, "NOTE-LOINTAINE")
        self._store(MoodCheck.objects.get(note="NOTE-LOINTAINE"), [0.0, 1.0])
        self.env["MOOD_EMBEDDING_MIN_SIMILARITY"] = "0.99"
        response = self._ask({"question": "QUESTION-SANS-SOURCE"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["sources"], [])
        self.assertIn("aucun check-in", response.data["answer"].lower())
        self.assertNotIn("NOTE-LOINTAINE", response.data["answer"])
        post.assert_not_called()

    def test_no_checkins_do_not_invent_a_personal_answer(self):
        with patch("apps.mood.assistant.requests.post") as post:
            response = self._ask({"question": "comment je vais"})
        post.assert_not_called()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["sources"], [])
        self.assertIn("aucun check-in", response.data["answer"].lower())

    @patch("apps.mood.assistant.requests.post")
    @patch("apps.mood.embeddings.embed_text", return_value=[1.0, 0.0])
    def test_context_is_limited_to_five_checkins(self, _embed, post):
        created = []
        for index in range(6):
            check = self._check(self.user, f"NOTE-{index}", days_ago=index)
            self._store(check, [1.0, 0.0])
            created.append(check)
        post.return_value = _assistant_response({"response": json.dumps({"answer": "Cinq notes au plus."})})
        response = self._ask({"question": "que revient souvent"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["sources"]), 5)
        returned = {item["id"] for item in response.data["sources"]}
        self.assertNotIn(str(created[-1].id), returned)
        self.assertEqual(MoodCheck.objects.filter(user=self.user).count(), 6)

    @patch("apps.mood.assistant.requests.post")
    @patch("apps.mood.embeddings.embed_text", return_value=[1.0, 0.0])
    def test_unavailable_and_timeout_are_controlled(self, _embed, post):
        check = self._check(self.user, "NOTE-PANNE")
        self._store(check, [1.0, 0.0])
        post.side_effect = requests.ConnectionError("down")
        unavailable = self._ask({"question": "QUESTION-PANNE"})
        self.assertEqual(unavailable.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertIn("indisponible", unavailable.data["detail"])
        self.assertNotIn("NOTE-PANNE", str(unavailable.data))
        self.assertNotIn("QUESTION-PANNE", str(unavailable.data))
        post.side_effect = requests.Timeout("slow")
        expired = self._ask({"question": "QUESTION-DELAI"})
        self.assertEqual(expired.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertIn("expiré", expired.data["detail"])
        self.assertNotEqual(expired.status_code, status.HTTP_500_INTERNAL_SERVER_ERROR)

    @patch("apps.mood.assistant.requests.post")
    @patch("apps.mood.embeddings.embed_text", return_value=[1.0, 0.0])
    def test_empty_or_malformed_model_reply_is_rejected(self, _embed, post):
        check = self._check(self.user, "NOTE-MODELE")
        self._store(check, [1.0, 0.0])
        replies = [
            {"response": ""},
            {"response": "pas du json"},
            {"response": json.dumps({"answer": "   "})},
            {"response": json.dumps({"answer": 4})},
            {"response": json.dumps({"answer": "Voir 12345678-1234-1234-1234-123456789abc"})},
        ]
        for payload in replies:
            post.return_value = _assistant_response(payload)
            response = self._ask({"question": "question valide"})
            self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
            self.assertNotIn("NOTE-MODELE", str(response.data))

    @patch("apps.mood.assistant.requests.post")
    @patch("apps.mood.embeddings.embed_text", return_value=[1.0, 0.0])
    def test_semantic_search_stays_compatible(self, _embed, post):
        check = self._check(self.user, "NOTE-COMMUNE", mood="Fatigué", intensity=3)
        self._store(check, [1.0, 0.0])
        post.return_value = _assistant_response({"response": json.dumps({"answer": "La note parle de fatigue."})})
        with patch.dict(os.environ, self.env):
            search = self.client.post(
                reverse("mood-semantic-search"),
                {"query": "fatigue", "limit": 5},
                format="json",
            )
        answer = self._ask({"question": "quand suis-je fatigué"})
        self.assertEqual(search.status_code, status.HTTP_200_OK)
        self.assertEqual(answer.status_code, status.HTTP_200_OK)
        self.assertEqual(search.data["results"][0]["id"], str(check.id))
        self.assertEqual(answer.data["sources"][0]["id"], str(check.id))
        self.assertEqual(search.data["results"][0]["excerpt"], answer.data["sources"][0]["excerpt"])


class AdminMoodAPITest(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            username="moodowner",
            email="moodowner@example.com",
            password="testpass123",
        )
        self.other = User.objects.create_user(
            username="moodother",
            email="moodother@example.com",
            password="testpass123",
        )
        self.admin = User.objects.create_user(
            username="moodadmin",
            email="moodadmin@example.com",
            password="testpass123",
            role="admin",
        )
        self.private = MoodCheck.objects.create(
            user=self.owner,
            mood="Stressé",
            intensity=4,
            note="NOTE-PRIVEE-HUMEUR",
            date=timezone.now(),
        )
        MoodCheck.objects.create(
            user=self.other,
            mood="Calme",
            intensity=2,
            note="",
            date=timezone.now(),
        )
        self.list_url = reverse("admin-mood-list")
        self.stats_url = reverse("admin-mood-stats")

    def test_regular_user_cannot_read_admin_moods(self):
        self.client.force_authenticate(self.owner)
        listed = self.client.get(self.list_url)
        stats = self.client.get(self.stats_url)
        self.assertEqual(listed.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(stats.status_code, status.HTTP_403_FORBIDDEN)
        self.assertNotIn("NOTE-PRIVEE-HUMEUR", str(listed.data))

    def test_admin_sees_real_checkins_without_notes(self):
        self.client.force_authenticate(self.admin)
        listed = self.client.get(self.list_url)
        stats = self.client.get(self.stats_url)

        self.assertEqual(listed.status_code, status.HTTP_200_OK)
        self.assertEqual(stats.status_code, status.HTTP_200_OK)
        self.assertEqual(listed.data["count"], 2)
        self.assertEqual(stats.data["total"], 2)
        self.assertEqual(stats.data["users_with_checkins"], 2)
        self.assertEqual(stats.data["average_intensity"], 3.0)
        self.assertIn(stats.data["dominant_mood"], ["Stressé", "Calme"])
        self.assertEqual(stats.data["dominant_count"], 1)

        payload = str(listed.data)
        self.assertNotIn("NOTE-PRIVEE-HUMEUR", payload)
        self.assertNotIn("note", listed.data["results"][0])
        owners = {row["username"] for row in listed.data["results"]}
        self.assertEqual(owners, {"moodowner", "moodother"})
        noted = next(row for row in listed.data["results"] if row["username"] == "moodowner")
        empty = next(row for row in listed.data["results"] if row["username"] == "moodother")
        self.assertTrue(noted["has_note"])
        self.assertFalse(empty["has_note"])
        self.assertEqual(sum(point["count"] for point in stats.data["daily"]), 2)
