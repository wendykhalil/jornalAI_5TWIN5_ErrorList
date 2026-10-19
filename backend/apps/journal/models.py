
from django.conf import settings
from django.db import models
import uuid


class JournalEntry(models.Model):
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="journal_entries"
    )

    title = models.CharField(max_length=255)

    content = models.TextField()

    date = models.DateField()

    mood = models.CharField(
        max_length=50,
        default="Calme"
    )

    tags = models.JSONField(
        default=list,
        blank=True
    )

    # Photos attached to this journal entry
    images = models.ManyToManyField(
        "media.Media",
        blank=True,
        related_name="journal_entries"
    )

    favorite = models.BooleanField(default=False)

    draft = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)

    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-date", "-created_at"]

    def __str__(self):
        return self.title
