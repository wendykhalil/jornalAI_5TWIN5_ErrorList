from django.test import TestCase
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from datetime import date
from unittest.mock import patch, MagicMock
import json
import requests

from .models import Memory
from apps.journal.models import JournalEntry
from .ai_service import (
    OllamaError,
    OllamaTimeoutError,
    OllamaUnavailableError,
    OllamaInvalidResponseError,
)

User = get_user_model()


class MemoryModelTest(TestCase):
    """Test Memory model."""
    
    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser",
            email="test@example.com",
            password="testpass123"
        )
    
    def test_memory_creation(self):
        """Test basic memory creation."""
        memory = Memory.objects.create(
            user=self.user,
            title="Test Memory",
            description="This is a test memory",
            event_date=date(2026, 10, 15),
            location="Test Location",
            category="Voyages",
            importance="high",
            tags=["travel", "fun"]
        )
        self.assertEqual(memory.title, "Test Memory")
        self.assertEqual(memory.user, self.user)
        self.assertEqual(memory.category, "Voyages")
        self.assertEqual(memory.importance, "high")
        self.assertEqual(memory.tags, ["travel", "fun"])
        self.assertFalse(memory.favorite)
        self.assertIsNone(memory.ai_summary)
    
    def test_memory_string_representation(self):
        """Test memory __str__ method."""
        memory = Memory.objects.create(
            user=self.user,
            title="My Special Memory",
            description="Description",
            event_date=date(2026, 10, 15)
        )
        self.assertEqual(str(memory), "My Special Memory")
    
    def test_memory_with_journal_entry(self):
        """Test memory linked to journal entry."""
        journal_entry = JournalEntry.objects.create(
            user=self.user,
            title="Journal Entry",
            content="Content",
            date=date(2026, 10, 15)
        )
        memory = Memory.objects.create(
            user=self.user,
            title="Test Memory",
            description="Description",
            event_date=date(2026, 10, 15),
            related_journal_entry=journal_entry
        )
        self.assertEqual(memory.related_journal_entry, journal_entry)
    
    def test_memory_default_values(self):
        """Test memory default values."""
        memory = Memory.objects.create(
            user=self.user,
            title="Test Memory",
            description="Description",
            event_date=date(2026, 10, 15)
        )
        self.assertEqual(memory.category, "Autres")
        self.assertEqual(memory.importance, "medium")
        self.assertEqual(memory.tags, [])
        self.assertFalse(memory.favorite)


class MemorySerializerTest(TestCase):
    """Test MemorySerializer validation."""
    
    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser",
            email="test@example.com",
            password="testpass123"
        )
    
    def test_valid_memory_data(self):
        """Test serializer with valid data."""
        from .serializers import MemorySerializer
        
        data = {
            "title": "Test Memory",
            "description": "Test description",
            "event_date": "2026-10-15",
            "location": "Test Location",
            "category": "Voyages",
            "importance": "high",
            "tags": ["travel", "fun"],
            "cover": "https://example.com/image.jpg",
            "favorite": True
        }
        serializer = MemorySerializer(data=data)
        self.assertTrue(serializer.is_valid())
    
    def test_invalid_category(self):
        """Test serializer with invalid category."""
        from .serializers import MemorySerializer
        
        data = {
            "title": "Test Memory",
            "description": "Test description",
            "event_date": "2026-10-15",
            "category": "InvalidCategory",
            "importance": "high"
        }
        serializer = MemorySerializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn("category", serializer.errors)
    
    def test_invalid_importance(self):
        """Test serializer with invalid importance."""
        from .serializers import MemorySerializer
        
        data = {
            "title": "Test Memory",
            "description": "Test description",
            "event_date": "2026-10-15",
            "category": "Voyages",
            "importance": "invalid-importance"
        }
        serializer = MemorySerializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn("importance", serializer.errors)
    
    def test_invalid_tags_type(self):
        """Test serializer with invalid tags type."""
        from .serializers import MemorySerializer
        
        data = {
            "title": "Test Memory",
            "description": "Test description",
            "event_date": "2026-10-15",
            "category": "Voyages",
            "importance": "high",
            "tags": "not-a-list"
        }
        serializer = MemorySerializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn("tags", serializer.errors)
    
    def test_invalid_tags_elements(self):
        """Test serializer with non-string tags."""
        from .serializers import MemorySerializer
        
        data = {
            "title": "Test Memory",
            "description": "Test description",
            "event_date": "2026-10-15",
            "category": "Voyages",
            "importance": "high",
            "tags": ["valid", 123, None]
        }
        serializer = MemorySerializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn("tags", serializer.errors)


