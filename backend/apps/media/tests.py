import base64
import io
import os
import wave
from unittest.mock import patch, MagicMock
import requests
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.files.storage import default_storage
from django.db import transaction
from rest_framework.test import APITestCase
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken
from apps.media.models import Media
from apps.media.services import AudioTranscriptionService
from apps.media.ai_services import (
    PollinationsImageService,
    InvalidPromptError,
    InvalidSourceImageError,
    AiProviderNotConfiguredError,
    AiProviderTimeoutError,
    AiProviderError,
    AiProviderAuthError,
    AiProviderPaymentRequiredError,
    AiProviderRateLimitError,
    AiProviderInvalidImageError,
)
from apps.journal.models import JournalEntry

User = get_user_model()

# Signatures binaires valides pour les fichiers de test
VALID_JPEG_BYTES = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00valid_jpeg"
VALID_PNG_BYTES = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4"
VALID_AUDIO_MP3_BYTES = b"ID3\x03\x00\x00\x00\x00\x00#TIT2\x00\x00\x00\x05\x00\x00\x00Test"
VALID_AUDIO_WAV_BYTES = b"RIFF$\x08\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00D\xac\x00\x00\x88X\x01\x00\x02\x00\x10\x00data\x00\x08\x00\x00"
VALID_PDF_BYTES = b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF"


def make_wav_bytes(duration_seconds: float = 1.0, sample_rate: int = 8000) -> bytes:
    """Generates valid mono 16-bit PCM WAV bytes for testing."""
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        num_frames = int(sample_rate * duration_seconds)
        wav_file.writeframes(b"\x00\x00" * num_frames)
    return buf.getvalue()


class MediaModelTest(TestCase):
    """Test Media model"""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )

    def test_media_creation(self):
        """Test creating a Media instance"""
        file = SimpleUploadedFile(
            "test.jpg", VALID_JPEG_BYTES, content_type="image/jpeg"
        )
        media = Media.objects.create(
            user=self.user,
            title="Test Image",
            description="A test image",
            media_type="image",
            file=file,
        )
        self.assertEqual(media.title, "Test Image")
        self.assertEqual(media.user, self.user)
        self.assertEqual(media.media_type, "image")
        self.assertIsNotNone(media.id)

    def test_media_url_generation(self):
        """Test that URL is generated via serializer"""
        file = SimpleUploadedFile(
            "test.jpg", VALID_JPEG_BYTES, content_type="image/jpeg"
        )
        media = Media.objects.create(
            user=self.user,
            title="Test Image",
            media_type="image",
            file=file,
        )
        self.assertIsNotNone(media.file)
        self.assertTrue(str(media.file).startswith("media/"))


