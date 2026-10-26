"""
Comprehensive tests for Journal module.

Covers:
- Authentication and permissions
- CRUD operations (create, list, retrieve, update, delete)
- Serializer validation (title, content, mood, tags, images)
- Filtering, ordering, and pagination
- Draft and pinned behavior
- Media/image attachment validation
- User data isolation
- Error handling and edge cases
"""

from datetime import date, timedelta
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.urls import reverse
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken

from apps.media.models import Media
from .models import JournalEntry


User = get_user_model()


class JournalModelTest(TestCase):
    """Test JournalEntry model."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser",
            email="test@example.com",
            password="testpass123"
        )

    def test_journal_entry_creation(self):
        """Test basic journal entry creation."""
        entry = JournalEntry.objects.create(
            user=self.user,
            title="Test Entry",
            content="This is a test entry",
            date=date.today(),
            mood="Heureux"
        )
        self.assertEqual(entry.title, "Test Entry")
        self.assertEqual(entry.user, self.user)
        self.assertEqual(entry.mood, "Heureux")
        self.assertFalse(entry.draft)
        self.assertFalse(entry.pinned)
        self.assertFalse(entry.favorite)
        self.assertEqual(entry.tags, [])

    def test_journal_entry_defaults(self):
        """Test journal entry default values."""
        entry = JournalEntry.objects.create(
            user=self.user,
            title="Entry",
            content="Content",
            date=date.today()
        )
        self.assertEqual(entry.mood, "Calme")
        self.assertEqual(entry.tags, [])
        self.assertFalse(entry.favorite)
        self.assertFalse(entry.pinned)
        self.assertFalse(entry.draft)

    def test_journal_entry_string_representation(self):
        """Test __str__ method."""
        entry = JournalEntry.objects.create(
            user=self.user,
            title="My Journey",
            content="Content",
            date=date.today()
        )
        self.assertEqual(str(entry), "My Journey")

    def test_journal_entry_uuid_primary_key(self):
        """Test that entry has UUID primary key."""
        entry = JournalEntry.objects.create(
            user=self.user,
            title="Entry",
            content="Content",
            date=date.today()
        )
        self.assertIsNotNone(entry.id)
        self.assertTrue(len(str(entry.id)) > 0)


class JournalAuthenticationTest(APITestCase):
    """Test authentication and access control."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="testuser",
            email="test@example.com",
            password="testpass123"
        )
        self.list_url = reverse("journal-list")

    def test_list_requires_authentication(self):
        """Test that list endpoint requires authentication."""
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_create_requires_authentication(self):
        """Test that create endpoint requires authentication."""
        response = self.client.post(
            self.list_url,
            {
                "title": "Test",
                "content": "Content",
                "date": str(date.today()),
                "mood": "Heureux",
                "draft": True
            },
            format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_retrieve_requires_authentication(self):
        """Test that retrieve endpoint requires authentication."""
        entry = JournalEntry.objects.create(
            user=self.user,
            title="Entry",
            content="Content",
            date=date.today()
        )
        response = self.client.get(reverse("journal-detail", args=[entry.pk]))
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_jwt_authentication_works(self):
        """Test that JWT authentication works."""
        token = RefreshToken.for_user(self.user)
        access = str(token.access_token)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)


