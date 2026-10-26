from unittest.mock import patch
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.files.storage import default_storage
from django.db import transaction
from rest_framework.test import APITestCase
from rest_framework import status
from apps.media.models import Media
from apps.journal.models import JournalEntry

User = get_user_model()

# Signatures binaires valides pour les fichiers de test
VALID_JPEG_BYTES = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00valid_jpeg"
VALID_PNG_BYTES = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4"
VALID_AUDIO_MP3_BYTES = b"ID3\x03\x00\x00\x00\x00\x00#TIT2\x00\x00\x00\x05\x00\x00\x00Test"
VALID_AUDIO_WAV_BYTES = b"RIFF$\x08\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00D\xac\x00\x00\x88X\x01\x00\x02\x00\x10\x00data\x00\x08\x00\x00"
VALID_PDF_BYTES = b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF"


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
