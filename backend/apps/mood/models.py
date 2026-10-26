from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone
import uuid


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
