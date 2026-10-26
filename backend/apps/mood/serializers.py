from django.utils import timezone
from rest_framework import serializers

from .models import MoodCheck, MoodNoteAnalysis


def serialize_note_analysis(analysis, note):
    if analysis is None:
        return None
    current = analysis.matches_note(note)
    return {
        "status": "available" if current else "stale",
        "emotions_secondary": analysis.emotions_secondary,
        "themes": analysis.themes,
        "evidence": analysis.evidence,
        "summary": analysis.summary,
        "limitations": analysis.limitations,
        "model_name": analysis.model_name,
        "analyzed_at": analysis.analyzed_at,
        "current": current,
    }


class MoodCheckSerializer(serializers.ModelSerializer):
    note_analysis = serializers.SerializerMethodField()

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
            "note_analysis",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "note_analysis"]
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

    def get_note_analysis(self, obj):
        try:
            analysis = obj.note_analysis
        except MoodNoteAnalysis.DoesNotExist:
            return None
        return serialize_note_analysis(analysis, obj.note)
