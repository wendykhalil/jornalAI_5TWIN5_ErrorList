
from django.utils import timezone
from rest_framework import serializers

from apps.media.models import Media
from .models import JournalEntry


class JournalAttachmentSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = Media
        fields = [
            "id",
            "title",
            "description",
            "media_type",
            "file_url",
            "created_at",
        ]
        read_only_fields = fields

    def get_file_url(self, obj):
        if not obj.file:
            return None

        request = self.context.get("request")
        url = obj.file.url

        return request.build_absolute_uri(url) if request else url


class JournalEntrySerializer(serializers.ModelSerializer):
    images = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=Media.objects.all(),
        required=False,
    )

    attachments = JournalAttachmentSerializer(
        source="images",
        many=True,
        read_only=True,
    )

    author = serializers.SerializerMethodField()

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
            "attachments",
            "author",
            "favorite",
            "draft",
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "id",
            "attachments",
            "author",
            "created_at",
            "updated_at",
        ]

    def get_author(self, obj):
        request = self.context.get("request")

        # Do not expose another user's identity through
        # ordinary journal endpoints.
        if not request or not request.user.is_authenticated:
            return None

        if (
            request.user.pk != obj.user_id
            and not (
                getattr(request.user, "role", None) == "admin"
                or request.user.is_superuser
            )
        ):
            return None

        user = obj.user

        return {
            "id": user.pk,
            "username": user.username,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "email": user.email,
        }

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
            if media.user_id != request.user.pk:
                raise serializers.ValidationError(
                    "You cannot attach another user's media."
                )

            if media.media_type not in ["image", "video"]:
                raise serializers.ValidationError(
                    "Only images and videos are allowed."
                )

        return value

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

    def validate_content(self, value):
        return value.strip()

    def validate_date(self, value):
        if value > timezone.localdate():
            raise serializers.ValidationError(
                "Journal date cannot be in the future."
            )

        return value

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

    def validate(self, attrs):
        attrs = super().validate(attrs)

        draft = attrs.get(
            "draft",
            self.instance.draft if self.instance else False,
        )

        content = attrs.get(
            "content",
            self.instance.content if self.instance else "",
        )

        if not draft and not content.strip():
            raise serializers.ValidationError({
                "content": "Content is required for published entries."
            })

        return attrs