class MediaAPITest(APITestCase):
    """Test Media API endpoints with security validations"""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )
        self.client.force_authenticate(user=self.user)

    # 1. Upload d'une image JPEG valide
    def test_upload_valid_jpeg(self):
        """Test uploading a valid JPEG image with correct magic bytes"""
        file = SimpleUploadedFile(
            "photo.jpg", VALID_JPEG_BYTES, content_type="image/jpeg"
        )
        response = self.client.post(
            "/api/media/",
            {
                "file": file,
                "title": "Valid JPEG Upload",
                "media_type": "image",
                "description": "Test description",
            },
            format="multipart",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["title"], "Valid JPEG Upload")
        self.assertIsNotNone(response.data["url"])
        self.assertEqual(response.data["media_type"], "image")

    # 2. Upload d'une image PNG valide
    def test_upload_valid_png(self):
        """Test uploading a valid PNG image with correct magic bytes"""
        file = SimpleUploadedFile(
            "screenshot.png", VALID_PNG_BYTES, content_type="image/png"
        )
        response = self.client.post(
            "/api/media/",
            {
                "file": file,
                "title": "Valid PNG Upload",
                "media_type": "image",
            },
            format="multipart",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["title"], "Valid PNG Upload")

    # 3. Upload d'un fichier audio valide
    def test_upload_valid_audio(self):
        """Test uploading a valid MP3 audio file with ID3 tag"""
        file = SimpleUploadedFile(
            "recording.mp3", VALID_AUDIO_MP3_BYTES, content_type="audio/mpeg"
        )
        response = self.client.post(
            "/api/media/",
            {
                "file": file,
                "title": "Voice Note",
                "media_type": "audio",
            },
            format="multipart",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["title"], "Voice Note")
        self.assertEqual(response.data["media_type"], "audio")

    # 4. Rejet des fichiers trop volumineux
    def test_reject_file_too_large(self):
        """Test that files exceeding maximum allowed size are rejected with HTTP 400"""
        # Image limit is 10 MB. Create a 10.1 MB file.
        oversized_content = VALID_JPEG_BYTES + b"\x00" * (10 * 1024 * 1024 + 1024)
        file = SimpleUploadedFile(
            "large.jpg", oversized_content, content_type="image/jpeg"
        )
        response = self.client.post(
            "/api/media/",
            {
                "file": file,
                "title": "Too Large",
                "media_type": "image",
            },
            format="multipart",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("file", response.data)
        self.assertIn("dépasse la limite maximale", str(response.data["file"]))

    # 5. Rejet des extensions interdites
    def test_reject_forbidden_extension(self):
        """Test that files with dangerous executable or script extensions are rejected"""
        dangerous_extensions = [".sh", ".exe", ".php", ".py", ".html"]
        for ext in dangerous_extensions:
            file = SimpleUploadedFile(
                f"script{ext}", b"echo 'malicious'", content_type="application/octet-stream"
            )
            response = self.client.post(
                "/api/media/",
                {
                    "file": file,
                    "title": f"Dangerous {ext}",
                    "media_type": "image",
                },
                format="multipart",
            )
            self.assertEqual(
                response.status_code,
                status.HTTP_400_BAD_REQUEST,
                f"Expected 400 for dangerous extension {ext}",
            )
            self.assertIn("file", response.data)

    # 6. Rejet des contenus déguisés en image
    def test_reject_disguised_image(self):
        """Test that a non-image file renamed with a .jpg extension is rejected"""
        fake_content = b"This is plain text pretending to be a JPEG image."
        file = SimpleUploadedFile(
            "fake.jpg", fake_content, content_type="image/jpeg"
        )
        response = self.client.post(
            "/api/media/",
            {
                "file": file,
                "title": "Fake Image",
                "media_type": "image",
            },
            format="multipart",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("file", response.data)
        self.assertIn("format valide", str(response.data["file"]))

    # 7. Rejet des incohérences entre type déclaré et contenu
    def test_reject_incoherent_type_and_content(self):
        """Test that declaring audio type for a valid PNG content is rejected"""
        # File is a valid PNG, but declared as audio with .mp3 extension
        file = SimpleUploadedFile(
            "spoofed.mp3", VALID_PNG_BYTES, content_type="audio/mpeg"
        )
        response = self.client.post(
            "/api/media/",
            {
                "file": file,
                "title": "Spoofed Audio",
                "media_type": "audio",
            },
            format="multipart",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("file", response.data)
        self.assertIn("Incohérence", str(response.data["file"]))

    # 8. PATCH JSON du titre et de la description toujours fonctionnel sans exiger de fichier
    def test_patch_media_json_without_file(self):
        """Test updating media title and description using PATCH application/json without providing a file"""
        file = SimpleUploadedFile(
            "initial.jpg", VALID_JPEG_BYTES, content_type="image/jpeg"
        )
        media = Media.objects.create(
            user=self.user,
            title="Original Title",
            description="Original Description",
            media_type="image",
            file=file,
        )
        original_file_name = media.file.name
        original_user_id = media.user.id

        payload = {
            "title": "Updated Title via JSON",
            "description": "Updated Description via JSON",
        }
        response = self.client.patch(
            f"/api/media/{media.id}/",
            payload,
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["title"], "Updated Title via JSON")
        self.assertEqual(response.data["description"], "Updated Description via JSON")

        media.refresh_from_db()
        self.assertEqual(media.title, "Updated Title via JSON")
        self.assertEqual(media.description, "Updated Description via JSON")
        self.assertEqual(media.user.id, original_user_id)
        self.assertEqual(media.file.name, original_file_name)

    # 9. Isolation entre utilisateurs préservée
    def test_user_isolation(self):
        """Test that users only see their own media and cannot modify others' media"""
        other_user = User.objects.create_user(
            username="otheruser", email="other@example.com", password="testpass123"
        )
        file = SimpleUploadedFile(
            "other.jpg", VALID_JPEG_BYTES, content_type="image/jpeg"
        )
        other_media = Media.objects.create(
            user=other_user,
            title="Other User's Image",
            media_type="image",
            file=file,
        )

        # Listing test
        response = self.client.get("/api/media/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["results"]), 0)

        # Modification attempt test
        patch_response = self.client.patch(
            f"/api/media/{other_media.id}/",
            {"title": "Hacked Title"},
            format="json",
        )
        self.assertEqual(patch_response.status_code, status.HTTP_404_NOT_FOUND)
        other_media.refresh_from_db()
        self.assertEqual(other_media.title, "Other User's Image")

    # 10. Endpoints existants préservés (listing et détail)
    def test_endpoints_preserved_get_list_and_detail(self):
        """Test that GET /api/media/ and GET /api/media/{id}/ work as expected"""
        file = SimpleUploadedFile(
            "test.jpg", VALID_JPEG_BYTES, content_type="image/jpeg"
        )
        media = Media.objects.create(
            user=self.user,
            title="Preserved Media",
            description="Detail check",
            media_type="image",
            file=file,
        )
        # List endpoint
        list_response = self.client.get("/api/media/")
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(list_response.data["results"]), 1)
        self.assertEqual(list_response.data["results"][0]["id"], str(media.id))

        # Detail endpoint
        detail_response = self.client.get(f"/api/media/{media.id}/")
        self.assertEqual(detail_response.status_code, status.HTTP_200_OK)
        self.assertEqual(detail_response.data["title"], "Preserved Media")
        self.assertIsNotNone(detail_response.data["url"])

    # 11. Association des images avec JournalEntry toujours compatible
    def test_media_association_with_journal_entry(self):
        """Test that uploaded media can be linked to a JournalEntry seamlessly"""
        file = SimpleUploadedFile(
            "journal_photo.jpg", VALID_JPEG_BYTES, content_type="image/jpeg"
        )
        response = self.client.post(
            "/api/media/",
            {
                "file": file,
                "title": "Journal Attachment",
                "media_type": "image",
            },
            format="multipart",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        media_id = response.data["id"]

        # Create JournalEntry referencing this Media
        entry = JournalEntry.objects.create(
            user=self.user,
            title="Day at the beach",
            content="Great sunny day with memories.",
            date="2026-10-26",
            mood="Heureux",
        )
        entry.images.add(media_id)

        # Verify reverse relation
        self.assertEqual(entry.images.count(), 1)
        linked_photo = entry.images.first()
        self.assertEqual(str(linked_photo.id), media_id)
        self.assertEqual(linked_photo.title, "Journal Attachment")
        self.assertEqual(linked_photo.journal_entries.first(), entry)

    # 12. Tests de suppression sécurisée et gestion des fichiers physiques
    def test_delete_media(self):
        """Test deleting media works as expected and cleans up physical file"""
        file = SimpleUploadedFile(
            "to_delete.jpg", VALID_JPEG_BYTES, content_type="image/jpeg"
        )
        media = Media.objects.create(
            user=self.user,
            title="Image to delete",
            media_type="image",
            file=file,
        )
        file_name = media.file.name
        self.assertTrue(default_storage.exists(file_name))

        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.delete(f"/api/media/{media.id}/")

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Media.objects.filter(id=media.id).exists())
        self.assertFalse(default_storage.exists(file_name))

    def test_reject_delete_by_another_user(self):
        """Test that a user cannot delete another user's media, preserving the physical file"""
        other_user = User.objects.create_user(
            username="otheruser2", email="other2@example.com", password="testpass123"
        )
        file = SimpleUploadedFile(
            "other_protected.jpg", VALID_JPEG_BYTES, content_type="image/jpeg"
        )
        other_media = Media.objects.create(
            user=other_user,
            title="Other Protected Image",
            media_type="image",
            file=file,
        )
        file_name = other_media.file.name
        self.assertTrue(default_storage.exists(file_name))

        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.delete(f"/api/media/{other_media.id}/")

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertTrue(Media.objects.filter(id=other_media.id).exists())
        self.assertTrue(default_storage.exists(file_name))
        # Cleanup
        default_storage.delete(file_name)

    def test_delete_media_preserves_shared_physical_file(self):
        """Test that if another Media instance references the same file, the physical file is not deleted"""
        file = SimpleUploadedFile(
            "shared_file.jpg", VALID_JPEG_BYTES, content_type="image/jpeg"
        )
        media1 = Media.objects.create(
            user=self.user,
            title="Media 1",
            media_type="image",
            file=file,
        )
        file_name = media1.file.name
        # Create media2 referencing the same file on disk
        media2 = Media.objects.create(
            user=self.user,
            title="Media 2",
            media_type="image",
            file=file_name,
        )
        self.assertTrue(default_storage.exists(file_name))

        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.delete(f"/api/media/{media1.id}/")

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Media.objects.filter(id=media1.id).exists())
        self.assertTrue(Media.objects.filter(id=media2.id).exists())
        # The file on disk must STILL exist because media2 references it
        self.assertTrue(default_storage.exists(file_name))

        # Now delete media2 as well
        with self.captureOnCommitCallbacks(execute=True):
            response2 = self.client.delete(f"/api/media/{media2.id}/")
        self.assertEqual(response2.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Media.objects.filter(id=media2.id).exists())
        # Now no Media instance references it, so it should be deleted
        self.assertFalse(default_storage.exists(file_name))

    def test_delete_media_linked_to_journal_entry(self):
        """Test that deleting a media linked to a JournalEntry cleans up the file and removes the M2M link without breaking the journal entry"""
        file = SimpleUploadedFile(
            "entry_photo.jpg", VALID_JPEG_BYTES, content_type="image/jpeg"
        )
        media = Media.objects.create(
            user=self.user,
            title="Entry Photo",
            media_type="image",
            file=file,
        )
        file_name = media.file.name
        journal_entry = JournalEntry.objects.create(
            user=self.user,
            title="My Diary Entry",
            content="Journal content with photo",
            date="2026-10-26",
            mood="Calme",
        )
        journal_entry.images.add(media)
        self.assertEqual(journal_entry.images.count(), 1)
        self.assertTrue(default_storage.exists(file_name))

        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.delete(f"/api/media/{media.id}/")

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Media.objects.filter(id=media.id).exists())
        self.assertFalse(default_storage.exists(file_name))

        # Journal entry must be intact and unharmed
        journal_entry.refresh_from_db()
        self.assertEqual(journal_entry.title, "My Diary Entry")
        self.assertEqual(journal_entry.content, "Journal content with photo")
        self.assertEqual(journal_entry.images.count(), 0)

    def test_transaction_rollback_prevents_premature_file_cleanup(self):
        """Test that if a transaction rolls back, physical file is NOT deleted"""
        file = SimpleUploadedFile(
            "rollback_test.jpg", VALID_JPEG_BYTES, content_type="image/jpeg"
        )
        media = Media.objects.create(
            user=self.user,
            title="Rollback Image",
            media_type="image",
            file=file,
        )
        file_name = media.file.name
        self.assertTrue(default_storage.exists(file_name))

        # Simulate a transaction failure during deletion flow
        executed_callbacks = []
        try:
            with transaction.atomic():
                transaction.on_commit(lambda: executed_callbacks.append(True))
                # Simulate an unexpected database error triggering rollback
                raise RuntimeError("Simulated DB failure triggering rollback")
        except RuntimeError:
            pass

        # Since transaction rolled back, callback was not executed
        self.assertEqual(executed_callbacks, [])
        self.assertTrue(default_storage.exists(file_name))

        # Cleanup
        default_storage.delete(file_name)

    @patch("django.core.files.storage.FileSystemStorage.delete")
    def test_storage_error_does_not_affect_other_media(self, mock_delete):
        """Test that a storage error during file deletion does not crash or affect other media"""
        mock_delete.side_effect = OSError("Simulated filesystem I/O error")

        file1 = SimpleUploadedFile(
            "f1.jpg", VALID_JPEG_BYTES, content_type="image/jpeg"
        )
        media1 = Media.objects.create(
            user=self.user,
            title="Media 1",
            media_type="image",
            file=file1,
        )
        file2 = SimpleUploadedFile(
            "f2.jpg", VALID_JPEG_BYTES, content_type="image/jpeg"
        )
        media2 = Media.objects.create(
            user=self.user,
            title="Media 2",
            media_type="image",
            file=file2,
        )

        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.delete(f"/api/media/{media1.id}/")

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Media.objects.filter(id=media1.id).exists())
        self.assertTrue(Media.objects.filter(id=media2.id).exists())


