from rest_framework import serializers
from .models import JournalEntry


class JournalEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = JournalEntry
        fields = [
            "id",
            "title",
            "content",
            "date",
            "mood",
            "tags",
            "favorite",
            "draft",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate_tags(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError("Tags must be a list.")

        if not all(isinstance(tag, str) for tag in value):
            raise serializers.ValidationError("All tags must be strings.")

        return value