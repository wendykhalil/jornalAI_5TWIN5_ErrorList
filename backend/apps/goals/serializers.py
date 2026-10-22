from datetime import date

from rest_framework import serializers

from .models import Goal, Habit, HabitCheck


class GoalSerializer(serializers.ModelSerializer):
    """Serializer for Goal with validation of progress and dates."""

    class Meta:
        model = Goal
        fields = [
            "id",
            "title",
            "description",
            "start_date",
            "end_date",
            "status",
            "progress",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate_progress(self, value):
        if value < 0 or value > 100:
            raise serializers.ValidationError("Progress must be between 0 and 100.")
        return value

    def validate_status(self, value):
        valid = [choice[0] for choice in Goal.STATUS_CHOICES]
        if value not in valid:
            raise serializers.ValidationError(
                f"Invalid status. Must be one of: {', '.join(valid)}"
            )
        return value

    def validate(self, attrs):
        start = attrs.get("start_date", getattr(self.instance, "start_date", None))
        end = attrs.get("end_date", getattr(self.instance, "end_date", None))
        if start and end and end < start:
            raise serializers.ValidationError(
                {"end_date": "End date cannot be before the start date."}
            )
        return attrs


class HabitCheckSerializer(serializers.ModelSerializer):
    class Meta:
        model = HabitCheck
        fields = ["id", "habit", "date", "completed", "created_at"]
        read_only_fields = ["id", "habit", "created_at"]


class HabitSerializer(serializers.ModelSerializer):
    """Serializer for Habit, with today's validation state."""

    completed_today = serializers.SerializerMethodField()

    class Meta:
        model = Habit
        fields = [
            "id",
            "name",
            "frequency",
            "completed_today",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "completed_today", "created_at", "updated_at"]

    def get_completed_today(self, obj):
        return obj.checks.filter(date=date.today(), completed=True).exists()

    def validate_frequency(self, value):
        valid = [choice[0] for choice in Habit.FREQUENCY_CHOICES]
        if value not in valid:
            raise serializers.ValidationError(
                f"Invalid frequency. Must be one of: {', '.join(valid)}"
            )
        return value