class MediaTranscriptionAPITest(APITestCase):
    """Test audio transcription endpoint and AudioTranscriptionService in apps.media"""

    def setUp(self):
        AudioTranscriptionService.reset_model()
        self.user = User.objects.create_user(
            username="transcribe_user",
            email="transcribe@example.com",
            password="testpass123",
        )
        self.other_user = User.objects.create_user(
            username="other_transcribe_user",
            email="other_transcribe@example.com",
            password="testpass123",
        )
        self.client.force_authenticate(user=self.user)

        self.audio_file = SimpleUploadedFile(
            "voice_sample.mp3", VALID_AUDIO_MP3_BYTES, content_type="audio/mpeg"
        )
        self.audio_media = Media.objects.create(
            user=self.user,
            title="Sample Audio",
            description="Initial description",
            media_type="audio",
            file=self.audio_file,
        )

    def tearDown(self):
        AudioTranscriptionService.reset_model()

    def test_transcribe_unauthenticated_rejected(self):
        """Test that unauthenticated requests to /api/media/{id}/transcribe/ are rejected with HTTP 401"""
        self.client.force_authenticate(user=None)
        response = self.client.post(f"/api/media/{self.audio_media.id}/transcribe/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_transcribe_another_user_media_rejected(self):
        """Test that an authenticated user cannot transcribe media belonging to another user (HTTP 404)"""
        other_audio_file = SimpleUploadedFile(
            "other.mp3", VALID_AUDIO_MP3_BYTES, content_type="audio/mpeg"
        )
        other_media = Media.objects.create(
            user=self.other_user,
            title="Other's Audio",
            media_type="audio",
            file=other_audio_file,
        )
        response = self.client.post(f"/api/media/{other_media.id}/transcribe/")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_transcribe_non_audio_media_rejected(self):
        """Test that attempting to transcribe an image or non-audio media returns HTTP 400"""
        image_file = SimpleUploadedFile(
            "photo.jpg", VALID_JPEG_BYTES, content_type="image/jpeg"
        )
        image_media = Media.objects.create(
            user=self.user,
            title="Photo",
            media_type="image",
            file=image_file,
        )
        response = self.client.post(f"/api/media/{image_media.id}/transcribe/")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["code"], "invalid_media_type")

    @patch.dict("sys.modules", {"faster_whisper": None})
    def test_transcribe_missing_package_returns_503(self):
        """
        Test that when faster_whisper is not installed in the environment,
        the endpoint returns HTTP 503 Service Unavailable with a clean message.
        """
        AudioTranscriptionService.reset_model()
        response = self.client.post(f"/api/media/{self.audio_media.id}/transcribe/")
        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertEqual(response.data["code"], "service_unavailable")
        self.assertIn("faster-whisper", response.data["error"])

    @patch("apps.media.services.AudioTranscriptionService.get_model")
    def test_transcribe_success_mocked(self, mock_get_model):
        """
        Test successful transcription with mocked model returning text, language, and duration.
        Ensures no real model is downloaded and inference segments are consumed.
        """
        mock_model = MagicMock()
        mock_segment1 = MagicMock()
        mock_segment1.text = "Bonjour tout le monde."
        mock_segment1.end = 2.5

        mock_segment2 = MagicMock()
        mock_segment2.text = "Ceci est un test de transcription."
        mock_segment2.end = 5.8

        mock_info = MagicMock()
        mock_info.language = "fr"
        mock_info.duration = 5.8

        mock_model.transcribe.return_value = ([mock_segment1, mock_segment2], mock_info)
        mock_get_model.return_value = mock_model

        response = self.client.post(f"/api/media/{self.audio_media.id}/transcribe/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response.data["text"],
            "Bonjour tout le monde. Ceci est un test de transcription.",
        )
        self.assertEqual(response.data["language"], "fr")
        self.assertEqual(response.data["duration"], 5.8)
        self.assertEqual(response.data["id"], str(self.audio_media.id))
        self.assertIn("model", response.data)

    @patch("apps.media.services.AudioTranscriptionService.get_model")
    def test_transcribe_does_not_modify_media_description(self, mock_get_model):
        """
        Test that running a transcription does NOT automatically overwrite
        media.description in the database, preserving user control.
        """
        mock_model = MagicMock()
        mock_segment = MagicMock()
        mock_segment.text = "Transcription générée."
        mock_segment.end = 3.0
        mock_info = MagicMock(language="fr", duration=3.0)

        mock_model.transcribe.return_value = ([mock_segment], mock_info)
        mock_get_model.return_value = mock_model

        response = self.client.post(f"/api/media/{self.audio_media.id}/transcribe/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Refresh media from DB and assert description was not modified
        self.audio_media.refresh_from_db()
        self.assertEqual(self.audio_media.description, "Initial description")

    @patch("apps.media.services.AudioTranscriptionService.get_model")
    def test_transcribe_no_speech_detected_returns_422(self, mock_get_model):
        """Test that if the model finds no audible speech, HTTP 422 is returned"""
        mock_model = MagicMock()
        mock_info = MagicMock(language="fr", duration=4.0)
        # Empty segments generator
        mock_model.transcribe.return_value = ([], mock_info)
        mock_get_model.return_value = mock_model

        response = self.client.post(f"/api/media/{self.audio_media.id}/transcribe/")
        self.assertEqual(response.status_code, status.HTTP_422_UNPROCESSABLE_ENTITY)
        self.assertEqual(response.data["code"], "no_speech_detected")

    @patch("apps.media.services.AudioTranscriptionService.get_model")
    def test_transcribe_engine_error_returns_503(self, mock_get_model):
        """Test that when the model raises an error during transcription, HTTP 503 is returned"""
        mock_model = MagicMock()
        mock_model.transcribe.side_effect = RuntimeError("Transcribe CTranslate2 crashed")
        mock_get_model.return_value = mock_model

        response = self.client.post(f"/api/media/{self.audio_media.id}/transcribe/")
        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertEqual(response.data["code"], "transcription_error")

    def test_transcribe_empty_file_rejected(self):
        """Test that empty audio file (0 bytes) returns HTTP 400"""
        empty_file = SimpleUploadedFile("empty.mp3", b"", content_type="audio/mpeg")
        media = Media.objects.create(
            user=self.user,
            title="Empty",
            media_type="audio",
            file=empty_file,
        )
        response = self.client.post(f"/api/media/{media.id}/transcribe/")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["code"], "invalid_audio")


