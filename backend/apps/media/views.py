import logging
from django.db import transaction
from django.core.files.storage import default_storage
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

from .models import Media
from .serializers import MediaSerializer
from .services import (
    AudioTranscriptionService,
    AudioTranscriptionError,
    AudioTranscriptionUnavailableError,
    AudioTranscriptionBusyError,
    AudioFileNotFoundError,
    InvalidAudioFileError,
    NoSpeechDetectedError,
)

logger = logging.getLogger(__name__)


class MediaViewSet(viewsets.ModelViewSet):
    """
    API ViewSet for managing user media files.
    
    Features:
    - JWT authentication required
    - User isolation: users only see their own media
    - Auto-set owner on creation
    - Support for multipart form data (file uploads) and JSON PATCH
    - Standard CRUD operations with DefaultRouter
    - Secure physical file cleanup on deletion
    """
    serializer_class = MediaSerializer
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    parser_classes = (MultiPartParser, FormParser, JSONParser)
    
    def get_queryset(self):
        """Filter media to current user only."""
        return Media.objects.filter(
            user=self.request.user
        ).order_by("-created_at")
    
    def perform_create(self, serializer):
        """Auto-set the current user as the media owner."""
        serializer.save(user=self.request.user)

    def perform_destroy(self, instance):
        """
        Delete media database record and securely clean up the physical file.
        Physical deletion occurs only after database commit, and only if no other
        Media instance references the same physical storage file.
        """
        with transaction.atomic():
            file_field = instance.file
            file_name = file_field.name if file_field else None
            storage = (
                getattr(file_field, "storage", default_storage)
                if file_field
                else default_storage
            )
            instance_pk = instance.pk

            # Check if any other Media instance references this exact storage file
            has_other_references = (
                Media.objects.exclude(pk=instance_pk).filter(file=file_name).exists()
                if file_name
                else False
            )

            # Delete the database record (removes M2M relations and DB row)
            instance.delete()

            # Clean up the physical file strictly on transaction commit
            if file_name and not has_other_references:
                def cleanup_file():
                    try:
                        # Double-check post-commit that no other instance references this file
                        if not Media.objects.filter(file=file_name).exists():
                            if storage.exists(file_name):
                                storage.delete(file_name)
                    except Exception as exc:
                        logger.error(
                            f"Error deleting physical file '{file_name}' from storage: {exc}"
                        )

                transaction.on_commit(cleanup_file)

    @action(detail=True, methods=["post"], url_path="transcribe")
    def transcribe(self, request, pk=None):
        """
        Transcribe an existing audio media file.
        POST /api/media/{id}/transcribe/
        Protected by JWT authentication and user ownership isolation.
        Does NOT automatically overwrite media.description.
        """
        media = self.get_object()

        if media.media_type != "audio":
            return Response(
                {
                    "error": "Seuls les fichiers de type audio peuvent être transcrits.",
                    "code": "invalid_media_type",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not media.file:
            return Response(
                {
                    "error": "Aucun fichier audio n'est rattaché à ce média.",
                    "code": "missing_file",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            result = AudioTranscriptionService.transcribe_media(media)
            return Response(
                {
                    "id": str(media.id),
                    "text": result["text"],
                    "language": result["language"],
                    "duration": result["duration"],
                    "model": result["model"],
                },
                status=status.HTTP_200_OK,
            )
        except AudioTranscriptionUnavailableError as exc:
            return Response(
                {"error": str(exc), "code": "service_unavailable"},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        except AudioTranscriptionBusyError as exc:
            return Response(
                {"error": str(exc), "code": "service_busy"},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        except AudioFileNotFoundError as exc:
            return Response(
                {"error": str(exc), "code": "file_not_found"},
                status=status.HTTP_404_NOT_FOUND,
            )
        except InvalidAudioFileError as exc:
            return Response(
                {"error": str(exc), "code": "invalid_audio"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except NoSpeechDetectedError as exc:
            return Response(
                {"error": str(exc), "code": "no_speech_detected"},
                status=status.HTTP_422_UNPROCESSABLE_ENTITY,
            )
        except AudioTranscriptionError as exc:
            logger.error("Audio transcription error on media %s: %s", media.id, exc)
            return Response(
                {
                    "error": "La transcription a échoué en raison d'une erreur interne.",
                    "code": "transcription_error",
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