class JournalUserIsolationTest(APITestCase):
    """Test user data isolation."""

    def setUp(self):
        self.client = APIClient()
        self.user1 = User.objects.create_user(
            username="user1",
            email="user1@example.com",
            password="pass123"
        )
        self.user2 = User.objects.create_user(
            username="user2",
            email="user2@example.com",
            password="pass123"
        )
        self.entry1 = JournalEntry.objects.create(
            user=self.user1,
            title="User1 Entry",
            content="User1 content",
            date=date.today()
        )
        self.entry2 = JournalEntry.objects.create(
            user=self.user2,
            title="User2 Entry",
            content="User2 content",
            date=date.today()
        )
        self.client.force_authenticate(user=self.user1)

    def test_user_cannot_see_other_user_entries(self):
        """Test user only sees their own entries in list."""
        response = self.client.get(reverse("journal-list"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["title"], "User1 Entry")

    def test_user_cannot_retrieve_other_user_entry(self):
        """Test user cannot retrieve another user's entry."""
        response = self.client.get(
            reverse("journal-detail", args=[self.entry2.pk])
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_user_cannot_update_other_user_entry(self):
        """Test user cannot update another user's entry."""
        response = self.client.patch(
            reverse("journal-detail", args=[self.entry2.pk]),
            {"title": "Hacked"},
            format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_user_cannot_delete_other_user_entry(self):
        """Test user cannot delete another user's entry."""
        response = self.client.delete(
            reverse("journal-detail", args=[self.entry2.pk])
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertTrue(JournalEntry.objects.filter(pk=self.entry2.pk).exists())


class JournalCRUDTest(APITestCase):
    """Test CRUD operations."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="testuser",
            email="test@example.com",
            password="testpass123"
        )
        self.client.force_authenticate(user=self.user)
        self.list_url = reverse("journal-list")
        self.today = date.today()

    def test_create_draft_entry(self):
        """Test creating a draft entry with minimal fields."""
        response = self.client.post(
            self.list_url,
            {
                "date": str(self.today),
                "draft": True
            },
            format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data["draft"])
        self.assertEqual(response.data["title"], "")
        self.assertEqual(response.data["content"], "")

    def test_create_published_entry_full(self):
        """Test creating a published entry with all fields."""
        response = self.client.post(
            self.list_url,
            {
                "title": "My Day",
                "content": "Today was wonderful",
                "date": str(self.today),
                "mood": "Heureux",
                "tags": ["joy", "celebration"],
                "favorite": True,
                "draft": False
            },
            format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["title"], "My Day")
        self.assertEqual(response.data["mood"], "Heureux")
        self.assertEqual(response.data["tags"], ["joy", "celebration"])
        self.assertTrue(response.data["favorite"])
        self.assertFalse(response.data["draft"])

    def test_create_sets_user_automatically(self):
        """Test that created entry is linked to authenticated user."""
        response = self.client.post(
            self.list_url,
            {
                "title": "Entry",
                "content": "Content",
                "date": str(self.today),
                "draft": True
            },
            format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        entry = JournalEntry.objects.get(pk=response.data["id"])
        self.assertEqual(entry.user, self.user)

    def test_list_entries_with_pagination(self):
        """Test list endpoint returns paginated results."""
        for i in range(15):
            JournalEntry.objects.create(
                user=self.user,
                title=f"Entry {i}",
                content="Content",
                date=self.today - timedelta(days=i)
            )
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["results"]), 10)  # Page size
        self.assertIsNotNone(response.data.get("next"))

    def test_retrieve_entry(self):
        """Test retrieving a specific entry."""
        entry = JournalEntry.objects.create(
            user=self.user,
            title="My Entry",
            content="My content",
            date=self.today
        )
        response = self.client.get(
            reverse("journal-detail", args=[entry.pk])
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["title"], "My Entry")
        self.assertEqual(response.data["id"], str(entry.pk))

    def test_update_entry(self):
        """Test updating an entry with PUT."""
        entry = JournalEntry.objects.create(
            user=self.user,
            title="Original",
            content="Original content",
            date=self.today,
            mood="Calme"
        )
        response = self.client.put(
            reverse("journal-detail", args=[entry.pk]),
            {
                "title": "Updated",
                "content": "Updated content",
                "date": str(self.today),
                "mood": "Heureux"
            },
            format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["title"], "Updated")
        self.assertEqual(response.data["mood"], "Heureux")

    def test_partial_update_entry(self):
        """Test partial update of an entry with PATCH."""
        entry = JournalEntry.objects.create(
            user=self.user,
            title="Original",
            content="Content",
            date=self.today,
            mood="Calme"
        )
        response = self.client.patch(
            reverse("journal-detail", args=[entry.pk]),
            {"mood": "Triste"},
            format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["mood"], "Triste")
        self.assertEqual(response.data["title"], "Original")  # Unchanged

    def test_delete_entry(self):
        """Test deleting an entry."""
        entry = JournalEntry.objects.create(
            user=self.user,
            title="To Delete",
            content="Content",
            date=self.today
        )
        entry_id = entry.pk
        response = self.client.delete(
            reverse("journal-detail", args=[entry_id])
        )
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(
            JournalEntry.objects.filter(pk=entry_id).exists()
        )


class JournalValidationTest(APITestCase):
    """Test serializer validation."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="testuser",
            email="test@example.com",
            password="testpass123"
        )
        self.client.force_authenticate(user=self.user)
        self.list_url = reverse("journal-list")
        self.today = date.today()

    def test_publish_entry_requires_title(self):
        """Test published entry requires title."""
        response = self.client.post(
            self.list_url,
            {
                "content": "Content",
                "date": str(self.today),
                "mood": "Heureux",
                "draft": False
            },
            format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("title", response.data)

    def test_publish_entry_requires_content(self):
        """Test published entry requires content."""
        response = self.client.post(
            self.list_url,
            {
                "title": "Title",
                "date": str(self.today),
                "mood": "Heureux",
                "draft": False
            },
            format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("content", response.data)

    def test_publish_entry_requires_mood(self):
        """Test published entry requires mood."""
        response = self.client.post(
            self.list_url,
            {
                "title": "Title",
                "content": "Content",
                "date": str(self.today),
                "draft": False
            },
            format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("mood", response.data)

    def test_publish_entry_requires_date(self):
        """Test published entry requires date."""
        response = self.client.post(
            self.list_url,
            {
                "title": "Title",
                "content": "Content",
                "mood": "Heureux",
                "draft": False
            },
            format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("date", response.data)

    def test_draft_entry_allows_empty_fields(self):
        """Test draft entry can have empty fields."""
        response = self.client.post(
            self.list_url,
            {"draft": True, "date": str(self.today)},
            format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_title_too_short(self):
        """Test title validation minimum length."""
        response = self.client.post(
            self.list_url,
            {
                "title": "ab",  # Less than 3 chars
                "content": "Content",
                "date": str(self.today),
                "mood": "Heureux",
                "draft": False
            },
            format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("title", response.data)

    def test_title_too_long(self):
        """Test title validation maximum length."""
        response = self.client.post(
            self.list_url,
            {
                "title": "x" * 256,  # More than 255 chars
                "content": "Content",
                "date": str(self.today),
                "mood": "Heureux",
                "draft": False
            },
            format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("title", response.data)

    def test_content_too_long(self):
        """Test content validation maximum length."""
        response = self.client.post(
            self.list_url,
            {
                "title": "Title",
                "content": "x" * 12001,  # More than 12000
                "date": str(self.today),
                "mood": "Heureux",
                "draft": False
            },
            format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("content", response.data)

    def test_mood_too_long(self):
        """Test mood validation maximum length."""
        response = self.client.post(
            self.list_url,
            {
                "title": "Title",
                "content": "Content",
                "date": str(self.today),
                "mood": "x" * 51,  # More than 50
                "draft": False
            },
            format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("mood", response.data)

    def test_invalid_date_format(self):
        """Test date validation format."""
        response = self.client.post(
            self.list_url,
            {
                "title": "Title",
                "content": "Content",
                "date": "invalid-date",
                "mood": "Heureux",
                "draft": False
            },
            format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("date", response.data)

    def test_future_date_rejected(self):
        """Test that future dates are rejected."""
        tomorrow = self.today + timedelta(days=1)
        response = self.client.post(
            self.list_url,
            {
                "title": "Title",
                "content": "Content",
                "date": str(tomorrow),
                "mood": "Heureux",
                "draft": False
            },
            format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("date", response.data)

    def test_tags_not_list(self):
        """Test tags must be a list."""
        response = self.client.post(
            self.list_url,
            {
                "title": "Title",
                "content": "Content",
                "date": str(self.today),
                "mood": "Heureux",
                "tags": "not-a-list",
                "draft": False
            },
            format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("tags", response.data)

    def test_too_many_tags(self):
        """Test maximum number of tags."""
        response = self.client.post(
            self.list_url,
            {
                "title": "Title",
                "content": "Content",
                "date": str(self.today),
                "mood": "Heureux",
                "tags": [f"tag{i}" for i in range(11)],  # More than 10
                "draft": False
            },
            format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("tags", response.data)

    def test_tag_too_long(self):
        """Test individual tag maximum length."""
        response = self.client.post(
            self.list_url,
            {
                "title": "Title",
                "content": "Content",
                "date": str(self.today),
                "mood": "Heureux",
                "tags": ["x" * 31],  # More than 30 chars
                "draft": False
            },
            format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("tags", response.data)

    def test_duplicate_tags_rejected(self):
        """Test duplicate tags are rejected."""
        response = self.client.post(
            self.list_url,
            {
                "title": "Title",
                "content": "Content",
                "date": str(self.today),
                "mood": "Heureux",
                "tags": ["joy", "joy"],  # Duplicate
                "draft": False
            },
            format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("tags", response.data)

    def test_empty_tags_rejected(self):
        """Test empty tags are rejected."""
        response = self.client.post(
            self.list_url,
            {
                "title": "Title",
                "content": "Content",
                "date": str(self.today),
                "mood": "Heureux",
                "tags": [""],  # Empty string
                "draft": False
            },
            format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("tags", response.data)

    def test_tags_case_insensitive_deduplication(self):
        """Test tags are deduplicated case-insensitively."""
        response = self.client.post(
            self.list_url,
            {
                "title": "Title",
                "content": "Content",
                "date": str(self.today),
                "mood": "Heureux",
                "tags": ["Joy", "joy", "JOY"],
                "draft": False
            },
            format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("tags", response.data)


class JournalDraftAndPinnedTest(APITestCase):
    """Test draft and pinned behavior."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="testuser",
            email="test@example.com",
            password="testpass123"
        )
        self.client.force_authenticate(user=self.user)
        self.today = date.today()

    def test_create_draft_entry(self):
        """Test creating a draft entry."""
        response = self.client.post(
            reverse("journal-list"),
            {"draft": True, "date": str(self.today)},
            format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data["draft"])

    def test_publish_draft_entry(self):
        """Test converting draft to published."""
        entry = JournalEntry.objects.create(
            user=self.user,
            title="",
            content="",
            date=self.today,
            draft=True
        )
        response = self.client.patch(
            reverse("journal-detail", args=[entry.pk]),
            {
                "title": "Now Published",
                "content": "Now has content",
                "mood": "Heureux",
                "draft": False
            },
            format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data["draft"])

    def test_toggle_pin_endpoint(self):
        """Test toggling pin status."""
        entry = JournalEntry.objects.create(
            user=self.user,
            title="Entry",
            content="Content",
            date=self.today,
            pinned=False
        )
        response = self.client.post(
            reverse("journal-toggle-pin", args=[entry.pk])
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["pinned"])
        
        # Toggle again
        response = self.client.post(
            reverse("journal-toggle-pin", args=[entry.pk])
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data["pinned"])

    def test_pinned_entries_appear_first(self):
        """Test pinned entries appear first in list."""
        # Create unpinned entry
        entry1 = JournalEntry.objects.create(
            user=self.user,
            title="Unpinned",
            content="Content",
            date=self.today,
            pinned=False
        )
        # Create pinned entry
        entry2 = JournalEntry.objects.create(
            user=self.user,
            title="Pinned",
            content="Content",
            date=self.today - timedelta(days=1),  # Earlier date
            pinned=True
        )
        response = self.client.get(reverse("journal-list"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Pinned should appear first despite earlier date
        self.assertEqual(
            response.data["results"][0]["title"],
            "Pinned"
        )

    def test_favorite_toggle(self):
        """Test toggling favorite status."""
        entry = JournalEntry.objects.create(
            user=self.user,
            title="Entry",
            content="Content",
            date=self.today,
            favorite=False
        )
        response = self.client.patch(
            reverse("journal-detail", args=[entry.pk]),
            {"favorite": True},
            format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["favorite"])


class JournalFilteringTest(APITestCase):
    """Test filtering and ordering."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="testuser",
            email="test@example.com",
            password="testpass123"
        )
        self.client.force_authenticate(user=self.user)
        self.today = date.today()

    def test_search_by_title(self):
        """Test searching by title."""
        JournalEntry.objects.create(
            user=self.user,
            title="Vacation Plans",
            content="Content",
            date=self.today
        )
        JournalEntry.objects.create(
            user=self.user,
            title="Work Day",
            content="Content",
            date=self.today
        )
        response = self.client.get(
            reverse("journal-list") + "?search=vacation"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertIn("Vacation", response.data["results"][0]["title"])

    def test_search_by_content(self):
        """Test searching by content."""
        JournalEntry.objects.create(
            user=self.user,
            title="Day 1",
            content="Had coffee with Sarah",
            date=self.today
        )
        JournalEntry.objects.create(
            user=self.user,
            title="Day 2",
            content="Went to gym",
            date=self.today
        )
        response = self.client.get(
            reverse("journal-list") + "?search=sarah"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)

    def test_filter_by_mood(self):
        """Test filtering by mood."""
        JournalEntry.objects.create(
            user=self.user,
            title="Happy Day",
            content="Content",
            date=self.today,
            mood="Heureux"
        )
        JournalEntry.objects.create(
            user=self.user,
            title="Sad Day",
            content="Content",
            date=self.today,
            mood="Triste"
        )
        response = self.client.get(
            reverse("journal-list") + "?mood=Heureux"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["mood"], "Heureux")

    def test_filter_by_favorite(self):
        """Test filtering by favorite status."""
        JournalEntry.objects.create(
            user=self.user,
            title="Favorite",
            content="Content",
            date=self.today,
            favorite=True
        )
        JournalEntry.objects.create(
            user=self.user,
            title="Not Favorite",
            content="Content",
            date=self.today,
            favorite=False
        )
        response = self.client.get(
            reverse("journal-list") + "?favorite=true"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertTrue(response.data["results"][0]["favorite"])

    def test_filter_by_draft(self):
        """Test filtering by draft status."""
        JournalEntry.objects.create(
            user=self.user,
            title="Draft",
            content="Content",
            date=self.today,
            draft=True
        )
        JournalEntry.objects.create(
            user=self.user,
            title="Published",
            content="Content",
            date=self.today,
            draft=False
        )
        response = self.client.get(
            reverse("journal-list") + "?draft=true"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertTrue(response.data["results"][0]["draft"])

    def test_filter_by_date_range(self):
        """Test filtering by date range."""
        date1 = self.today - timedelta(days=5)
        date2 = self.today
        date3 = self.today + timedelta(days=5)  # Future (should fail validation)

        JournalEntry.objects.create(
            user=self.user,
            title="Old",
            content="Content",
            date=date1
        )
        JournalEntry.objects.create(
            user=self.user,
            title="Recent",
            content="Content",
            date=date2
        )
        
        response = self.client.get(
            reverse("journal-list") +
            f"?date_from={date1}&date_to={date2}"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 2)

    def test_ordering_by_date_descending(self):
        """Test ordering by date (default)."""
        JournalEntry.objects.create(
            user=self.user,
            title="Old",
            content="Content",
            date=self.today - timedelta(days=5)
        )
        JournalEntry.objects.create(
            user=self.user,
            title="Recent",
            content="Content",
            date=self.today
        )
        response = self.client.get(reverse("journal-list"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["results"][0]["title"], "Recent")

    def test_ordering_by_date_ascending(self):
        """Test ordering by date ascending."""
        JournalEntry.objects.create(
            user=self.user,
            title="Old",
            content="Content",
            date=self.today - timedelta(days=5)
        )
        JournalEntry.objects.create(
            user=self.user,
            title="Recent",
            content="Content",
            date=self.today
        )
        response = self.client.get(
            reverse("journal-list") + "?ordering=date"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["results"][0]["title"], "Old")

    def test_ordering_by_title(self):
        """Test ordering by title."""
        JournalEntry.objects.create(
            user=self.user,
            title="Zebra",
            content="Content",
            date=self.today
        )
        JournalEntry.objects.create(
            user=self.user,
            title="Apple",
            content="Content",
            date=self.today
        )
        response = self.client.get(
            reverse("journal-list") + "?ordering=title"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["results"][0]["title"], "Apple")

    def test_invalid_ordering_rejected(self):
        """Test invalid ordering parameter is rejected."""
        response = self.client.get(
            reverse("journal-list") + "?ordering=invalid"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_invalid_favorite_filter_rejected(self):
        """Test invalid favorite filter is rejected."""
        response = self.client.get(
            reverse("journal-list") + "?favorite=maybe"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_invalid_date_format_rejected(self):
        """Test invalid date format in filters is rejected."""
        response = self.client.get(
            reverse("journal-list") + "?date_from=not-a-date"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class JournalMediaAttachmentTest(APITestCase):
    """Test media attachment validation."""

    def setUp(self):
        self.client = APIClient()
        self.user1 = User.objects.create_user(
            username="user1",
            email="user1@example.com",
            password="pass123"
        )
        self.user2 = User.objects.create_user(
            username="user2",
            email="user2@example.com",
            password="pass123"
        )
        self.client.force_authenticate(user=self.user1)
        self.today = date.today()

    def test_attach_user_media_to_entry(self):
        """Test attaching user's own media to entry."""
        file = SimpleUploadedFile(
            "test.jpg",
            b"file_content",
            content_type="image/jpeg"
        )
        media = Media.objects.create(
            user=self.user1,
            title="My Photo",
            media_type="image",
            file=file
        )
        response = self.client.post(
            reverse("journal-list"),
            {
                "title": "Photo Day",
                "content": "With my photo",
                "date": str(self.today),
                "mood": "Heureux",
                "images": [media.pk],
                "draft": False
            },
            format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(len(response.data["attachments"]), 1)

    def test_cannot_attach_other_user_media(self):
        """Test user cannot attach another user's media."""
        file = SimpleUploadedFile(
            "test.jpg",
            b"file_content",
            content_type="image/jpeg"
        )
        media = Media.objects.create(
            user=self.user2,
            title="Other User's Photo",
            media_type="image",
            file=file
        )
        response = self.client.post(
            reverse("journal-list"),
            {
                "title": "Photo Day",
                "content": "Trying to use other media",
                "date": str(self.today),
                "mood": "Heureux",
                "images": [media.pk],
                "draft": False
            },
            format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("images", response.data)

    def test_too_many_attachments(self):
        """Test maximum number of attachments."""
        files = []
        for i in range(21):
            file = SimpleUploadedFile(
                f"test{i}.jpg",
                b"file_content",
                content_type="image/jpeg"
            )
            media = Media.objects.create(
                user=self.user1,
                title=f"Photo {i}",
                media_type="image",
                file=file
            )
            files.append(media.pk)

        response = self.client.post(
            reverse("journal-list"),
            {
                "title": "Too Many Photos",
                "content": "Content",
                "date": str(self.today),
                "mood": "Heureux",
                "images": files,  # 21 media > 20 max
                "draft": False
            },
            format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("images", response.data)

    def test_duplicate_media_rejected(self):
        """Test attaching same media twice is rejected."""
        file = SimpleUploadedFile(
            "test.jpg",
            b"file_content",
            content_type="image/jpeg"
        )
        media = Media.objects.create(
            user=self.user1,
            title="Photo",
            media_type="image",
            file=file
        )
        response = self.client.post(
            reverse("journal-list"),
            {
                "title": "Title",
                "content": "Content",
                "date": str(self.today),
                "mood": "Heureux",
                "images": [media.pk, media.pk],  # Same media twice
                "draft": False
            },
            format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("images", response.data)


class JournalEdgeCasesTest(APITestCase):
    """Test edge cases and error handling."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="testuser",
            email="test@example.com",
            password="testpass123"
        )
        self.client.force_authenticate(user=self.user)
        self.today = date.today()

    def test_retrieve_nonexistent_entry(self):
        """Test retrieving non-existent entry returns 404."""
        import uuid
        fake_id = uuid.uuid4()
        response = self.client.get(
            reverse("journal-detail", args=[fake_id])
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_whitespace_stripping_in_title(self):
        """Test that title whitespace is stripped."""
        response = self.client.post(
            reverse("journal-list"),
            {
                "title": "  Title With Spaces  ",
                "content": "Content",
                "date": str(self.today),
                "mood": "Heureux",
                "draft": False
            },
            format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["title"], "Title With Spaces")

    def test_whitespace_stripping_in_content(self):
        """Test that content whitespace is stripped."""
        response = self.client.post(
            reverse("journal-list"),
            {
                "title": "Title",
                "content": "  Content With Spaces  ",
                "date": str(self.today),
                "mood": "Heureux",
                "draft": False
            },
            format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["content"], "Content With Spaces")

    def test_author_info_returned_for_owner(self):
        """Test author information returned for entry owner."""
        entry = JournalEntry.objects.create(
            user=self.user,
            title="Entry",
            content="Content",
            date=self.today
        )
        response = self.client.get(
            reverse("journal-detail", args=[entry.pk])
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        author = response.data.get("author")
        self.assertIsNotNone(author)
        self.assertEqual(author["id"], self.user.pk)
        self.assertEqual(author["username"], "testuser")

    def test_empty_string_title_with_spaces(self):
        """Test that title with only spaces is treated as empty."""
        response = self.client.post(
            reverse("journal-list"),
            {
                "title": "   ",  # Only spaces
                "content": "Content",
                "date": str(self.today),
                "mood": "Heureux",
                "draft": False
            },
            format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("title", response.data)

    def test_response_includes_timestamps(self):
        """Test response includes created_at and updated_at."""
        response = self.client.post(
            reverse("journal-list"),
            {
                "title": "Title",
                "content": "Content",
                "date": str(self.today),
                "mood": "Heureux",
                "draft": False
            },
            format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn("created_at", response.data)
        self.assertIn("updated_at", response.data)
        self.assertIsNotNone(response.data["created_at"])
        self.assertIsNotNone(response.data["updated_at"])

    def test_response_excludes_sensitive_data(self):
        """Test response doesn't expose sensitive internal data."""
        response = self.client.post(
            reverse("journal-list"),
            {
                "title": "Title",
                "content": "Content",
                "date": str(self.today),
                "mood": "Heureux",
                "draft": False
            },
            format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        # Should not expose user relationship
        self.assertNotIn("user", response.data)
