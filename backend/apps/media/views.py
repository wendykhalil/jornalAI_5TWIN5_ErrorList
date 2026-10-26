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
    AudioDurationExceededError,
    NoSpeechDetectedError,
)
from .ai_services import (
    PollinationsImageService,
    AiImageError,
    AiProviderNotConfiguredError,
    InvalidPromptError,
    InvalidSourceImageError,
    AiProviderTimeoutError,
    AiProviderError,
    AiProviderAuthError,
    AiProviderPaymentRequiredError,
    AiProviderRateLimitError,
    AiProviderInvalidImageError,
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

    @action(detail=False, methods=["post"], url_path="transcribe-prompt")
    def transcribe_prompt(self, request):
        """
        Transcribe an ephemeral voice prompt for AI image generation/editing.
        POST /api/media/transcribe-prompt/
        Accepts multipart/form-data with field 'audio' or 'file'.
        Protected by JWT authentication.
        Does NOT create any Media record in the database.
        Enforces a 10 MB size limit and a 30-second duration limit.
        """
        audio_file = request.FILES.get("audio") or request.FILES.get("file")
        if not audio_file:
            return Response(
                {
                    "error": "Aucun fichier audio n'a été fourni dans la requête.",
                    "code": "missing_audio",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            result = AudioTranscriptionService.transcribe_audio_prompt(
                audio_file=audio_file,
                max_duration=30.0,
            )
            return Response(
                {
                    "text": result["text"],
                    "language": result["language"],
                    "duration": result["duration"],
                },
                status=status.HTTP_200_OK,
            )
        except AudioDurationExceededError as exc:
            return Response(
                {"error": str(exc), "code": "duration_exceeded"},
                status=status.HTTP_400_BAD_REQUEST,
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
        except AudioTranscriptionError as exc:
            logger.error("Audio prompt transcription error: %s", exc)
            return Response(
                {
                    "error": "La transcription a échoué en raison d'une erreur interne du moteur audio.",
                    "code": "transcription_error",
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

    @action(detail=False, methods=["post"], url_path="ai-generate")
    def ai_generate(self, request):
        """
        Generate an image from a prompt using Pollinations AI.
        POST /api/media/ai-generate/
        Body: { "prompt": str, "style": str (opt), "aspect_ratio": "1:1"|"16:9"|"4:5" (opt), "seed": int (opt) }
        Protected by JWT authentication.
        Does NOT persist any Media record in the database.
        """
        prompt = request.data.get("prompt")
        style = request.data.get("style")
        aspect_ratio = request.data.get("aspect_ratio", "1:1")
        seed = request.data.get("seed")

        try:
            result = PollinationsImageService.generate_image(
                prompt=prompt,
                style=style,
                aspect_ratio=aspect_ratio,
                seed=seed,
            )
            return Response(result, status=status.HTTP_200_OK)
        except InvalidPromptError as exc:
            return Response(
                {"error": str(exc), "code": "invalid_prompt"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except AiProviderNotConfiguredError as exc:
            return Response(
                {"error": str(exc), "code": "provider_not_configured"},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        except AiProviderRateLimitError as exc:
            return Response(
                {"error": str(exc), "code": "provider_rate_limited"},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )
        except AiProviderAuthError as exc:
            return Response(
                {"error": str(exc), "code": "provider_auth_error"},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        except AiProviderPaymentRequiredError as exc:
            return Response(
                {"error": str(exc), "code": "provider_insufficient_credits"},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        except AiProviderInvalidImageError as exc:
            return Response(
                {"error": str(exc), "code": "provider_invalid_image"},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        except AiProviderTimeoutError as exc:
            return Response(
                {"error": str(exc), "code": "provider_timeout"},
                status=status.HTTP_504_GATEWAY_TIMEOUT,
            )
        except AiProviderError as exc:
            return Response(
                {"error": str(exc), "code": "provider_error"},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        except Exception as exc:
            logger.error("Unexpected error during ai_generate: %s", exc)
            return Response(
                {"error": "Erreur inattendue lors de la génération d'image.", "code": "generation_error"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @action(detail=True, methods=["post"], url_path="ai-edit")
    def ai_edit(self, request, pk=None):
        """
        Edit an existing image Media instance using an instruction prompt.
        POST /api/media/{id}/ai-edit/
        Body: { "prompt": str, "seed": int (opt) }
        Protected by JWT authentication and user ownership isolation (self.get_object()).
        Does NOT overwrite or modify the original Media instance.
        """
        media = self.get_object()
        prompt = request.data.get("prompt")
        seed = request.data.get("seed")

        try:
            result = PollinationsImageService.edit_image(
                media_instance=media,
                prompt=prompt,
                seed=seed,
            )
            return Response(result, status=status.HTTP_200_OK)
        except InvalidPromptError as exc:
            return Response(
                {"error": str(exc), "code": "invalid_prompt"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except InvalidSourceImageError as exc:
            return Response(
                {"error": str(exc), "code": "invalid_source_image"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except AiProviderNotConfiguredError as exc:
            return Response(
                {"error": str(exc), "code": "provider_not_configured"},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        except AiProviderRateLimitError as exc:
            return Response(
                {"error": str(exc), "code": "provider_rate_limited"},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )
        except AiProviderAuthError as exc:
            return Response(
                {"error": str(exc), "code": "provider_auth_error"},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        except AiProviderPaymentRequiredError as exc:
            return Response(
                {"error": str(exc), "code": "provider_insufficient_credits"},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        except AiProviderInvalidImageError as exc:
            return Response(
                {"error": str(exc), "code": "provider_invalid_image"},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        except AiProviderTimeoutError as exc:
            return Response(
                {"error": str(exc), "code": "provider_timeout"},
                status=status.HTTP_504_GATEWAY_TIMEOUT,
            )
        except AiProviderError as exc:
            return Response(
                {"error": str(exc), "code": "provider_error"},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        except Exception as exc:
            logger.error("Unexpected error during ai_edit on media %s: %s", media.id, exc)
            return Response(
                {"error": "Erreur inattendue lors de l'édition d'image.", "code": "edit_error"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


def get_authenticated_user_from_request(request):
    """
    Extracts authenticated user from:
    1. Standard DRF/Django request.user (if already authenticated)
    2. HTTP Authorization header: Bearer <token>
    3. Secure, HttpOnly Cookie: access_token=<token>
    (Query parameter tokens are strictly prohibited for security).
    """
    if getattr(request, "user", None) and request.user.is_authenticated:
        return request.user

    raw_token = None
    auth_header = request.headers.get("Authorization") or request.META.get("HTTP_AUTHORIZATION", "")
    if auth_header.startswith("Bearer "):
        raw_token = auth_header.split(" ", 1)[1].strip()

    if not raw_token:
        raw_token = request.COOKIES.get("access_token")

    if not raw_token:
        return None

    from django.contrib.auth import get_user_model
    from rest_framework_simplejwt.tokens import AccessToken
    from rest_framework_simplejwt.exceptions import InvalidToken, TokenError

    User = get_user_model()
    try:
        validated_token = AccessToken(raw_token)
        user_id = validated_token.get("user_id")
        if not user_id:
            return None
        return User.objects.filter(pk=user_id, is_active=True).first()
    except (InvalidToken, TokenError, Exception):
        return None


def serve_private_media(request, file_path):
    """
    Secure endpoint for private user media files.
    Enforces authentication and per-user authorization.

    In production (with Nginx): returns X-Accel-Redirect header for high-performance streaming.
    In development/testing: serves file via Django FileResponse.
    """
    import mimetypes
    import os
    import sys
    from django.conf import settings
    from django.http import HttpResponse, HttpResponseForbidden, FileResponse, Http404
    from django.db.models import Q

    # 1. Path normalization and traversal protection
    clean_path = os.path.normpath(file_path).lstrip("/")
    if clean_path.startswith("..") or os.path.isabs(clean_path):
        return HttpResponseForbidden("Chemin d'accès invalide.")

    # 2. Authentication check
    user = get_authenticated_user_from_request(request)
    if not user or not user.is_authenticated:
        return HttpResponse("Authentification requise pour accéder à ce média.", status=401)

    # 3. Per-user Authorization check
    is_authorized = user.is_staff or user.is_superuser
    if not is_authorized:
        path_without_media = clean_path.removeprefix("media/").lstrip("/")
        is_authorized = Media.objects.filter(
            Q(file=clean_path) |
            Q(file=f"media/{clean_path}") |
            Q(file=path_without_media) |
            Q(file=f"media/{path_without_media}"),
            user=user
        ).exists()

    if not is_authorized:
        return HttpResponseForbidden("Accès refusé : vous n'avez pas l'autorisation d'accéder à ce média.")

    # 4. Verify physical file existence
    full_disk_path = os.path.join(settings.MEDIA_ROOT, clean_path)
    if not os.path.isfile(full_disk_path):
        alt_path = os.path.join(settings.MEDIA_ROOT, clean_path.removeprefix("media/").lstrip("/"))
        if os.path.isfile(alt_path):
            full_disk_path = alt_path

    if not os.path.isfile(full_disk_path):
        raise Http404("Fichier média introuvable sur le disque.")

    # 5. Determine MIME type
    content_type, _ = mimetypes.guess_type(full_disk_path)
    if not content_type:
        content_type = "application/octet-stream"

    # 6. Service via X-Accel-Redirect (Nginx production) or FileResponse (Dev/Testing)
    use_accel = getattr(settings, "USE_X_ACCEL_REDIRECT", False)
    is_testing = "test" in sys.argv or getattr(settings, "IS_TESTING", False)

    if use_accel and not is_testing:
        rel_to_media_root = os.path.relpath(full_disk_path, settings.MEDIA_ROOT).lstrip("/")
        response = HttpResponse()
        response["X-Accel-Redirect"] = f"/protected_media/{rel_to_media_root}"
        response["Content-Type"] = content_type
        response["Cache-Control"] = "private, max-age=604800"
        return response

    return FileResponse(open(full_disk_path, "rb"), content_type=content_type)
