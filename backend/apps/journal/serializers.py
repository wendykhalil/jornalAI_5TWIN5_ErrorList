
from django.utils import timezone
from rest_framework import serializers

from apps.media.models import Media
from .models import JournalEntry


class JournalEntrySerializer(serializers.ModelSerializer):

    # ==========================================
    # PHOTO AND VIDEO ATTACHMENTS
    # ==========================================

    images = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=Media.objects.all(),
        required=False
    )

    class Meta:
        model = JournalEntry

        fields = [
            "id",
            "title",
            "content",
            "date",
            "mood",
            "tags",
            "images",
            "favorite",
            "draft",
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "id",
            "created_at",
            "updated_at",
        ]

    # ==========================================
    # ATTACHMENT SECURITY
    # ==========================================

    def validate_images(self, value):
        request = self.context.get("request")

        if (
            not request
            or not request.user
            or not request.user.is_authenticated
        ):
            raise serializers.ValidationError(
                "Authentication required."
            )

        for media in value:

            # Only attach your own files
            if media.user_id != request.user.pk:
                raise serializers.ValidationError(
                    "You cannot attach another user's media."
                )

            # Only photos and videos
            if media.media_type not in [
                "image",
                "video",
            ]:
                raise serializers.ValidationError(
                    "Only images and videos are allowed."
                )

        return value

    # ==========================================
    # TITLE VALIDATION
    # ==========================================

    def validate_title(self, value):
        value = value.strip()

        if not value:
            raise serializers.ValidationError(
                "Title is required."
            )

        if len(value) < 3:
            raise serializers.ValidationError(
                "Title must contain at least 3 characters."
            )

        if len(value) > 255:
            raise serializers.ValidationError(
                "Title cannot exceed 255 characters."
            )

        return value

    # ==========================================
    # CONTENT VALIDATION
    # ==========================================

    def validate_content(self, value):
        return value.strip()

    # ==========================================
    # DATE VALIDATION
    # ==========================================

    def validate_date(self, value):
        if value > timezone.localdate():
            raise serializers.ValidationError(
                "Journal date cannot be in the future."
            )

        return value

    # ==========================================
    # MOOD VALIDATION
    # ==========================================

    def validate_mood(self, value):
        value = value.strip()

        if not value:
            raise serializers.ValidationError(
                "Mood is required."
            )

        if len(value) > 50:
            raise serializers.ValidationError(
                "Mood cannot exceed 50 characters."
            )

        return value

    # ==========================================
    # TAG VALIDATION
    # ==========================================

    def validate_tags(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError(
                "Tags must be a list."
            )

        if len(value) > 10:
            raise serializers.ValidationError(
                "Maximum 10 tags allowed."
            )

        cleaned_tags = []

        for tag in value:

            if not isinstance(tag, str):
                raise serializers.ValidationError(
                    "All tags must be strings."
                )

            tag = tag.strip()

            if not tag:
                raise serializers.ValidationError(
                    "Tags cannot be empty."
                )

            if len(tag) > 30:
                raise serializers.ValidationError(
                    "Each tag must contain at most 30 characters."
                )

            if tag.lower() in [
                existing.lower()
                for existing in cleaned_tags
            ]:
                raise serializers.ValidationError(
                    "Duplicate tags are not allowed."
                )

            cleaned_tags.append(tag)

        return cleaned_tags

    # ==========================================
    # DRAFT / PUBLISHED VALIDATION
    # ==========================================

    def validate(self, attrs):
        attrs = super().validate(attrs)

        draft = attrs.get(
            "draft",
            self.instance.draft
            if self.instance
            else False
        )

        content = attrs.get(
            "content",
            self.instance.content
            if self.instance
            else ""
        )

        if not draft and not content.strip():
            raise serializers.ValidationError({
                "content": (
                    "Content is required for published entries."
                )
            })

        return attrs
