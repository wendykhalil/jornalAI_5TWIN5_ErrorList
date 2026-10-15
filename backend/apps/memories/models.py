from django.conf import settings
from django.db import models
import uuid


class Memory(models.Model):
    """
    Memory model for storing personal memories with optional AI summaries
    and links to journal entries.
    """
    
    # Category choices for memory classification
    CATEGORY_CHOICES = [
        ("Familie", "Familie"),
        ("Amis", "Amis"),
        ("Voyages", "Voyages"),
        ("Études", "Études"),
        ("Travail", "Travail"),
        ("Événements personnels", "Événements personnels"),
        ("Célébrations", "Célébrations"),
        ("Autres", "Autres"),
    ]
    
    # Importance level choices
    IMPORTANCE_CHOICES = [
        ("very-high", "Very High"),
        ("high", "High"),
        ("medium", "Medium"),
        ("low", "Low"),
    ]
    
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="memories"
    )
    
    title = models.CharField(max_length=255)
    
    description = models.TextField()
    
    event_date = models.DateField()
    
    location = models.CharField(max_length=255, blank=True)
    
    category = models.CharField(
        max_length=50,
        choices=CATEGORY_CHOICES,
        default="Autres"
    )
    
    importance = models.CharField(
        max_length=20,
        choices=IMPORTANCE_CHOICES,
        default="medium"
    )
    
    tags = models.JSONField(default=list, blank=True)
    
    cover = models.URLField(blank=True, null=True)
    
    favorite = models.BooleanField(default=False)
    
    ai_summary = models.TextField(blank=True, null=True)
    
    related_journal_entry = models.ForeignKey(
        "journal.JournalEntry",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="memory"
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ["-event_date", "-created_at"]
    
    def __str__(self):
        return self.title
