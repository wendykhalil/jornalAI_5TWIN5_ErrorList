from django.test import TestCase
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APITestCase
from rest_framework import status
from apps.media.models import Media

User = get_user_model()


class MediaModelTest(TestCase):
    """Test Media model"""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )

    def test_media_creation(self):
        """Test creating a Media instance"""
        file = SimpleUploadedFile(
            "test.jpg", b"file_content", content_type="image/jpeg"
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
            "test.jpg", b"file_content", content_type="image/jpeg"
        )
        media = Media.objects.create(
            user=self.user,
            title="Test Image",
            media_type="image",
            file=file,
        )
        # URL should be generated via serializer during API calls
        # For direct model creation, test that file exists
        self.assertIsNotNone(media.file)
        self.assertTrue(str(media.file).startswith("media/"))


class MediaAPITest(APITestCase):
    """Test Media API endpoints"""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )
        self.client.force_authenticate(user=self.user)

    def test_upload_media(self):
        """Test uploading a file"""
        file = SimpleUploadedFile(
            "test.jpg", b"file_content", content_type="image/jpeg"
        )
        response = self.client.post(
            "/api/media/",
            {
                "file": file,
                "title": "Test Upload",
                "media_type": "image",
                "description": "Test description",
            },
            format="multipart",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["title"], "Test Upload")
        self.assertIsNotNone(response.data["url"])

    def test_list_media(self):
        """Test listing user's media"""
        file = SimpleUploadedFile(
            "test.jpg", b"file_content", content_type="image/jpeg"
        )
        Media.objects.create(
            user=self.user,
            title="Test Image",
            media_type="image",
            file=file,
        )
        response = self.client.get("/api/media/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["results"]), 1)

    def test_user_isolation(self):
        """Test that users only see their own media"""
        other_user = User.objects.create_user(
            username="otheruser", email="other@example.com", password="testpass123"
        )
        file = SimpleUploadedFile(
            "test.jpg", b"file_content", content_type="image/jpeg"
        )
        Media.objects.create(
            user=other_user,
            title="Other User's Image",
            media_type="image",
            file=file,
        )
        response = self.client.get("/api/media/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["results"]), 0)

    def test_delete_media(self):
        """Test deleting media"""
        file = SimpleUploadedFile(
            "test.jpg", b"file_content", content_type="image/jpeg"
        )
        media = Media.objects.create(
            user=self.user,
            title="Test Image",
            media_type="image",
            file=file,
        )
        response = self.client.delete(f"/api/media/{media.id}/")
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Media.objects.filter(id=media.id).exists())
