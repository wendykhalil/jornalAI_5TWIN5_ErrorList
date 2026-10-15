from django.test import TestCase
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from datetime import date

from .models import Memory
from apps.journal.models import JournalEntry

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
