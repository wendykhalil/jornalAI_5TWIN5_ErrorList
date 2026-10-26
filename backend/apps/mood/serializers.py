from django.utils import timezone
from rest_framework import serializers

from .models import MoodCheck


class MoodCheckSerializer(serializers.ModelSerializer):
    class Meta:
        model = MoodCheck
        fields = [
            "id",
            "mood",
            "intensity",
            "note",
            "date",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]
        extra_kwargs = {
            "date": {"required": False},
            "note": {"required": False, "allow_blank": True},
        }

    def validate_mood(self, value):
        value = (value or "").strip()
        allowed = [choice[0] for choice in MoodCheck.MOOD_CHOICES]
        if value not in allowed:
            raise serializers.ValidationError(
                "Choisissez une humeur proposée."
            )
        return value

    def validate_intensity(self, value):
        if value < 1 or value > 5:
            raise serializers.ValidationError(
                "L’intensité doit être comprise entre 1 et 5."
            )
        return value

    def validate_note(self, value):
        value = (value or "").strip()
        if len(value) > 2000:
            raise serializers.ValidationError(
                "La note ne peut pas dépasser 2000 caractères."
            )
        return value

    def validate_date(self, value):
        if value > timezone.now():
            raise serializers.ValidationError(
                "La date ne peut pas être dans le futur."
            )
        return value