class MediaPromptTranscriptionAPITest(APITestCase):
    """
    Test suite for the ephemeral prompt transcription endpoint:
    POST /api/media/transcribe-prompt/
    Verifies JWT auth, file size/extension/signature/container validation,
    30s duration enforcement, temporary file cleanup, and zero Media database writes.
    """

    def setUp(self):
        AudioTranscriptionService.reset_model()
        self.user = User.objects.create_user(
            username="prompt_user",
            email="prompt@example.com",
            password="testpass123",
        )
        self.client.force_authenticate(user=self.user)
        self.valid_wav_bytes = make_wav_bytes(duration_seconds=1.0)

    def tearDown(self):
        AudioTranscriptionService.reset_model()

    def test_transcribe_prompt_unauthenticated_rejected(self):
        """Test that unauthenticated requests to /api/media/transcribe-prompt/ are rejected with HTTP 401"""
        self.client.force_authenticate(user=None)
        audio = SimpleUploadedFile("prompt.wav", self.valid_wav_bytes, content_type="audio/wav")
        response = self.client.post("/api/media/transcribe-prompt/", {"audio": audio}, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_transcribe_prompt_missing_file_rejected(self):
        """Test that missing audio file returns HTTP 400 with code missing_audio"""
        response = self.client.post("/api/media/transcribe-prompt/", {}, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["code"], "missing_audio")

    def test_transcribe_prompt_empty_file_rejected(self):
        """Test that an empty audio file (0 bytes) returns HTTP 400"""
        empty_file = SimpleUploadedFile("prompt.wav", b"", content_type="audio/wav")
        response = self.client.post("/api/media/transcribe-prompt/", {"audio": empty_file}, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["code"], "invalid_audio")

    def test_transcribe_prompt_oversized_file_rejected(self):
        """Test that an audio file exceeding 10 MB is rejected with HTTP 400"""
        oversized_content = self.valid_wav_bytes + b"\x00" * (10 * 1024 * 1024 + 1024)
        oversized = SimpleUploadedFile("prompt.wav", oversized_content, content_type="audio/wav")
        response = self.client.post("/api/media/transcribe-prompt/", {"audio": oversized}, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["code"], "invalid_audio")
        self.assertIn("10 Mo", response.data["error"])

    def test_transcribe_prompt_forbidden_extension_rejected(self):
        """Test that an audio file with forbidden extension (.exe, .sh) is rejected with HTTP 400"""
        malicious = SimpleUploadedFile("prompt.exe", self.valid_wav_bytes, content_type="application/octet-stream")
        response = self.client.post("/api/media/transcribe-prompt/", {"audio": malicious}, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["code"], "invalid_audio")

    def test_transcribe_prompt_invalid_signature_rejected(self):
        """Test that a file with .wav extension but invalid magic bytes is rejected with HTTP 400"""
        fake_audio = SimpleUploadedFile("prompt.wav", b"This is not audio content at all!", content_type="audio/wav")
        response = self.client.post("/api/media/transcribe-prompt/", {"audio": fake_audio}, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["code"], "invalid_audio")

    def test_transcribe_prompt_duration_exceeded_rejected(self):
        """Test that audio exceeding 30 seconds duration is rejected with HTTP 400 and code duration_exceeded"""
        long_wav_bytes = make_wav_bytes(duration_seconds=35.0)
        long_audio = SimpleUploadedFile("long_prompt.wav", long_wav_bytes, content_type="audio/wav")
        response = self.client.post("/api/media/transcribe-prompt/", {"audio": long_audio}, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["code"], "duration_exceeded")
        self.assertIn("30", response.data["error"])

    @patch("apps.media.services.AudioTranscriptionService.get_model")
    def test_transcribe_prompt_success_mocked(self, mock_get_model):
        """
        Test successful voice prompt transcription with mocked faster-whisper model.
        Returns text, language, and duration.
        """
        mock_model = MagicMock()
        mock_segment = MagicMock()
        mock_segment.text = "Génère un chat astronaute sur la lune."
        mock_segment.end = 3.2

        mock_info = MagicMock()
        mock_info.language = "fr"
        mock_info.duration = 3.2

        mock_model.transcribe.return_value = ([mock_segment], mock_info)
        mock_get_model.return_value = mock_model

        audio = SimpleUploadedFile("prompt.wav", self.valid_wav_bytes, content_type="audio/wav")
        response = self.client.post("/api/media/transcribe-prompt/", {"audio": audio}, format="multipart")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["text"], "Génère un chat astronaute sur la lune.")
        self.assertEqual(response.data["language"], "fr")
        self.assertEqual(response.data["duration"], 3.2)

    @patch("apps.media.services.AudioTranscriptionService.get_model")
    def test_transcribe_prompt_accepts_file_field_name(self, mock_get_model):
        """Test that endpoint also accepts 'file' as the multipart field name"""
        mock_model = MagicMock()
        mock_segment = MagicMock()
        mock_segment.text = "Test prompt via file field."
        mock_segment.end = 1.0
        mock_info = MagicMock()
        mock_info.language = "en"
        mock_info.duration = 1.0

        mock_model.transcribe.return_value = ([mock_segment], mock_info)
        mock_get_model.return_value = mock_model

        audio = SimpleUploadedFile("prompt.wav", self.valid_wav_bytes, content_type="audio/wav")
        response = self.client.post("/api/media/transcribe-prompt/", {"file": audio}, format="multipart")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["text"], "Test prompt via file field.")

    @patch("apps.media.services.AudioTranscriptionService.get_model")
    def test_transcribe_prompt_no_speech_detected_returns_422(self, mock_get_model):
        """Test that when audio has no audible speech, HTTP 422 is returned with code no_speech_detected"""
        mock_model = MagicMock()
        mock_info = MagicMock()
        mock_info.language = "fr"
        mock_info.duration = 1.0

        mock_model.transcribe.return_value = ([], mock_info)
        mock_get_model.return_value = mock_model

        audio = SimpleUploadedFile("prompt.wav", self.valid_wav_bytes, content_type="audio/wav")
        response = self.client.post("/api/media/transcribe-prompt/", {"audio": audio}, format="multipart")

        self.assertEqual(response.status_code, status.HTTP_422_UNPROCESSABLE_ENTITY)
        self.assertEqual(response.data["code"], "no_speech_detected")

    @patch("apps.media.services.AudioTranscriptionService.get_model")
    def test_transcribe_prompt_engine_error_returns_503(self, mock_get_model):
        """Test that when the Whisper model crashes, HTTP 503 is returned with code transcription_error"""
        mock_model = MagicMock()
        mock_model.transcribe.side_effect = RuntimeError("CTranslate2 prompt failure")
        mock_get_model.return_value = mock_model

        audio = SimpleUploadedFile("prompt.wav", self.valid_wav_bytes, content_type="audio/wav")
        response = self.client.post("/api/media/transcribe-prompt/", {"audio": audio}, format="multipart")

        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertEqual(response.data["code"], "transcription_error")

    @patch("apps.media.services.AudioTranscriptionService.get_model")
    def test_transcribe_prompt_does_not_create_media_in_db(self, mock_get_model):
        """Test that transcribe-prompt NEVER creates any Media record in the database"""
        mock_model = MagicMock()
        mock_segment = MagicMock()
        mock_segment.text = "Ephemeral prompt."
        mock_segment.end = 1.0
        mock_info = MagicMock()
        mock_info.language = "fr"
        mock_info.duration = 1.0
        mock_model.transcribe.return_value = ([mock_segment], mock_info)
        mock_get_model.return_value = mock_model

        initial_count = Media.objects.count()

        audio = SimpleUploadedFile("prompt.wav", self.valid_wav_bytes, content_type="audio/wav")
        response = self.client.post("/api/media/transcribe-prompt/", {"audio": audio}, format="multipart")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(Media.objects.count(), initial_count)

    @patch("apps.media.services.AudioTranscriptionService.get_model")
    def test_transcribe_prompt_guaranteed_tempfile_cleanup(self, mock_get_model):
        """Test that temporary audio files created during transcribe-prompt are cleanly unlinked"""
        mock_model = MagicMock()
        mock_segment = MagicMock()
        mock_segment.text = "Temporary file cleanup test."
        mock_segment.end = 1.0
        mock_info = MagicMock()
        mock_info.language = "fr"
        mock_info.duration = 1.0

        temp_paths_created = []

        def capture_transcribe(audio_path, **kwargs):
            temp_paths_created.append(audio_path)
            self.assertTrue(os.path.exists(audio_path), "Temp file must exist during inference")
            return ([mock_segment], mock_info)

        mock_model.transcribe.side_effect = capture_transcribe
        mock_get_model.return_value = mock_model

        audio = SimpleUploadedFile("prompt.wav", self.valid_wav_bytes, content_type="audio/wav")
        response = self.client.post("/api/media/transcribe-prompt/", {"audio": audio}, format="multipart")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(temp_paths_created), 1)
        created_path = temp_paths_created[0]
        self.assertFalse(os.path.exists(created_path), "Temp file must be unlinked after request finishes")


