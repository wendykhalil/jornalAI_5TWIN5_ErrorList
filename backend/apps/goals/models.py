import uuid

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


class Goal(models.Model):
    """
    A personal goal with a status and a progression percentage.
    """

    STATUS_CHOICES = [
        ("not-started", "Not started"),
        ("in-progress", "In progress"),
        ("completed", "Completed"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="goals",
    )

    title = models.CharField(max_length=255)

    description = models.TextField(blank=True)

    start_date = models.DateField()

    end_date = models.DateField(blank=True, null=True)

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="not-started",
    )

    progress = models.PositiveSmallIntegerField(
        default=0,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
    )

    created_at = models.DateTimeField(auto_now_add=True)

    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.title


class Habit(models.Model):
    """
    A habit the user wants to follow (daily or weekly).
    """

    FREQUENCY_CHOICES = [
        ("daily", "Daily"),
        ("weekly", "Weekly"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="habits",
    )

    name = models.CharField(max_length=255)

    frequency = models.CharField(
        max_length=10,
        choices=FREQUENCY_CHOICES,
        default="daily",
    )

    created_at = models.DateTimeField(auto_now_add=True)

    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class HabitCheck(models.Model):
    """
    Daily validation of a habit (one row per habit and per date).
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    habit = models.ForeignKey(
        Habit,
        on_delete=models.CASCADE,
        related_name="checks",
    )

    date = models.DateField()

    completed = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date"]
        constraints = [
            models.UniqueConstraint(
                fields=["habit", "date"],
                name="unique_habit_check_per_day",
            )
        ]

    def __str__(self):
        return f"{self.habit} - {self.date}"