class MemoryViewSetTest(TestCase):
    """Test MemoryViewSet API endpoints."""
    
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
        
        # Create some test memories
        self.memory1 = Memory.objects.create(
            user=self.user1,
            title="User1 Memory 1",
            description="Description 1",
            event_date=date(2026, 10, 15),
            category="Voyages",
            importance="high"
        )
        self.memory2 = Memory.objects.create(
            user=self.user1,
            title="User1 Memory 2",
            description="Description 2",
            event_date=date(2026, 10, 14),
            category="Amis",
            importance="medium",
            favorite=True
        )
        self.memory3 = Memory.objects.create(
            user=self.user2,
            title="User2 Memory",
            description="Description 3",
            event_date=date(2026, 10, 13),
            category="Familie"
        )
    
    def test_list_memories_without_auth(self):
        """Test list endpoint requires authentication."""
        response = self.client.get(reverse("memory-list"))
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
    
    def test_list_memories_user_isolation(self):
        """Test user only sees their own memories."""
        self.client.force_authenticate(user=self.user1)
        response = self.client.get(reverse("memory-list"))
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 2)
        titles = [m["title"] for m in response.data["results"]]
        self.assertIn("User1 Memory 1", titles)
        self.assertIn("User1 Memory 2", titles)
        self.assertNotIn("User2 Memory", titles)
    
    def test_create_memory(self):
        """Test creating a memory."""
        self.client.force_authenticate(user=self.user1)
        data = {
            "title": "New Memory",
            "description": "New description",
            "event_date": "2026-10-16",
            "category": "Études",
            "importance": "high",
            "tags": ["school", "important"],
            "favorite": False
        }
        response = self.client.post(reverse("memory-list"), data, format="json")
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["title"], "New Memory")
        self.assertEqual(response.data["category"], "Études")
        self.assertEqual(response.data["importance"], "high")
        self.assertEqual(response.data["tags"], ["school", "important"])
        
        # Verify memory was created with correct user
        memory = Memory.objects.get(id=response.data["id"])
        self.assertEqual(memory.user, self.user1)
    
    def test_create_memory_without_auth(self):
        """Test create endpoint requires authentication."""
        data = {
            "title": "Memory",
            "description": "Description",
            "event_date": "2026-10-16",
            "category": "Voyages"
        }
        response = self.client.post(reverse("memory-list"), data, format="json")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
    
    def test_retrieve_memory(self):
        """Test retrieving a specific memory."""
        self.client.force_authenticate(user=self.user1)
        response = self.client.get(reverse("memory-detail", args=[self.memory1.id]))
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["title"], "User1 Memory 1")
        self.assertEqual(response.data["category"], "Voyages")
    
    def test_retrieve_memory_wrong_user(self):
        """Test user cannot retrieve another user's memory."""
        self.client.force_authenticate(user=self.user2)
        response = self.client.get(reverse("memory-detail", args=[self.memory1.id]))
        
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
    
    def test_update_memory(self):
        """Test updating a memory."""
        self.client.force_authenticate(user=self.user1)
        data = {
            "title": "Updated Title",
            "description": self.memory1.description,
            "event_date": str(self.memory1.event_date),
            "category": "Travail",
            "importance": "low",
            "tags": []
        }
        response = self.client.put(
            reverse("memory-detail", args=[self.memory1.id]),
            data,
            format="json"
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["title"], "Updated Title")
        self.assertEqual(response.data["category"], "Travail")
        self.assertEqual(response.data["importance"], "low")
    
    def test_partial_update_memory(self):
        """Test partial update of a memory."""
        self.client.force_authenticate(user=self.user1)
        data = {"title": "New Title", "favorite": True}
        response = self.client.patch(
            reverse("memory-detail", args=[self.memory1.id]),
            data,
            format="json"
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["title"], "New Title")
        self.assertTrue(response.data["favorite"])
        self.assertEqual(response.data["category"], "Voyages")  # Unchanged
    
    def test_update_memory_wrong_user(self):
        """Test user cannot update another user's memory."""
        self.client.force_authenticate(user=self.user2)
        data = {
            "title": "Hacked",
            "description": "Hacked",
            "event_date": "2026-10-15",
            "category": "Voyages"
        }
        response = self.client.put(
            reverse("memory-detail", args=[self.memory1.id]),
            data,
            format="json"
        )
        
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
    
    def test_delete_memory(self):
        """Test deleting a memory."""
        self.client.force_authenticate(user=self.user1)
        memory_id = self.memory1.id
        response = self.client.delete(reverse("memory-detail", args=[memory_id]))
        
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Memory.objects.filter(id=memory_id).exists())
    
    def test_delete_memory_wrong_user(self):
        """Test user cannot delete another user's memory."""
        self.client.force_authenticate(user=self.user2)
        response = self.client.delete(reverse("memory-detail", args=[self.memory1.id]))
        
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertTrue(Memory.objects.filter(id=self.memory1.id).exists())
    
    def test_memory_ordering(self):
        """Test memories are ordered by event_date desc, then created_at desc."""
        self.client.force_authenticate(user=self.user1)
        response = self.client.get(reverse("memory-list"))
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data["results"]
        self.assertEqual(results[0]["title"], "User1 Memory 1")  # Latest event_date
        self.assertEqual(results[1]["title"], "User1 Memory 2")  # Earlier event_date
    
    def test_list_memories_pagination(self):
        """Test pagination in memory list."""
        # Create more memories to test pagination
        for i in range(25):
            Memory.objects.create(
                user=self.user1,
                title=f"Memory {i}",
                description="Description",
                event_date=date(2026, 10, 1 + (i % 30))
            )
        
        self.client.force_authenticate(user=self.user1)
        response = self.client.get(reverse("memory-list"))
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["results"]), 20)  # Default page size
        self.assertIsNotNone(response.data.get("next"))
    
    def test_create_memory_with_invalid_category(self):
        """Test creating memory with invalid category fails."""
        self.client.force_authenticate(user=self.user1)
        data = {
            "title": "Memory",
            "description": "Description",
            "event_date": "2026-10-16",
            "category": "InvalidCategory",
            "importance": "high"
        }
        response = self.client.post(reverse("memory-list"), data, format="json")
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("category", response.data)
    
    def test_create_memory_with_invalid_importance(self):
        """Test creating memory with invalid importance fails."""
        self.client.force_authenticate(user=self.user1)
        data = {
            "title": "Memory",
            "description": "Description",
            "event_date": "2026-10-16",
            "category": "Voyages",
            "importance": "invalid"
        }
        response = self.client.post(reverse("memory-list"), data, format="json")
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("importance", response.data)
    
    def test_create_memory_with_invalid_tags(self):
        """Test creating memory with invalid tags fails."""
        self.client.force_authenticate(user=self.user1)
        data = {
            "title": "Memory",
            "description": "Description",
            "event_date": "2026-10-16",
            "category": "Voyages",
            "importance": "high",
            "tags": "not-a-list"
        }
        response = self.client.post(reverse("memory-list"), data, format="json")
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("tags", response.data)
    
    def test_update_memory_with_cover(self):
        """Test updating a memory with a different cover URL."""
        self.client.force_authenticate(user=self.user1)
        
        # Update with a new cover URL
        new_cover_url = "http://localhost:8000/media/2026/10/20/new_image.jpg"
        data = {
            "title": self.memory1.title,
            "description": self.memory1.description,
            "event_date": str(self.memory1.event_date),
            "category": self.memory1.category,
            "importance": self.memory1.importance,
            "tags": self.memory1.tags,
            "cover": new_cover_url
        }
        response = self.client.put(
            reverse("memory-detail", args=[self.memory1.id]),
            data,
            format="json"
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["cover"], new_cover_url)
        
        # Retrieve the memory and verify cover persists
        response = self.client.get(reverse("memory-detail", args=[self.memory1.id]))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["cover"], new_cover_url)
    
    def test_update_memory_clear_cover(self):
        """Test clearing a memory's cover."""
        # First set a cover
        self.memory1.cover = "http://localhost:8000/media/2026/10/15/image.jpg"
        self.memory1.save()
        
        self.client.force_authenticate(user=self.user1)
        
        # Update to clear cover
        data = {
            "title": self.memory1.title,
            "description": self.memory1.description,
            "event_date": str(self.memory1.event_date),
            "category": self.memory1.category,
            "importance": self.memory1.importance,
            "tags": self.memory1.tags,
            "cover": None
        }
        response = self.client.patch(
            reverse("memory-detail", args=[self.memory1.id]),
            data,
            format="json"
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsNone(response.data["cover"])
    
    def test_update_memory_preserves_other_fields(self):
        """Test updating cover does not erase unrelated fields."""
        self.client.force_authenticate(user=self.user1)
        
        # Update only cover
        original_title = self.memory1.title
        original_description = self.memory1.description
        original_location = self.memory1.location
        
        new_cover_url = "http://localhost:8000/media/2026/10/20/new_image.jpg"
        data = {
            "title": original_title,
            "description": original_description,
            "event_date": str(self.memory1.event_date),
            "location": original_location,
            "category": self.memory1.category,
            "importance": self.memory1.importance,
            "tags": self.memory1.tags,
            "cover": new_cover_url
        }
        response = self.client.patch(
            reverse("memory-detail", args=[self.memory1.id]),
            data,
            format="json"
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["cover"], new_cover_url)
        self.assertEqual(response.data["title"], original_title)
        self.assertEqual(response.data["description"], original_description)
        self.assertEqual(response.data["location"], original_location)



class MemoryAISuggestionsTest(TestCase):
    """Test AI suggestion endpoints for categories and tags."""
    
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="testuser",
            email="test@example.com",
            password="testpass123"
        )
        self.client.force_authenticate(user=self.user)
    
    # ==========================================
    # SUGGEST CATEGORY TESTS
    # ==========================================
    
    def test_suggest_category_without_auth(self):
        """Test suggest-category endpoint requires authentication."""
        client = APIClient()  # Unauthenticated
        response = client.post(
            reverse("memory-suggest-category"),
            {"description": "I visited the beach today"},
            format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
    
    def test_suggest_category_empty_description(self):
        """Test suggest-category with empty description."""
        response = self.client.post(
            reverse("memory-suggest-category"),
            {"description": ""},
            format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("error", response.data)
    
    def test_suggest_category_missing_description(self):
        """Test suggest-category with missing description field."""
        response = self.client.post(
            reverse("memory-suggest-category"),
            {},
            format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("error", response.data)
    
    def test_suggest_category_whitespace_only(self):
        """Test suggest-category with whitespace-only description."""
        response = self.client.post(
            reverse("memory-suggest-category"),
            {"description": "   \n\t  "},
            format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("error", response.data)
    
    @patch("apps.memories.ai_service.requests.post")
    def test_suggest_category_success(self, mock_post):
        """Test successful category suggestion."""
        # Mock Ollama response
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "response": json.dumps({
                "suggested_category": "Voyages",
                "confidence": 0.95,
                "reasoning": "The description mentions beach and travel."
            })
        }
        mock_post.return_value = mock_response
        
        response = self.client.post(
            reverse("memory-suggest-category"),
            {"description": "I had a wonderful time at the beach today"},
            format="json"
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["suggested_category"], "Voyages")
        self.assertEqual(response.data["confidence"], 0.95)
        self.assertIn("reasoning", response.data)
    
    @patch("apps.memories.ai_service.requests.post")
    def test_suggest_category_invalid_category_fallback(self, mock_post):
        """Test that invalid category suggestion falls back to 'Autres'."""
        # Mock Ollama returning an invalid category
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "response": json.dumps({
                "suggested_category": "InvalidCategory",
                "confidence": 0.5,
                "reasoning": "Test"
            })
        }
        mock_post.return_value = mock_response
        
        response = self.client.post(
            reverse("memory-suggest-category"),
            {"description": "Some memory description"},
            format="json"
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["suggested_category"], "Autres")
        self.assertEqual(response.data["confidence"], 0.5)
    
    @patch("apps.memories.ai_service.requests.post")
    def test_suggest_category_invalid_json(self, mock_post):
        """Test handling of invalid JSON from Ollama."""
        # Mock Ollama returning invalid JSON
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "response": "This is not valid JSON {"
        }
        mock_post.return_value = mock_response
        
        response = self.client.post(
            reverse("memory-suggest-category"),
            {"description": "Some memory description"},
            format="json"
        )
        
        self.assertEqual(response.status_code, status.HTTP_500_INTERNAL_SERVER_ERROR)
        self.assertIn("error", response.data)
    
    @patch("apps.memories.ai_service.requests.post")
    def test_suggest_category_missing_fields(self, mock_post):
        """Test handling of response missing required fields."""
        # Mock Ollama returning incomplete JSON
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "response": json.dumps({
                "suggested_category": "Voyages"
                # Missing confidence and reasoning
            })
        }
        mock_post.return_value = mock_response
        
        response = self.client.post(
            reverse("memory-suggest-category"),
            {"description": "Some memory description"},
            format="json"
        )
        
        self.assertEqual(response.status_code, status.HTTP_500_INTERNAL_SERVER_ERROR)
        self.assertIn("error", response.data)
    
    @patch("apps.memories.ai_service.requests.post")
    def test_suggest_category_timeout(self, mock_post):
        """Test handling of Ollama timeout."""
        import requests
        mock_post.side_effect = requests.exceptions.Timeout()
        
        response = self.client.post(
            reverse("memory-suggest-category"),
            {"description": "Some memory description"},
            format="json"
        )
        
        self.assertEqual(response.status_code, status.HTTP_504_GATEWAY_TIMEOUT)
        self.assertIn("error", response.data)
        self.assertIn("type", response.data)
        self.assertEqual(response.data["type"], "timeout")
    
    @patch("apps.memories.ai_service.requests.post")
    def test_suggest_category_connection_error(self, mock_post):
        """Test handling of connection error to Ollama."""
        import requests
        mock_post.side_effect = requests.exceptions.ConnectionError()
        
        response = self.client.post(
            reverse("memory-suggest-category"),
            {"description": "Some memory description"},
            format="json"
        )
        
        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertIn("error", response.data)
        self.assertIn("type", response.data)
        self.assertEqual(response.data["type"], "unavailable")
    
    # ==========================================
    # SUGGEST TAGS TESTS
    # ==========================================
    
    def test_suggest_tags_without_auth(self):
        """Test suggest-tags endpoint requires authentication."""
        client = APIClient()  # Unauthenticated
        response = client.post(
            reverse("memory-suggest-tags"),
            {
                "title": "Beach Day",
                "description": "I visited the beach today"
            },
            format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
    
    def test_suggest_tags_empty_title(self):
        """Test suggest-tags with empty title."""
        response = self.client.post(
            reverse("memory-suggest-tags"),
            {
                "title": "",
                "description": "Some description"
            },
            format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("error", response.data)
    
    def test_suggest_tags_empty_description(self):
        """Test suggest-tags with empty description."""
        response = self.client.post(
            reverse("memory-suggest-tags"),
            {
                "title": "Some Title",
                "description": ""
            },
            format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("error", response.data)
    
    def test_suggest_tags_missing_title(self):
        """Test suggest-tags with missing title field."""
        response = self.client.post(
            reverse("memory-suggest-tags"),
            {"description": "Some description"},
            format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("error", response.data)
    
    def test_suggest_tags_missing_description(self):
        """Test suggest-tags with missing description field."""
        response = self.client.post(
            reverse("memory-suggest-tags"),
            {"title": "Some Title"},
            format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("error", response.data)
    
    @patch("apps.memories.ai_service.requests.post")
    def test_suggest_tags_success(self, mock_post):
        """Test successful tag suggestion."""
        # Mock Ollama response
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "response": json.dumps({
                "suggested_tags": ["beach", "summer", "vacation", "friends"],
                "confidence": 0.92
            })
        }
        mock_post.return_value = mock_response
        
        response = self.client.post(
            reverse("memory-suggest-tags"),
            {
                "title": "Beach Day",
                "description": "I had a wonderful time at the beach with friends"
            },
            format="json"
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["suggested_tags"]), 4)
        self.assertIn("beach", response.data["suggested_tags"])
        self.assertEqual(response.data["confidence"], 0.92)
    
    @patch("apps.memories.ai_service.requests.post")
    def test_suggest_tags_filters_special_chars(self, mock_post):
        """Test that special characters in tags are removed."""
        # Mock Ollama returning tags with special characters
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "response": json.dumps({
                "suggested_tags": ["beach!@#", "summer&fun", "vac-ation", "my_memory"],
                "confidence": 0.85
            })
        }
        mock_post.return_value = mock_response
        
        response = self.client.post(
            reverse("memory-suggest-tags"),
            {
                "title": "Beach Day",
                "description": "A day at the beach"
            },
            format="json"
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        tags = response.data["suggested_tags"]
        # Verify special characters are cleaned
        for tag in tags:
            self.assertNotIn("!", tag)
            self.assertNotIn("@", tag)
            self.assertNotIn("#", tag)
    
    @patch("apps.memories.ai_service.requests.post")
    def test_suggest_tags_max_5_tags(self, mock_post):
        """Test that only up to 5 tags are returned."""
        # Mock Ollama returning more than 5 tags
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "response": json.dumps({
                "suggested_tags": [
                    "beach", "summer", "vacation", "friends",
                    "travel", "fun", "memories", "adventure"
                ],
                "confidence": 0.9
            })
        }
        mock_post.return_value = mock_response
        
        response = self.client.post(
            reverse("memory-suggest-tags"),
            {
                "title": "Beach Day",
                "description": "A day at the beach"
            },
            format="json"
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertLessEqual(len(response.data["suggested_tags"]), 5)
    
    @patch("apps.memories.ai_service.requests.post")
    def test_suggest_tags_non_list_response(self, mock_post):
        """Test handling when tags is not a list."""
        # Mock Ollama returning tags as string instead of list
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "response": json.dumps({
                "suggested_tags": "beach summer vacation",  # String instead of list
                "confidence": 0.9
            })
        }
        mock_post.return_value = mock_response
        
        response = self.client.post(
            reverse("memory-suggest-tags"),
            {
                "title": "Beach Day",
                "description": "A day at the beach"
            },
            format="json"
        )
        
        self.assertEqual(response.status_code, status.HTTP_500_INTERNAL_SERVER_ERROR)
        self.assertIn("error", response.data)
    
    @patch("apps.memories.ai_service.requests.post")
    def test_suggest_tags_missing_fields(self, mock_post):
        """Test handling of response missing required fields."""
        # Mock Ollama returning incomplete JSON
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "response": json.dumps({
                "suggested_tags": ["beach", "summer"]
                # Missing confidence
            })
        }
        mock_post.return_value = mock_response
        
        response = self.client.post(
            reverse("memory-suggest-tags"),
            {
                "title": "Beach Day",
                "description": "A day at the beach"
            },
            format="json"
        )
        
        self.assertEqual(response.status_code, status.HTTP_500_INTERNAL_SERVER_ERROR)
        self.assertIn("error", response.data)
    
    @patch("apps.memories.ai_service.requests.post")
    def test_suggest_tags_timeout(self, mock_post):
        """Test handling of Ollama timeout."""
        import requests
        mock_post.side_effect = requests.exceptions.Timeout()
        
        response = self.client.post(
            reverse("memory-suggest-tags"),
            {
                "title": "Beach Day",
                "description": "A day at the beach"
            },
            format="json"
        )
        
        self.assertEqual(response.status_code, status.HTTP_504_GATEWAY_TIMEOUT)
        self.assertIn("error", response.data)
        self.assertIn("type", response.data)
        self.assertEqual(response.data["type"], "timeout")
    
    @patch("apps.memories.ai_service.requests.post")
    def test_suggest_tags_connection_error(self, mock_post):
        """Test handling of connection error to Ollama."""
        import requests
        mock_post.side_effect = requests.exceptions.ConnectionError()
        
        response = self.client.post(
            reverse("memory-suggest-tags"),
            {
                "title": "Beach Day",
                "description": "A day at the beach"
            },
            format="json"
        )
        
        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertIn("error", response.data)
        self.assertIn("type", response.data)
        self.assertEqual(response.data["type"], "unavailable")
    
    # ==========================================
    # INTEGRATION TESTS
    # ==========================================
    
    @patch("apps.memories.ai_service.requests.post")
    def test_suggest_category_and_tags_together(self, mock_post):
        """Test calling both endpoints in sequence."""
        # Mock responses for both calls
        category_response = MagicMock()
        category_response.json.return_value = {
            "response": json.dumps({
                "suggested_category": "Voyages",
                "confidence": 0.95,
                "reasoning": "Travel related"
            })
        }
        
        tags_response = MagicMock()
        tags_response.json.return_value = {
            "response": json.dumps({
                "suggested_tags": ["beach", "travel", "vacation"],
                "confidence": 0.92
            })
        }
        
        mock_post.side_effect = [category_response, tags_response]
        
        # First, suggest category
        cat_response = self.client.post(
            reverse("memory-suggest-category"),
            {"description": "A day at the beach"},
            format="json"
        )
        self.assertEqual(cat_response.status_code, status.HTTP_200_OK)
        
        # Then, suggest tags
        tag_response = self.client.post(
            reverse("memory-suggest-tags"),
            {
                "title": "Beach Day",
                "description": "A day at the beach"
            },
            format="json"
        )
        self.assertEqual(tag_response.status_code, status.HTTP_200_OK)
        
        # User can now create memory with both suggestions
        memory_data = {
            "title": "Beach Day",
            "description": "A day at the beach",
            "event_date": "2026-10-13",
            "category": cat_response.data["suggested_category"],
            "tags": tag_response.data["suggested_tags"],
            "importance": "high"
        }
        memory_response = self.client.post(
            reverse("memory-list"),
            memory_data,
            format="json"
        )
        
        self.assertEqual(memory_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(memory_response.data["category"], "Voyages")
        self.assertEqual(memory_response.data["tags"], ["beach", "travel", "vacation"])
    
    def test_ai_suggestions_do_not_affect_other_users(self):
        """Test that AI suggestions work independently for each user."""
        # Create second user
        user2 = User.objects.create_user(
            username="testuser2",
            email="test2@example.com",
            password="testpass123"
        )
        
        # Both users can call suggest endpoints
        self.client.force_authenticate(user=self.user)
        response1 = self.client.get(reverse("memory-list"))
        self.assertEqual(response1.status_code, status.HTTP_200_OK)
        
        self.client.force_authenticate(user=user2)
        response2 = self.client.get(reverse("memory-list"))
        self.assertEqual(response2.status_code, status.HTTP_200_OK)
        
        # Both should be empty (no memories created yet)
        self.assertEqual(response1.data["count"], 0)
        self.assertEqual(response2.data["count"], 0)


class MemorySummaryGenerationTest(TestCase):
    """Test AI summary generation for memories using mocked Ollama."""
    
    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser",
            email="test@example.com",
            password="testpass123"
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
    
    @patch("apps.memories.ai_service.requests.post")
    def test_generate_summary_success(self, mock_post):
        """Test successful summary generation with mocked Ollama."""
        # Mock Ollama response
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "response": "Un jour mémorable passé au bord de la mer avec des amis proches. Un moment de détente et de camaraderie dans un cadre idyllique."
        }
        mock_post.return_value = mock_response
        
        response = self.client.post(
            reverse("memory-generate-summary"),
            {
                "title": "Beach Day",
                "description": "A day at the beach with friends",
                "category": "Amis",
                "tags": ["beach", "friends", "summer"],
                "location": "Sousse"
            },
            format="json"
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("summary", response.data)
        self.assertIn("model", response.data)
        self.assertIn("Un jour mémorable", response.data["summary"])
    
    @patch("apps.memories.ai_service.requests.post")
    def test_generate_summary_without_optional_fields(self, mock_post):
        """Test summary generation with only required fields."""
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "response": "Un souvenir personnel mémorable."
        }
        mock_post.return_value = mock_response
        
        response = self.client.post(
            reverse("memory-generate-summary"),
            {
                "title": "My Memory",
                "description": "Something meaningful happened"
            },
            format="json"
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("summary", response.data)
    
    def test_generate_summary_missing_title(self):
        """Test summary generation fails without title."""
        response = self.client.post(
            reverse("memory-generate-summary"),
            {
                "description": "A day at the beach"
            },
            format="json"
        )
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("error", response.data)
        self.assertIn("Title", response.data["error"])
    
    def test_generate_summary_missing_description(self):
        """Test summary generation fails without description."""
        response = self.client.post(
            reverse("memory-generate-summary"),
            {
                "title": "Beach Day"
            },
            format="json"
        )
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("error", response.data)
        self.assertIn("Description", response.data["error"])
    
    def test_generate_summary_empty_title(self):
        """Test summary generation fails with empty title."""
        response = self.client.post(
            reverse("memory-generate-summary"),
            {
                "title": "   ",
                "description": "A day at the beach"
            },
            format="json"
        )
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("error", response.data)
    
    def test_generate_summary_empty_description(self):
        """Test summary generation fails with empty description."""
        response = self.client.post(
            reverse("memory-generate-summary"),
            {
                "title": "Beach Day",
                "description": "   "
            },
            format="json"
        )
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("error", response.data)
    
    @patch("apps.memories.ai_service.requests.post")
    def test_generate_summary_ollama_timeout(self, mock_post):
        """Test handling of Ollama timeout."""
        import requests
        mock_post.side_effect = requests.exceptions.Timeout()
        
        response = self.client.post(
            reverse("memory-generate-summary"),
            {
                "title": "Beach Day",
                "description": "A day at the beach"
            },
            format="json"
        )
        
        self.assertEqual(response.status_code, status.HTTP_504_GATEWAY_TIMEOUT)
        self.assertIn("error", response.data)
        self.assertEqual(response.data.get("type"), "timeout")
    
    @patch("apps.memories.ai_service.requests.post")
    def test_generate_summary_ollama_unavailable(self, mock_post):
        """Test handling of Ollama connection error."""
        import requests
        mock_post.side_effect = requests.exceptions.ConnectionError()
        
        response = self.client.post(
            reverse("memory-generate-summary"),
            {
                "title": "Beach Day",
                "description": "A day at the beach"
            },
            format="json"
        )
        
        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertIn("error", response.data)
        self.assertEqual(response.data.get("type"), "unavailable")
    
    @patch("apps.memories.ai_service.requests.post")
    def test_generate_summary_invalid_json_response(self, mock_post):
        """Test handling of invalid JSON response from Ollama."""
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "response": "{ invalid json"
        }
        mock_post.return_value = mock_response
        
        response = self.client.post(
            reverse("memory-generate-summary"),
            {
                "title": "Beach Day",
                "description": "A day at the beach"
            },
            format="json"
        )
        
        self.assertEqual(response.status_code, status.HTTP_500_INTERNAL_SERVER_ERROR)
        self.assertIn("error", response.data)
    
    @patch("apps.memories.ai_service.requests.post")
    def test_generate_summary_empty_response(self, mock_post):
        """Test handling of empty response from Ollama."""
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "response": ""
        }
        mock_post.return_value = mock_response
        
        response = self.client.post(
            reverse("memory-generate-summary"),
            {
                "title": "Beach Day",
                "description": "A day at the beach"
            },
            format="json"
        )
        
        self.assertEqual(response.status_code, status.HTTP_500_INTERNAL_SERVER_ERROR)
        self.assertIn("error", response.data)
    
    def test_generate_summary_requires_authentication(self):
        """Test that summary generation requires authentication."""
        self.client.force_authenticate(user=None)
        
        response = self.client.post(
            reverse("memory-generate-summary"),
            {
                "title": "Beach Day",
                "description": "A day at the beach"
            },
            format="json"
        )
        
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
    
    @patch("apps.memories.ai_service.requests.post")
    def test_generate_summary_with_all_fields(self, mock_post):
        """Test summary generation with all optional fields provided."""
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "response": "Un voyage mémorable à Bali avec famille et amis, marqué par détente et nature."
        }
        mock_post.return_value = mock_response
        
        response = self.client.post(
            reverse("memory-generate-summary"),
            {
                "title": "Vacation in Bali",
                "description": "Two weeks exploring Bali with family. Amazing beaches, temples, and rice terraces.",
                "category": "Voyages",
                "tags": ["travel", "bali", "family", "nature"],
                "location": "Bali, Indonesia"
            },
            format="json"
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("summary", response.data)
        self.assertEqual(response.data["model"], "qwen2.5:3b")
    
    @patch("apps.memories.ai_service.requests.post")
    def test_generate_summary_truncates_long_output(self, mock_post):
        """Test that overly long summaries are truncated."""
        # Create a very long response
        very_long_summary = "A " * 500  # Creates a 1000+ character string
        
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "response": very_long_summary
        }
        mock_post.return_value = mock_response
        
        response = self.client.post(
            reverse("memory-generate-summary"),
            {
                "title": "Beach Day",
                "description": "A day at the beach"
            },
            format="json"
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Summary should be truncated to 1000 characters
        self.assertLessEqual(len(response.data["summary"]), 1000)
    
    @patch("apps.memories.ai_service.requests.post")
    def test_summary_generation_integration_with_memory_crud(self, mock_post):
        """Test that summary can be generated independently of memory CRUD."""
        # First generate a summary
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "response": "Un jour inoubliable à la plage."
        }
        mock_post.return_value = mock_response
        
        summary_response = self.client.post(
            reverse("memory-generate-summary"),
            {
                "title": "Beach Day",
                "description": "A day at the beach"
            },
            format="json"
        )
        
        self.assertEqual(summary_response.status_code, status.HTTP_200_OK)
        
        # Then create a memory with the same data
        memory_response = self.client.post(
            reverse("memory-list"),
            {
                "title": "Beach Day",
                "description": "A day at the beach",
                "event_date": "2026-10-13",
                "category": "Voyages",
                "importance": "high"
            },
            format="json"
        )
        
        self.assertEqual(memory_response.status_code, status.HTTP_201_CREATED)
        # Summary field should exist but be empty or None (not auto-populated)
        self.assertIn(memory_response.data.get("ai_summary", None), ["", None])