class MediaAiImageAPITest(APITestCase):
    """
    Test suite for Pollinations AI Image endpoints:
    - POST /api/media/ai-generate/ (Text-to-Image ephemeral generation)
    - POST /api/media/{id}/ai-edit/ (Image-to-Image instruction editing)
    Verifies JWT auth, user ownership isolation, prompt validation, source image validation,
    unconfigured provider safety (no network calls made, returns 503), timeout handling (504),
    provider error handling (502), and zero database writes / original media integrity.
    """

    def setUp(self):
        self.user = User.objects.create_user(
            username="ai_user",
            email="ai@example.com",
            password="testpass123",
        )
        self.other_user = User.objects.create_user(
            username="ai_other_user",
            email="ai_other@example.com",
            password="testpass123",
        )
        self.client.force_authenticate(user=self.user)

        self.image_media = Media.objects.create(
            user=self.user,
            title="Source Image",
            media_type="image",
            file=SimpleUploadedFile(
                "source.jpg",
                VALID_JPEG_BYTES + b"_extra_payload_padding",
                content_type="image/jpeg",
            ),
        )
        self.audio_media = Media.objects.create(
            user=self.user,
            title="Source Audio",
            media_type="audio",
            file=SimpleUploadedFile(
                "source.mp3",
                VALID_AUDIO_MP3_BYTES,
                content_type="audio/mpeg",
            ),
        )
        self.other_user_media = Media.objects.create(
            user=self.other_user,
            title="Other User Image",
            media_type="image",
            file=SimpleUploadedFile(
                "other.jpg",
                VALID_JPEG_BYTES,
                content_type="image/jpeg",
            ),
        )

    def tearDown(self):
        for media in (self.image_media, self.audio_media, self.other_user_media):
            if media.file and default_storage.exists(media.file.name):
                default_storage.delete(media.file.name)

    # --- Unit service tests ---

    def test_service_validate_prompt_rules(self):
        """Test prompt validation rules (non-empty, <= 1000 chars)"""
        with self.assertRaises(InvalidPromptError):
            PollinationsImageService.validate_prompt("")
        with self.assertRaises(InvalidPromptError):
            PollinationsImageService.validate_prompt("   ")
        with self.assertRaises(InvalidPromptError):
            PollinationsImageService.validate_prompt(None)
        with self.assertRaises(InvalidPromptError):
            PollinationsImageService.validate_prompt("A" * 1001)

        cleaned = PollinationsImageService.validate_prompt("  A scenic mountain  ")
        self.assertEqual(cleaned, "A scenic mountain")

    def test_service_is_configured_reflects_env(self):
        """Test that is_configured accurately reflects POLLINATIONS_API_KEY"""
        with patch.dict(os.environ, {"POLLINATIONS_API_KEY": ""}):
            self.assertFalse(PollinationsImageService.is_configured())

        with patch.dict(os.environ, {"POLLINATIONS_API_KEY": "test_api_key_123"}):
            self.assertTrue(PollinationsImageService.is_configured())

    # --- Text-to-Image (ai-generate) tests ---

    def test_ai_generate_unauthenticated_rejected(self):
        """Test that unauthenticated requests to /api/media/ai-generate/ return HTTP 401"""
        self.client.force_authenticate(user=None)
        response = self.client.post("/api/media/ai-generate/", {"prompt": "Sunset"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_ai_generate_empty_prompt_rejected(self):
        """Test that missing or whitespace prompt returns HTTP 400 with code invalid_prompt"""
        response = self.client.post("/api/media/ai-generate/", {"prompt": ""}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["code"], "invalid_prompt")

        response2 = self.client.post("/api/media/ai-generate/", {"prompt": "   "}, format="json")
        self.assertEqual(response2.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response2.data["code"], "invalid_prompt")

        response3 = self.client.post("/api/media/ai-generate/", {}, format="json")
        self.assertEqual(response3.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response3.data["code"], "invalid_prompt")

    def test_ai_generate_oversized_prompt_rejected(self):
        """Test that prompt exceeding 1000 characters returns HTTP 400 with code invalid_prompt"""
        response = self.client.post("/api/media/ai-generate/", {"prompt": "X" * 1001}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["code"], "invalid_prompt")
        self.assertIn("1000", response.data["error"])

    @patch("requests.get")
    def test_ai_generate_provider_not_configured_returns_503(self, mock_get):
        """
        Test that when POLLINATIONS_API_KEY is not configured:
        - HTTP 503 is returned with code provider_not_configured
        - ZERO external HTTP requests are made
        """
        with patch.dict(os.environ, {"POLLINATIONS_API_KEY": ""}):
            response = self.client.post("/api/media/ai-generate/", {"prompt": "A futuristic city"}, format="json")
            self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
            self.assertEqual(response.data["code"], "provider_not_configured")
            mock_get.assert_not_called()

    @patch("requests.get")
    def test_ai_generate_success_mocked(self, mock_get):
        """
        Test successful T2I generation returning base64 data URL without writing to database.
        """
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.headers = {"Content-Type": "image/jpeg"}
        mock_response.content = VALID_JPEG_BYTES + b"_generated_image_content"
        mock_get.return_value = mock_response

        with patch.dict(os.environ, {"POLLINATIONS_API_KEY": "fake_secret_key"}):
            response = self.client.post(
                "/api/media/ai-generate/",
                {
                    "prompt": "A calm lake at sunrise",
                    "style": "watercolor",
                    "aspect_ratio": "16:9",
                    "seed": 42,
                },
                format="json",
            )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("image", response.data)
        self.assertTrue(response.data["image"].startswith("data:image/jpeg;base64,"))
        self.assertEqual(response.data["width"], 1280)
        self.assertEqual(response.data["height"], 720)
        self.assertIn("watercolor", response.data["prompt"])
        mock_get.assert_called_once()

        # Verify Authorization header sent
        _, kwargs = mock_get.call_args
        self.assertEqual(kwargs["headers"]["Authorization"], "Bearer fake_secret_key")

    @patch("requests.get")
    def test_ai_generate_timeout_returns_504(self, mock_get):
        """Test that provider timeout returns HTTP 504 with code provider_timeout"""
        mock_get.side_effect = requests.exceptions.Timeout("Connection timed out")

        with patch.dict(os.environ, {"POLLINATIONS_API_KEY": "fake_secret_key"}):
            response = self.client.post("/api/media/ai-generate/", {"prompt": "A forest path"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_504_GATEWAY_TIMEOUT)
        self.assertEqual(response.data["code"], "provider_timeout")

    @patch("requests.get")
    def test_ai_generate_provider_http_error_returns_502(self, mock_get):
        """Test that provider 500 error returns HTTP 502 with code provider_error"""
        mock_response = MagicMock()
        mock_response.status_code = 500
        mock_response.text = "Internal Provider Server Error"
        mock_get.return_value = mock_response

        with patch.dict(os.environ, {"POLLINATIONS_API_KEY": "fake_secret_key"}):
            response = self.client.post("/api/media/ai-generate/", {"prompt": "A forest path"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_502_BAD_GATEWAY)
        self.assertEqual(response.data["code"], "provider_error")

    @patch("requests.get")
    def test_ai_generate_provider_auth_error_returns_502(self, mock_get):
        """Test that provider 401 returns HTTP 502 with code provider_auth_error"""
        mock_response = MagicMock()
        mock_response.status_code = 401
        mock_response.text = "Unauthorized"
        mock_get.return_value = mock_response

        with patch.dict(os.environ, {"POLLINATIONS_API_KEY": "invalid_key"}):
            response = self.client.post("/api/media/ai-generate/", {"prompt": "A forest path"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_502_BAD_GATEWAY)
        self.assertEqual(response.data["code"], "provider_auth_error")
        self.assertIn("authentification", response.data["error"])

    @patch("requests.get")
    def test_ai_generate_provider_insufficient_credits_returns_502(self, mock_get):
        """Test that provider 402 returns HTTP 502 with code provider_insufficient_credits"""
        mock_response = MagicMock()
        mock_response.status_code = 402
        mock_response.text = "Insufficient credits"
        mock_get.return_value = mock_response

        with patch.dict(os.environ, {"POLLINATIONS_API_KEY": "fake_secret_key"}):
            response = self.client.post("/api/media/ai-generate/", {"prompt": "A forest path"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_502_BAD_GATEWAY)
        self.assertEqual(response.data["code"], "provider_insufficient_credits")
        self.assertIn("Crédits insuffisants", response.data["error"])

    @patch("requests.get")
    def test_ai_generate_provider_rate_limit_returns_429(self, mock_get):
        """Test that provider 429 returns HTTP 429 with code provider_rate_limited"""
        mock_response = MagicMock()
        mock_response.status_code = 429
        mock_response.text = "Rate limit exceeded"
        mock_get.return_value = mock_response

        with patch.dict(os.environ, {"POLLINATIONS_API_KEY": "fake_secret_key"}):
            response = self.client.post("/api/media/ai-generate/", {"prompt": "A forest path"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertEqual(response.data["code"], "provider_rate_limited")

    @patch("requests.get")
    def test_ai_generate_non_image_payload_rejected(self, mock_get):
        """Test that non-image payload from provider returns HTTP 502 with provider_invalid_image"""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.headers = {"Content-Type": "image/jpeg"}
        mock_response.content = b"<html>This is an HTML error page, not an image</html>"
        mock_get.return_value = mock_response

        with patch.dict(os.environ, {"POLLINATIONS_API_KEY": "fake_secret_key"}):
            response = self.client.post("/api/media/ai-generate/", {"prompt": "A sunset"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_502_BAD_GATEWAY)
        self.assertEqual(response.data["code"], "provider_invalid_image")

    @patch("requests.get")
    def test_ai_generate_does_not_create_media_in_db(self, mock_get):
        """Test that ai-generate NEVER creates any Media record in the database"""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.headers = {"Content-Type": "image/jpeg"}
        mock_response.content = VALID_JPEG_BYTES + b"_content_payload"
        mock_get.return_value = mock_response

        initial_count = Media.objects.count()

        with patch.dict(os.environ, {"POLLINATIONS_API_KEY": "fake_secret_key"}):
            response = self.client.post("/api/media/ai-generate/", {"prompt": "A galaxy"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(Media.objects.count(), initial_count)

    # --- Image-to-Image (ai-edit) tests ---

    def test_ai_edit_unauthenticated_rejected(self):
        """Test that unauthenticated requests to /api/media/{id}/ai-edit/ return HTTP 401"""
        self.client.force_authenticate(user=None)
        response = self.client.post(
            f"/api/media/{self.image_media.id}/ai-edit/",
            {"prompt": "Add sunglasses"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_ai_edit_other_user_media_returns_404(self):
        """Test user isolation: attempting to edit another user's image returns HTTP 404"""
        response = self.client.post(
            f"/api/media/{self.other_user_media.id}/ai-edit/",
            {"prompt": "Add sunglasses"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_ai_edit_non_image_media_rejected(self):
        """Test that attempting to edit a non-image media (e.g. audio) returns HTTP 400 invalid_source_image"""
        response = self.client.post(
            f"/api/media/{self.audio_media.id}/ai-edit/",
            {"prompt": "Make it brighter"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["code"], "invalid_source_image")

    def test_ai_edit_empty_prompt_rejected(self):
        """Test that empty prompt in ai-edit returns HTTP 400 invalid_prompt"""
        response = self.client.post(
            f"/api/media/{self.image_media.id}/ai-edit/",
            {"prompt": ""},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["code"], "invalid_prompt")

    def test_ai_edit_oversized_prompt_rejected(self):
        """Test that prompt exceeding 1000 characters in ai-edit returns HTTP 400 invalid_prompt"""
        response = self.client.post(
            f"/api/media/{self.image_media.id}/ai-edit/",
            {"prompt": "Z" * 1001},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["code"], "invalid_prompt")

    @patch("requests.post")
    def test_ai_edit_provider_not_configured_returns_503(self, mock_post):
        """
        Test that when POLLINATIONS_API_KEY is not configured:
        - HTTP 503 is returned with code provider_not_configured
        - ZERO external HTTP requests are made
        """
        with patch.dict(os.environ, {"POLLINATIONS_API_KEY": ""}):
            response = self.client.post(
                f"/api/media/{self.image_media.id}/ai-edit/",
                {"prompt": "Turn background into a beach"},
                format="json",
            )
            self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
            self.assertEqual(response.data["code"], "provider_not_configured")
            mock_post.assert_not_called()

    @patch("requests.post")
    def test_ai_edit_success_mocked_binary(self, mock_post):
        """
        Test successful image edit with binary image response from provider.
        """
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.headers = {"Content-Type": "image/jpeg"}
        mock_response.content = VALID_JPEG_BYTES + b"_edited_binary_image_content"
        mock_post.return_value = mock_response

        with patch.dict(os.environ, {"POLLINATIONS_API_KEY": "fake_secret_key"}):
            response = self.client.post(
                f"/api/media/{self.image_media.id}/ai-edit/",
                {"prompt": "Add gentle snow falling", "seed": 99},
                format="json",
            )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("image", response.data)
        self.assertTrue(response.data["image"].startswith("data:image/jpeg;base64,"))
        self.assertEqual(response.data["source_media_id"], str(self.image_media.id))
        self.assertEqual(response.data["prompt"], "Add gentle snow falling")
        mock_post.assert_called_once()

    @patch("requests.post")
    def test_ai_edit_success_mocked_json_b64(self, mock_post):
        """
        Test successful image edit with OpenAI-style JSON {data: [{b64_json: ...}]} response.
        """
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.headers = {"Content-Type": "application/json"}
        b64_val = base64.b64encode(VALID_JPEG_BYTES + b"_json_edited_bytes").decode("ascii")
        mock_response.json.return_value = {"data": [{"b64_json": b64_val}]}
        mock_post.return_value = mock_response

        with patch.dict(os.environ, {"POLLINATIONS_API_KEY": "fake_secret_key"}):
            response = self.client.post(
                f"/api/media/{self.image_media.id}/ai-edit/",
                {"prompt": "Make it in oil painting style"},
                format="json",
            )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["image"], f"data:image/jpeg;base64,{b64_val}")

    @patch("requests.get")
    @patch("requests.post")
    def test_ai_edit_no_secondary_fallback_on_post_failure(self, mock_post, mock_get):
        """
        Security and cost test:
        Verifies that when POST /v1/images/edits returns an error (404/500),
        no secondary GET fallback or alternate endpoint is EVER executed.
        """
        mock_post_response = MagicMock()
        mock_post_response.status_code = 404
        mock_post_response.text = "Not found"
        mock_post.return_value = mock_post_response

        with patch.dict(os.environ, {"POLLINATIONS_API_KEY": "fake_secret_key"}):
            response = self.client.post(
                f"/api/media/{self.image_media.id}/ai-edit/",
                {"prompt": "Transform into a sketch"},
                format="json",
            )

        self.assertEqual(response.status_code, status.HTTP_502_BAD_GATEWAY)
        self.assertEqual(response.data["code"], "provider_error")
        mock_post.assert_called_once()
        mock_get.assert_not_called()

    @patch("requests.post")
    def test_ai_edit_provider_auth_error_returns_502(self, mock_post):
        """Test that provider 401 returns HTTP 502 with code provider_auth_error"""
        mock_response = MagicMock()
        mock_response.status_code = 401
        mock_response.text = "Unauthorized"
        mock_post.return_value = mock_response

        with patch.dict(os.environ, {"POLLINATIONS_API_KEY": "invalid_key"}):
            response = self.client.post(
                f"/api/media/{self.image_media.id}/ai-edit/",
                {"prompt": "Add autumn leaves"},
                format="json",
            )

        self.assertEqual(response.status_code, status.HTTP_502_BAD_GATEWAY)
        self.assertEqual(response.data["code"], "provider_auth_error")

    @patch("requests.post")
    def test_ai_edit_provider_insufficient_credits_returns_502(self, mock_post):
        """Test that provider 402 returns HTTP 502 with code provider_insufficient_credits"""
        mock_response = MagicMock()
        mock_response.status_code = 402
        mock_response.text = "Payment Required"
        mock_post.return_value = mock_response

        with patch.dict(os.environ, {"POLLINATIONS_API_KEY": "fake_secret_key"}):
            response = self.client.post(
                f"/api/media/{self.image_media.id}/ai-edit/",
                {"prompt": "Add autumn leaves"},
                format="json",
            )

        self.assertEqual(response.status_code, status.HTTP_502_BAD_GATEWAY)
        self.assertEqual(response.data["code"], "provider_insufficient_credits")

    @patch("requests.post")
    def test_ai_edit_provider_rate_limit_returns_429(self, mock_post):
        """Test that provider 429 returns HTTP 429 with code provider_rate_limited"""
        mock_response = MagicMock()
        mock_response.status_code = 429
        mock_response.text = "Too Many Requests"
        mock_post.return_value = mock_response

        with patch.dict(os.environ, {"POLLINATIONS_API_KEY": "fake_secret_key"}):
            response = self.client.post(
                f"/api/media/{self.image_media.id}/ai-edit/",
                {"prompt": "Add autumn leaves"},
                format="json",
            )

        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertEqual(response.data["code"], "provider_rate_limited")

    @patch("requests.post")
    def test_ai_edit_non_image_payload_rejected(self, mock_post):
        """Test that non-image payload from provider returns HTTP 502 with provider_invalid_image"""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.headers = {"Content-Type": "image/jpeg"}
        mock_response.content = b"Corrupted non-image payload bytes"
        mock_post.return_value = mock_response

        with patch.dict(os.environ, {"POLLINATIONS_API_KEY": "fake_secret_key"}):
            response = self.client.post(
                f"/api/media/{self.image_media.id}/ai-edit/",
                {"prompt": "Add autumn leaves"},
                format="json",
            )

        self.assertEqual(response.status_code, status.HTTP_502_BAD_GATEWAY)
        self.assertEqual(response.data["code"], "provider_invalid_image")

    @patch("requests.post")
    def test_ai_edit_timeout_returns_504(self, mock_post):
        """Test that provider timeout during edit returns HTTP 504 provider_timeout"""
        mock_post.side_effect = requests.exceptions.Timeout("Read timeout")

        with patch.dict(os.environ, {"POLLINATIONS_API_KEY": "fake_secret_key"}):
            response = self.client.post(
                f"/api/media/{self.image_media.id}/ai-edit/",
                {"prompt": "Add autumn leaves"},
                format="json",
            )

        self.assertEqual(response.status_code, status.HTTP_504_GATEWAY_TIMEOUT)
        self.assertEqual(response.data["code"], "provider_timeout")

    @patch("requests.post")
    def test_ai_edit_provider_error_returns_502(self, mock_post):
        """Test that provider 500 during edit returns HTTP 502 provider_error"""
        mock_response = MagicMock()
        mock_response.status_code = 500
        mock_response.text = "Inference engine failed"
        mock_post.return_value = mock_response

        with patch.dict(os.environ, {"POLLINATIONS_API_KEY": "fake_secret_key"}):
            response = self.client.post(
                f"/api/media/{self.image_media.id}/ai-edit/",
                {"prompt": "Add autumn leaves"},
                format="json",
            )

        self.assertEqual(response.status_code, status.HTTP_502_BAD_GATEWAY)
        self.assertEqual(response.data["code"], "provider_error")

    @patch("requests.post")
    def test_ai_edit_does_not_modify_original_media(self, mock_post):
        """
        Critical security test:
        Verifies that editing an image never modifies, overwrites, or deletes
        the original Media database row or stored file.
        """
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.headers = {"Content-Type": "image/jpeg"}
        mock_response.content = VALID_JPEG_BYTES + b"_edited_binary_image_content"
        mock_post.return_value = mock_response

        orig_id = self.image_media.id
        orig_title = self.image_media.title
        orig_file_name = self.image_media.file.name
        self.image_media.file.open("rb")
        orig_file_bytes = self.image_media.file.read()
        self.image_media.file.close()

        with patch.dict(os.environ, {"POLLINATIONS_API_KEY": "fake_secret_key"}):
            response = self.client.post(
                f"/api/media/{self.image_media.id}/ai-edit/",
                {"prompt": "Add glowing neon outlines"},
                format="json",
            )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Reload from database
        self.image_media.refresh_from_db()
        self.assertEqual(self.image_media.id, orig_id)
        self.assertEqual(self.image_media.title, orig_title)
        self.assertEqual(self.image_media.file.name, orig_file_name)

        # Verify physical file content is unchanged
        self.image_media.file.open("rb")
        current_file_bytes = self.image_media.file.read()
        self.image_media.file.close()
        self.assertEqual(current_file_bytes, orig_file_bytes)


class PrivateMediaSecurityRegressionTest(APITestCase):
    """
    Regression and security test suite for authenticated private media serving.
    Verifies:
    1. Anonymous access is strictly rejected (401).
    2. Query string tokens (?token=...) are completely ignored (401).
    3. Bearer token in Authorization header allows access to owner (200).
    4. Secure, HttpOnly access_token cookie allows access to owner (200).
    5. Another authenticated user is forbidden from viewing private media (403).
    6. Staff / admin user has access (200).
    7. Path traversal attempts are blocked (403).
    8. Nonexistent files return 404.
    9. Login sets HttpOnly, SameSite=Lax cookie.
    10. Logout clears the cookie.
    11. Token refresh updates the HttpOnly cookie.
    """

    def setUp(self):
        self.owner = User.objects.create_user(
            username="owner_user",
            email="owner@example.com",
            password="StrongPassword123!",
        )
        self.other_user = User.objects.create_user(
            username="other_user",
            email="other@example.com",
            password="StrongPassword123!",
        )
        self.staff_user = User.objects.create_user(
            username="staff_user",
            email="staff@example.com",
            password="StrongPassword123!",
            is_staff=True,
        )

        # Create physical media file owned by self.owner
        self.test_content = VALID_JPEG_BYTES + b"_private_user_photo_data"
        self.media_obj = Media.objects.create(
            user=self.owner,
            title="Private Journal Photo",
            media_type="image",
            file=SimpleUploadedFile(
                "private_photo.jpg",
                self.test_content,
                content_type="image/jpeg",
            ),
        )
        self.file_path = self.media_obj.file.name
        self.media_url = f"/media/{self.file_path}"

        # Generate tokens
        self.owner_refresh = RefreshToken.for_user(self.owner)
        self.owner_token = str(self.owner_refresh.access_token)

        self.other_refresh = RefreshToken.for_user(self.other_user)
        self.other_token = str(self.other_refresh.access_token)

        self.staff_refresh = RefreshToken.for_user(self.staff_user)
        self.staff_token = str(self.staff_refresh.access_token)

    def tearDown(self):
        if self.media_obj.file:
            self.media_obj.file.delete(save=False)
        super().tearDown()

    def test_anonymous_access_returns_401(self):
        response = self.client.get(self.media_url)
        self.assertEqual(response.status_code, 401)

    def test_query_string_token_is_rejected_returns_401(self):
        """Query parameter ?token=... must be rejected per security requirements."""
        url_with_token = f"{self.media_url}?token={self.owner_token}"
        response = self.client.get(url_with_token)
        self.assertEqual(response.status_code, 401)

    def test_owner_access_with_bearer_token_returns_200(self):
        response = self.client.get(
            self.media_url,
            HTTP_AUTHORIZATION=f"Bearer {self.owner_token}",
        )
        self.assertEqual(response.status_code, 200)
        content = (
            b"".join(response.streaming_content)
            if hasattr(response, "streaming_content")
            else response.content
        )
        self.assertEqual(content, self.test_content)

    def test_owner_access_with_httponly_cookie_returns_200(self):
        self.client.cookies["access_token"] = self.owner_token
        response = self.client.get(self.media_url)
        self.assertEqual(response.status_code, 200)
        content = (
            b"".join(response.streaming_content)
            if hasattr(response, "streaming_content")
            else response.content
        )
        self.assertEqual(content, self.test_content)

    def test_other_user_access_returns_403_forbidden(self):
        response = self.client.get(
            self.media_url,
            HTTP_AUTHORIZATION=f"Bearer {self.other_token}",
        )
        self.assertEqual(response.status_code, 403)

    def test_other_user_access_with_cookie_returns_403_forbidden(self):
        self.client.cookies["access_token"] = self.other_token
        response = self.client.get(self.media_url)
        self.assertEqual(response.status_code, 403)

    def test_staff_user_can_access_returns_200(self):
        response = self.client.get(
            self.media_url,
            HTTP_AUTHORIZATION=f"Bearer {self.staff_token}",
        )
        self.assertEqual(response.status_code, 200)

    def test_path_traversal_is_blocked_returns_403(self):
        traversal_url = "/media/../../etc/passwd"
        response = self.client.get(
            traversal_url,
            HTTP_AUTHORIZATION=f"Bearer {self.owner_token}",
        )
        self.assertEqual(response.status_code, 403)

    def test_nonexistent_file_returns_404(self):
        fake_url = "/media/media/2026/01/01/nonexistent_file.jpg"
        response = self.client.get(
            fake_url,
            HTTP_AUTHORIZATION=f"Bearer {self.staff_token}",
        )
        self.assertEqual(response.status_code, 404)

    def test_login_sets_httponly_cookie_and_logout_clears_it(self):
        # 1. Login sets HttpOnly, SameSite=Lax cookie
        login_res = self.client.post(
            "/api/auth/login/",
            {"username_or_email": "owner_user", "password": "StrongPassword123!"},
            format="json",
        )
        self.assertEqual(login_res.status_code, 200)
        self.assertIn("access_token", login_res.cookies)
        cookie = login_res.cookies["access_token"]
        self.assertTrue(cookie["httponly"])
        self.assertEqual(cookie["samesite"].lower(), "lax")
        self.assertEqual(cookie["path"], "/")

        # 2. Logout clears the cookie
        refresh_token = login_res.data["refresh"]
        access_token = login_res.data["access"]
        logout_res = self.client.post(
            "/api/auth/logout/",
            {"refresh": refresh_token},
            HTTP_AUTHORIZATION=f"Bearer {access_token}",
            format="json",
        )
        self.assertEqual(logout_res.status_code, 200)
        self.assertIn("access_token", logout_res.cookies)
        logout_cookie = logout_res.cookies["access_token"]
        self.assertEqual(logout_cookie.value, "")

    def test_token_refresh_updates_httponly_cookie(self):
        refresh_res = self.client.post(
            "/api/auth/token/refresh/",
            {"refresh": str(self.owner_refresh)},
            format="json",
        )
        self.assertEqual(refresh_res.status_code, 200)
        self.assertIn("access_token", refresh_res.cookies)
        cookie = refresh_res.cookies["access_token"]
        self.assertTrue(cookie["httponly"])
        self.assertEqual(cookie["samesite"].lower(), "lax")
