import hashlib
import uuid

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone


class MoodCheck(models.Model):
    """A personal mood check-in belonging to one user."""

    MOOD_CHOICES = [
        ("Heureux", "Heureux"),
        ("Calme", "Calme"),
        ("Motivé", "Motivé"),
        ("Reconnaissant", "Reconnaissant"),
        ("Neutre", "Neutre"),
        ("Fatigué", "Fatigué"),
        ("Stressé", "Stressé"),
        ("Triste", "Triste"),
        ("Anxieux", "Anxieux"),
    ]

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="mood_checks",
    )

    mood = models.CharField(max_length=30, choices=MOOD_CHOICES)

    intensity = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)],
    )

    note = models.TextField(blank=True, default="")

    date = models.DateTimeField(default=timezone.now)

    created_at = models.DateTimeField(auto_now_add=True)

    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-date", "-created_at"]
        indexes = [
            models.Index(fields=["user", "date"]),
            models.Index(fields=["user", "mood"]),
        ]

    def __str__(self):
        return f"{self.mood} ({self.intensity}/5)"


def mood_note_fingerprint(note):
    """Hash of the stored note. The note text itself is not copied."""
    return hashlib.sha256((note or "").encode("utf-8")).hexdigest()


class MoodNoteAnalysis(models.Model):
    """NLP reading of one check-in note. Deleted with the check-in."""

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    mood_check = models.OneToOneField(
        MoodCheck,
        on_delete=models.CASCADE,
        related_name="note_analysis",
    )

    emotions_secondary = models.JSONField(default=list)
    themes = models.JSONField(default=list)
    evidence = models.JSONField(default=list)
    summary = models.TextField()
    limitations = models.TextField(blank=True, default="")
    model_name = models.CharField(max_length=128)
    text_sha256 = models.CharField(max_length=64)
    analyzed_at = models.DateTimeField()

    class Meta:
        ordering = ["-analyzed_at"]

    def __str__(self):
        return f"Analyse {self.mood_check_id}"

    def matches_note(self, note):
        return self.text_sha256 == mood_note_fingerprint(note)


class MoodNoteEmbedding(models.Model):
    """Semantic vector of one check-in note. Deleted with the check-in.

    The vector compares texts. It is not an emotion or a diagnosis.
    """

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    mood_check = models.OneToOneField(
        MoodCheck,
        on_delete=models.CASCADE,
        related_name="note_embedding",
    )

    vector = models.JSONField()
    dimensions = models.PositiveIntegerField()
    text_sha256 = models.CharField(max_length=64)
    model_name = models.CharField(max_length=128)
    generated_at = models.DateTimeField()

    class Meta:
        ordering = ["-generated_at"]

    def __str__(self):
        return f"Embedding {self.mood_check_id}"

    def matches_note(self, note, model_name):
        return (
            self.text_sha256 == mood_note_fingerprint(note)
            and self.model_name == model_name
        )