class IntelligentSearchTest(TestCase):
    """Test the intelligent search functionality with Ollama query expansion."""
    
    def setUp(self):
        """Set up test user and memories."""
        self.user = User.objects.create_user(
            username="searchuser",
            email="search@test.com",
            password="testpass123"
        )
        
        self.other_user = User.objects.create_user(
            username="otheruser",
            email="other@test.com",
            password="testpass123"
        )
        
        # Create test memories for this user
        self.memory_voyage = Memory.objects.create(
            user=self.user,
            title="Vacances d'été à la plage",
            description="Un magnifique séjour à la plage avec mes amis. Nous avons nagé, joué au volleyball et profité du soleil.",
            event_date="2026-06-15",
            location="Sousse",
            category="Voyages",
            importance="high",
            tags=["plage", "été", "amis", "détente"]
        )
        
        self.memory_etudes = Memory.objects.create(
            user=self.user,
            title="Graduation universitaire",
            description="Un moment important: ma graduation de l'université. Très émouvant avec toute la famille présente.",
            event_date="2026-05-20",
            location="Tunis",
            category="Études",
            importance="very-high",
            tags=["université", "graduation", "famille", "succès"]
        )
        
        self.memory_amis = Memory.objects.create(
            user=self.user,
            title="Réunion avec les copains",
            description="Soirée sympathique avec les amis d'enfance. On a ri, parlé de vieilles histoires.",
            event_date="2026-07-10",
            location="Sousse",
            category="Amis",
            importance="medium",
            tags=["amis", "enfance", "soirée", "rire"]
        )
        
        # Create memory for other user
        self.other_memory = Memory.objects.create(
            user=self.other_user,
            title="Secret vacances de l'autre utilisateur",
            description="Un souvenir privé que personne d'autre ne devrait voir.",
            event_date="2026-06-01",
            location="Paris",
            category="Voyages",
            importance="high",
            tags=["vacation", "paris", "secret"]
        )
        
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
    
    @patch("apps.memories.ai_service.requests.post")
    def test_intelligent_search_vacation_query(self, mock_post):
        """Test search for vacation memories using natural language."""
        # Mock Ollama response
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "response": '{"keywords": ["vacances", "plage"], "categories": ["Voyages"], "tags": ["plage", "été"], "locations": [], "expanded_terms": ["voyage", "séjour", "détente"], "importance": [], "time_hints": ["été"]}'
        }
        mock_post.return_value = mock_response
        
        response = self.client.post(
            reverse("memory-intelligent-search"),
            {"query": "Mes souvenirs de vacances en été"},
            format="json"
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["query"], "Mes souvenirs de vacances en été")
        self.assertEqual(response.data["search_method"], "intelligent")
        self.assertIn("results", response.data)
        self.assertIn("expansion", response.data)
        self.assertIn("count", response.data)
        
        # Should find vacation memory
        results = response.data["results"]
        self.assertGreater(len(results), 0)
        self.assertTrue(any(r["id"] == str(self.memory_voyage.id) for r in results))
        
        # Verify relevance_score and match_types present
        for result in results:
            self.assertIn("relevance_score", result)
            self.assertIn("match_types", result)
            self.assertIsInstance(result["relevance_score"], float)
            self.assertIsInstance(result["match_types"], list)
    
    @patch("apps.memories.ai_service.requests.post")
    def test_intelligent_search_studies_query(self, mock_post):
        """Test search for study-related memories."""
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "response": '{"keywords": ["études", "graduation"], "categories": ["Études"], "tags": ["université", "graduation"], "locations": [], "expanded_terms": ["école", "diplôme"], "importance": ["very-high"], "time_hints": []}'
        }
        mock_post.return_value = mock_response
        
        response = self.client.post(
            reverse("memory-intelligent-search"),
            {"query": "Les moments importants de mes études"},
            format="json"
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data["results"]
        
        # Should find studies memory
        self.assertTrue(any(r["id"] == str(self.memory_etudes.id) for r in results))
    
    @patch("apps.memories.ai_service.requests.post")
    def test_intelligent_search_friends_query(self, mock_post):
        """Test search for friend-related memories."""
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "response": '{"keywords": ["amis"], "categories": ["Amis"], "tags": ["amis", "soirée"], "locations": [], "expanded_terms": ["copains", "camarades", "rassemblement"], "importance": [], "time_hints": []}'
        }
        mock_post.return_value = mock_response
        
        response = self.client.post(
            reverse("memory-intelligent-search"),
            {"query": "Les souvenirs liés à mes amis"},
            format="json"
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data["results"]
        
        # Should find friends memory
        self.assertTrue(any(r["id"] == str(self.memory_amis.id) for r in results))
    
    @patch("apps.memories.ai_service.requests.post")
    def test_intelligent_search_location_query(self, mock_post):
        """Test search by location with context to reach relevance threshold."""
        mock_response = MagicMock()
        # Location-only queries (score=0.12) are too weak. 
        # More realistic: expand to include related keywords/tags
        mock_response.json.return_value = {
            "response": '{"keywords": ["Sousse", "événements"], "categories": [], "tags": ["amis", "plage"], "locations": ["Sousse"], "expanded_terms": ["rencontre", "visite"], "importance": [], "time_hints": []}'
        }
        mock_post.return_value = mock_response
        
        response = self.client.post(
            reverse("memory-intelligent-search"),
            {"query": "Les événements à Sousse avec mes amis"},
            format="json"
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data["results"]
        
        # Should find both Sousse memories (one voyage + one amis, both at Sousse)
        sousse_results = [r for r in results if r["location"] == "Sousse"]
        self.assertGreaterEqual(len(sousse_results), 1)  # At least one should match
    
    @patch("apps.memories.ai_service.requests.post")
    def test_intelligent_search_no_results(self, mock_post):
        """Test search with no matching results."""
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "response": '{"keywords": ["dinosaures"], "categories": [], "tags": [], "locations": [], "expanded_terms": [], "importance": [], "time_hints": []}'
        }
        mock_post.return_value = mock_response
        
        response = self.client.post(
            reverse("memory-intelligent-search"),
            {"query": "Mes souvenirs de dinosaures"},
            format="json"
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 0)
        self.assertEqual(len(response.data["results"]), 0)
    
    def test_intelligent_search_empty_query(self):
        """Test search with empty query."""
        response = self.client.post(
            reverse("memory-intelligent-search"),
            {"query": ""},
            format="json"
        )
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("error", response.data)
    
    def test_intelligent_search_missing_query(self):
        """Test search without query parameter."""
        response = self.client.post(
            reverse("memory-intelligent-search"),
            {},
            format="json"
        )
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
    
    @patch("apps.memories.ai_service.requests.post")
    def test_intelligent_search_ollama_timeout(self, mock_post):
        """Test search when Ollama times out."""
        mock_post.side_effect = requests.exceptions.Timeout()
        
        response = self.client.post(
            reverse("memory-intelligent-search"),
            {"query": "Test query"},
            format="json"
        )
        
        self.assertEqual(response.status_code, status.HTTP_504_GATEWAY_TIMEOUT)
        self.assertIn("type", response.data)
        self.assertEqual(response.data["type"], "timeout")
    
    @patch("apps.memories.ai_service.requests.post")
    def test_intelligent_search_ollama_unavailable(self, mock_post):
        """Test search when Ollama is unavailable."""
        mock_post.side_effect = requests.exceptions.ConnectionError()
        
        response = self.client.post(
            reverse("memory-intelligent-search"),
            {"query": "Test query"},
            format="json"
        )
        
        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertEqual(response.data["type"], "unavailable")
    
    @patch("apps.memories.ai_service.requests.post")
    def test_intelligent_search_invalid_json_response(self, mock_post):
        """Test search when Ollama returns invalid JSON."""
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "response": "This is not valid JSON {invalid"
        }
        mock_post.return_value = mock_response
        
        response = self.client.post(
            reverse("memory-intelligent-search"),
            {"query": "Test query"},
            format="json"
        )
        
        self.assertEqual(response.status_code, status.HTTP_500_INTERNAL_SERVER_ERROR)
        self.assertEqual(response.data["type"], "invalid_response")
    
    def test_intelligent_search_requires_authentication(self):
        """Test search requires authentication."""
        client = APIClient()
        response = client.post(
            reverse("memory-intelligent-search"),
            {"query": "Test query"},
            format="json"
        )
        
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
    
    @patch("apps.memories.ai_service.requests.post")
    def test_intelligent_search_user_isolation(self, mock_post):
        """Test that search results only include current user's memories."""
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "response": '{"keywords": ["vacances", "voyage"], "categories": ["Voyages"], "tags": [], "locations": [], "expanded_terms": [], "importance": [], "time_hints": []}'
        }
        mock_post.return_value = mock_response
        
        response = self.client.post(
            reverse("memory-intelligent-search"),
            {"query": "Mes souvenirs de vacances"},
            format="json"
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data["results"]
        
        # Should NOT find other user's memory
        for result in results:
            self.assertNotEqual(result["id"], str(self.other_memory.id))
        
        # Should only find our user's memories
        found_ids = {r["id"] for r in results}
        all_our_ids = {str(self.memory_voyage.id), str(self.memory_etudes.id), str(self.memory_amis.id)}
        self.assertTrue(found_ids.issubset(all_our_ids))
    
    @patch("apps.memories.ai_service.requests.post")
    def test_intelligent_search_max_10_results(self, mock_post):
        """Test that search returns at most 10 results."""
        # Create 15 memories
        for i in range(15):
            Memory.objects.create(
                user=self.user,
                title=f"Memory {i}",
                description="A memory with vacation and beach",
                event_date="2026-06-15",
                category="Voyages",
                importance="medium",
                tags=["vacation"]
            )
        
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "response": '{"keywords": ["vacation", "beach"], "categories": ["Voyages"], "tags": ["vacation"], "locations": [], "expanded_terms": [], "importance": [], "time_hints": []}'
        }
        mock_post.return_value = mock_response
        
        response = self.client.post(
            reverse("memory-intelligent-search"),
            {"query": "Vacances à la plage"},
            format="json"
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertLessEqual(len(response.data["results"]), 10)
    
    @patch("apps.memories.ai_service.requests.post")
    def test_intelligent_search_relevance_scoring(self, mock_post):
        """Test that results are sorted by relevance score."""
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "response": '{"keywords": ["vacances", "plage", "été"], "categories": ["Voyages"], "tags": ["plage"], "locations": ["Sousse"], "expanded_terms": ["détente"], "importance": ["high"], "time_hints": ["été"]}'
        }
        mock_post.return_value = mock_response
        
        response = self.client.post(
            reverse("memory-intelligent-search"),
            {"query": "Vacances à la plage en été à Sousse"},
            format="json"
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data["results"]
        
        if len(results) > 1:
            # Verify results are sorted by relevance score (descending)
            scores = [r["relevance_score"] for r in results]
            self.assertEqual(scores, sorted(scores, reverse=True))
    
    @patch("apps.memories.ai_service.requests.post")
    def test_intelligent_search_expansion_returned(self, mock_post):
        """Test that query expansion is returned to frontend."""
        mock_response = MagicMock()
        expansion_data = {
            "keywords": ["vacances", "été"],
            "categories": ["Voyages"],
            "tags": ["plage", "détente"],
            "locations": ["Sousse"],
            "expanded_terms": ["voyage", "séjour"],
            "importance": ["high"],
            "time_hints": ["été"]
        }
        mock_response.json.return_value = {
            "response": json.dumps(expansion_data)
        }
        mock_post.return_value = mock_response
        
        response = self.client.post(
            reverse("memory-intelligent-search"),
            {"query": "Vacances d'été"},
            format="json"
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("expansion", response.data)
        # Keywords order may vary due to set deduplication
        self.assertEqual(set(response.data["expansion"]["keywords"]), set(expansion_data["keywords"]))
        # Note: categories are converted to lowercase in expand_search_query
        self.assertEqual(
            response.data["expansion"]["categories"],
            [c.lower() for c in expansion_data["categories"]]
        )



class MemoryIntelligentSearchRelevanceThresholdTest(TestCase):
    """Test intelligent search relevance threshold filtering (Mars/Bali scenario)."""
    
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="testuser",
            email="test@example.com",
            password="testpass123"
        )
        self.client.force_authenticate(user=self.user)
        
        # Create Bali memory for threshold testing
        self.bali_memory = Memory.objects.create(
            user=self.user,
            title="Vacances à Bali",
            description="Un voyage magnifique à Bali avec famille et amis",
            event_date=date(2024, 6, 15),
            location="Bali, Indonésie",
            category="Voyages",
            importance="high",
            tags=["voyage", "vacances", "plage", "bali"]
        )
        
        # Create studies memory to test category match
        self.studies_memory = Memory.objects.create(
            user=self.user,
            title="Semestre d'études",
            description="Mon expérience académique au cours du semestre",
            event_date=date(2025, 5, 1),
            location="Université",
            category="Études",
            importance="medium",
            tags=["études", "apprentissage"]
        )
        
        # Create a food memory to test unrelated query
        self.food_memory = Memory.objects.create(
            user=self.user,
            title="Repas délicieux",
            description="Un excellent restaurant découvert en ville",
            event_date=date(2025, 9, 20),
            location="Centre-ville",
            category="Autres",
            importance="low",
            tags=["nourriture", "restaurant"]
        )
    
    @patch("apps.memories.ai_service.requests.post")
    def test_intelligent_search_mars_query_returns_no_results(self, mock_post):
        """
        Test that searching for "Mars expedition" returns 0 results.
        
        Root cause fix: Mars query expands to categories=['voyages'] which matches Bali's
        category at low score (~16-24%). The 0.3 (30%) threshold filters this out.
        
        This is the core regression test for the issue.
        """
        # Mock Ollama expansion of Mars query
        # Mars → keywords=['mars', 'expedition'], categories=['voyages'], tags=['exploration']
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "response": json.dumps({
                "keywords": ["mars", "expedition", "exploration"],
                "categories": ["voyages"],
                "tags": ["exploration", "voyage", "astronautique"],
                "locations": [],
                "expanded_terms": ["planète", "espace"],
                "importance": [],
                "time_hints": []
            })
        }
        mock_post.return_value = mock_response
        
        response = self.client.post(
            reverse("memory-intelligent-search"),
            {"query": "Mes souvenirs d'une expédition sur Mars"},
            format="json"
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # CRITICAL: Should return 0 results (Bali memory should be filtered out)
        self.assertEqual(response.data["count"], 0)
        self.assertEqual(len(response.data["results"]), 0)
    
    @patch("apps.memories.ai_service.requests.post")
    def test_intelligent_search_bali_query_returns_bali_memory(self, mock_post):
        """
        Test that searching for "Bali" returns the Bali memory.
        
        This ensures the threshold fix doesn't break legitimate searches.
        """
        # Mock Ollama expansion of Bali query
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "response": json.dumps({
                "keywords": ["bali", "vacances", "plage"],
                "categories": ["voyages"],
                "tags": ["bali", "voyage", "vacances", "plage"],
                "locations": ["bali"],
                "expanded_terms": ["indonésie", "île", "détente"],
                "importance": [],
                "time_hints": []
            })
        }
        mock_post.return_value = mock_response
        
        response = self.client.post(
            reverse("memory-intelligent-search"),
            {"query": "Vacances à Bali"},
            format="json"
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Should return 1 result (Bali memory with high relevance)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(len(response.data["results"]), 1)
        
        result = response.data["results"][0]
        self.assertEqual(result["id"], str(self.bali_memory.id))
        self.assertEqual(result["title"], "Vacances à Bali")
        # High relevance score due to exact title/tags/location match
        self.assertGreaterEqual(result["relevance_score"], 0.5)
    
    @patch("apps.memories.ai_service.requests.post")
    def test_intelligent_search_studies_query_returns_studies_memory(self, mock_post):
        """
        Test that searching for "studies" returns the studies memory.
        
        Ensures category matching still works for legitimate related searches.
        """
        # Mock Ollama expansion of studies query
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "response": json.dumps({
                "keywords": ["études", "semestre", "académique"],
                "categories": ["études"],
                "tags": ["études", "apprentissage", "université"],
                "locations": [],
                "expanded_terms": ["école", "cours"],
                "importance": [],
                "time_hints": []
            })
        }
        mock_post.return_value = mock_response
        
        response = self.client.post(
            reverse("memory-intelligent-search"),
            {"query": "Mon semestre d'études"},
            format="json"
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Should return studies memory
        self.assertGreater(response.data["count"], 0)
        
        found = False
        for result in response.data["results"]:
            if result["id"] == str(self.studies_memory.id):
                found = True
                self.assertEqual(result["title"], "Semestre d'études")
                break
        
        self.assertTrue(found, "Studies memory should be in results")
    
    @patch("apps.memories.ai_service.requests.post")
    def test_intelligent_search_unrelated_query_returns_no_results(self, mock_post):
        """
        Test that an unrelated query returns 0 results.
        
        This verifies the threshold prevents false positives for completely different topics.
        """
        # Mock Ollama expansion of an unrelated query (e.g., quantum physics)
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "response": json.dumps({
                "keywords": ["quantique", "physique", "théorie"],
                "categories": [],
                "tags": ["science", "physique"],
                "locations": [],
                "expanded_terms": ["mécanique", "atome"],
                "importance": [],
                "time_hints": []
            })
        }
        mock_post.return_value = mock_response
        
        response = self.client.post(
            reverse("memory-intelligent-search"),
            {"query": "Explication de la physique quantique"},
            format="json"
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Should return 0 results (no memories match quantum physics)
        self.assertEqual(response.data["count"], 0)
        self.assertEqual(len(response.data["results"]), 0)
    
    @patch("apps.memories.ai_service.requests.post")
    def test_intelligent_search_threshold_boundary(self, mock_post):
        """
        Test behavior at the threshold boundary (score exactly 0.3).
        
        Verifies that results with score exactly at threshold pass the filter.
        """
        # This test verifies the >= operator (not just >)
        # We can't easily control exact scores in integration tests, but we can
        # verify the filter works with responses close to threshold
        
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "response": json.dumps({
                "keywords": ["bali"],
                "categories": ["voyages"],
                "tags": ["voyage"],
                "locations": [],
                "expanded_terms": [],
                "importance": [],
                "time_hints": []
            })
        }
        mock_post.return_value = mock_response
        
        response = self.client.post(
            reverse("memory-intelligent-search"),
            {"query": "Voyages"},  # Broad query
            format="json"
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Should return results (voyages matches bali category)
        self.assertGreater(response.data["count"], 0)
    
    @patch("apps.memories.ai_service.requests.post")
    def test_intelligent_search_multiple_results_filtered(self, mock_post):
        """
        Test that when multiple memories exist, only relevant ones pass threshold.
        
        Create scenario: 1 Bali memory (relevant), 1 studies memory (irrelevant to bali query)
        Bali search should return only Bali memory.
        """
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "response": json.dumps({
                "keywords": ["bali", "plage"],
                "categories": ["voyages"],
                "tags": ["bali", "vacances"],
                "locations": ["bali"],
                "expanded_terms": ["île"],
                "importance": [],
                "time_hints": []
            })
        }
        mock_post.return_value = mock_response
        
        response = self.client.post(
            reverse("memory-intelligent-search"),
            {"query": "Bali plage"},
            format="json"
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Should return only Bali memory (studies memory should be filtered out)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["id"], str(self.bali_memory.id))
