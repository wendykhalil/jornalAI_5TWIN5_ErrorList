
from django.utils import timezone
from rest_framework import serializers

from apps.media.models import Media
from .models import JournalEntry


# ==========================================
# JOURNAL VALIDATION LIMITS
# ==========================================

MAX_TITLE_LENGTH = 255
MAX_CONTENT_LENGTH = 12000
MAX_MOOD_LENGTH = 50
MAX_TAGS = 10
MAX_TAG_LENGTH = 30
MAX_ATTACHMENTS = 20


# ==========================================
# JOURNAL ATTACHMENT SERIALIZER
# ==========================================

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


# ==========================================
# JOURNAL ENTRY SERIALIZER
# ==========================================

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
            "pinned",
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

        extra_kwargs = {
            "title": {
                "required": False,
                "allow_blank": True,
            },
            "content": {
                "required": False,
                "allow_blank": True,
            },
            "mood": {
                "required": False,
                "allow_blank": True,
            },
            "date": {
                "required": False,
            },
        }

    # ==========================================
    # AUTHOR INFORMATION
    # ==========================================

    def get_author(self, obj):
        request = self.context.get("request")

        if (
            not request
            or not request.user.is_authenticated
        ):
            return None

        is_owner = request.user.pk == obj.user_id

        is_admin = (
            getattr(request.user, "role", None) == "admin"
            or request.user.is_superuser
        )

        if not is_owner and not is_admin:
            return None

        user = obj.user

        return {
            "id": user.pk,
            "username": user.username,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "email": user.email,
        }

    # ==========================================
    # VALIDATION: TITLE
    # ==========================================

    def validate_title(self, value):
        if not isinstance(value, str):
            raise serializers.ValidationError(
                "Le titre doit être un texte."
            )

        value = value.strip()

        if value and len(value) < 3:
            raise serializers.ValidationError(
                "Le titre doit contenir au moins 3 caractères."
            )

        if len(value) > MAX_TITLE_LENGTH:
            raise serializers.ValidationError(
                f"Le titre ne doit pas dépasser "
                f"{MAX_TITLE_LENGTH} caractères."
            )

        return value

    # ==========================================
    # VALIDATION: CONTENT
    # ==========================================

    def validate_content(self, value):
        if not isinstance(value, str):
            raise serializers.ValidationError(
                "Le contenu doit être un texte."
            )

        value = value.strip()

        if len(value) > MAX_CONTENT_LENGTH:
            raise serializers.ValidationError(
                f"Le contenu ne doit pas dépasser "
                f"{MAX_CONTENT_LENGTH} caractères."
            )

        return value

    # ==========================================
    # VALIDATION: DATE
    # ==========================================

    def validate_date(self, value):
        if value is None:
            raise serializers.ValidationError(
                "Veuillez sélectionner une date."
            )

        if value > timezone.localdate():
            raise serializers.ValidationError(
                "La date ne peut pas être dans le futur."
            )

        return value

    # ==========================================
    # VALIDATION: MOOD
    # ==========================================

    def validate_mood(self, value):
        if not isinstance(value, str):
            raise serializers.ValidationError(
                "L'humeur doit être un texte."
            )

        value = value.strip()

        if len(value) > MAX_MOOD_LENGTH:
            raise serializers.ValidationError(
                f"L'humeur ne doit pas dépasser "
                f"{MAX_MOOD_LENGTH} caractères."
            )

        return value

    # ==========================================
    # VALIDATION: TAGS
    # ==========================================

    def validate_tags(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError(
                "Les tags doivent être une liste."
            )

        if len(value) > MAX_TAGS:
            raise serializers.ValidationError(
                f"Vous pouvez ajouter au maximum "
                f"{MAX_TAGS} tags."
            )

        cleaned_tags = []
        seen_tags = set()

        for tag in value:
            if not isinstance(tag, str):
                raise serializers.ValidationError(
                    "Chaque tag doit être un texte."
                )

            tag = tag.strip()

            if not tag:
                raise serializers.ValidationError(
                    "Les tags vides ne sont pas autorisés."
                )

            if len(tag) > MAX_TAG_LENGTH:
                raise serializers.ValidationError(
                    f"Chaque tag ne doit pas dépasser "
                    f"{MAX_TAG_LENGTH} caractères."
                )

            normalized = tag.casefold()

            if normalized in seen_tags:
                raise serializers.ValidationError(
                    f"Le tag '{tag}' est présent plusieurs fois."
                )

            seen_tags.add(normalized)
            cleaned_tags.append(tag)

        return cleaned_tags

    # ==========================================
    # VALIDATION: ATTACHMENTS
    # ==========================================

    def validate_images(self, value):
        request = self.context.get("request")

        if (
            not request
            or not request.user
            or not request.user.is_authenticated
        ):
            raise serializers.ValidationError(
                "Vous devez être connecté pour ajouter des médias."
            )

        if len(value) > MAX_ATTACHMENTS:
            raise serializers.ValidationError(
                f"Vous pouvez joindre au maximum "
                f"{MAX_ATTACHMENTS} médias."
            )

        seen_ids = set()

        for media in value:

            if media.pk in seen_ids:
                raise serializers.ValidationError(
                    "Un même média ne peut pas être ajouté deux fois."
                )

            seen_ids.add(media.pk)

            if media.user_id != request.user.pk:
                raise serializers.ValidationError(
                    "Vous ne pouvez pas utiliser "
                    "les médias d'un autre utilisateur."
                )

            if media.media_type not in ("image", "video"):
                raise serializers.ValidationError(
                    "Seules les images et les vidéos "
                    "sont autorisées."
                )

            if not media.file:
                raise serializers.ValidationError(
                    "Un média sélectionné ne contient aucun fichier."
                )

        return value

    # ==========================================
    # GLOBAL VALIDATION
    # ==========================================

    def validate(self, attrs):
        attrs = super().validate(attrs)

        instance = self.instance

        draft = attrs.get(
            "draft",
            instance.draft if instance else False,
        )

        title = attrs.get(
            "title",
            instance.title if instance else "",
        )

        content = attrs.get(
            "content",
            instance.content if instance else "",
        )

        mood = attrs.get(
            "mood",
            instance.mood if instance else "",
        )

        entry_date = attrs.get(
            "date",
            instance.date if instance else None,
        )

        errors = {}

        # ======================================
        # PUBLISHED ENTRY VALIDATION
        # ======================================

        if not draft:

            if not isinstance(title, str) or not title.strip():
                errors["title"] = (
                    "Le titre est obligatoire."
                )

            elif len(title.strip()) < 3:
                errors["title"] = (
                    "Le titre doit contenir au moins 3 caractères."
                )

            if not isinstance(content, str) or not content.strip():
                errors["content"] = (
                    "Le contenu du journal est obligatoire."
                )

            if not isinstance(mood, str) or not mood.strip():
                errors["mood"] = (
                    "Veuillez sélectionner une humeur."
                )

            if entry_date is None:
                errors["date"] = (
                    "Veuillez sélectionner une date."
                )

        # ======================================
        # DRAFT VALIDATION
        # ======================================

        # Drafts may have empty title, content,
        # and mood. Any supplied values are
        # still checked by their field validators.

        # ======================================
        # RETURN ERRORS
        # ======================================

        if errors:
            raise serializers.ValidationError(errors)

        return attrs
