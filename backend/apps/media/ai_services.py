"""
backend/apps/media/ai_services.py
AI Image Generation and Editing adapter for Pollinations AI (Group 3 - Media).

Features:
- Text-to-Image (T2I) via Pollinations AI (default: black-forest-labs/flux.1-schnell)
- Image-to-Image (I2I) editing via Pollinations AI (default: black-forest-labs/flux.1-kontext-pro)
- Configuration via environment variables:
    POLLINATIONS_API_KEY (required for live generation, no secrets hardcoded)
    POLLINATIONS_API_BASE_URL (default: https://gen.pollinations.ai)
    POLLINATIONS_IMAGE_MODEL (default: black-forest-labs/flux.1-schnell)
    POLLINATIONS_EDIT_MODEL (default: black-forest-labs/flux.1-kontext-pro)
    POLLINATIONS_TIMEOUT (default: 30 seconds)
- Strict validation: prompt length (1-1000 chars), image formats, size limits
- Zero external requests when unconfigured (raises AiProviderNotConfiguredError)
- Ephemeral generation: returns base64 data for preview, never overwrites original Media
- No mock hacks in production code
"""

import base64
import logging
import os
from pathlib import Path
from urllib.parse import quote
import requests

from .serializers import MAX_FILE_SIZES, detect_file_format

logger = logging.getLogger(__name__)

# Environment variable keys
ENV_API_KEY = "POLLINATIONS_API_KEY"
ENV_BASE_URL = "POLLINATIONS_API_BASE_URL"
ENV_IMAGE_MODEL = "POLLINATIONS_IMAGE_MODEL"
ENV_EDIT_MODEL = "POLLINATIONS_EDIT_MODEL"
ENV_TIMEOUT = "POLLINATIONS_TIMEOUT"

# Defaults
DEFAULT_BASE_URL = "https://gen.pollinations.ai"
DEFAULT_IMAGE_MODEL = "black-forest-labs/flux.1-schnell"
DEFAULT_EDIT_MODEL = "black-forest-labs/flux.1-kontext-pro"
DEFAULT_TIMEOUT_SECONDS = 30.0

MAX_PROMPT_LENGTH = 1000
ALLOWED_ASPECT_RATIOS = {
    "1:1": (1024, 1024),
    "16:9": (1280, 720),
    "4:5": (816, 1024),
    "9:16": (720, 1280),
}


class AiImageError(Exception):
    """Base exception for AI image operations."""
    pass


class AiProviderNotConfiguredError(AiImageError):
    """Raised when Pollinations API key is not configured."""
    pass


class InvalidPromptError(AiImageError):
    """Raised when prompt is empty or exceeds length limits."""
    pass


class InvalidSourceImageError(AiImageError):
    """Raised when source media for editing is missing, non-image, or invalid."""
    pass


class AiProviderTimeoutError(AiImageError):
    """Raised when Pollinations API request times out."""
    pass


class AiProviderError(AiImageError):
    """Raised when Pollinations API returns an error or unparseable response."""
    pass


class AiProviderAuthError(AiProviderError):
    """Raised when Pollinations returns 401 or 403 (invalid API key or unauthorized)."""
    pass


class AiProviderPaymentRequiredError(AiProviderError):
    """Raised when Pollinations returns 402 (insufficient credits or budget exhausted)."""
    pass


class AiProviderRateLimitError(AiProviderError):
    """Raised when Pollinations returns 429 (rate limit exceeded)."""
    pass


class AiProviderInvalidImageError(AiProviderError):
    """Raised when Pollinations response does not contain valid image bytes."""
    pass


class PollinationsImageService:
    """
    Adapter for Pollinations AI image generation and editing.
    """

    @classmethod
    def get_api_key(cls) -> str:
        return os.getenv(ENV_API_KEY, "").strip()

    @classmethod
    def is_configured(cls) -> bool:
        return bool(cls.get_api_key())

    @classmethod
    def get_base_url(cls) -> str:
        return os.getenv(ENV_BASE_URL, DEFAULT_BASE_URL).rstrip("/")

    @classmethod
    def get_image_model(cls) -> str:
        return os.getenv(ENV_IMAGE_MODEL, DEFAULT_IMAGE_MODEL).strip()

    @classmethod
    def get_edit_model(cls) -> str:
        return os.getenv(ENV_EDIT_MODEL, DEFAULT_EDIT_MODEL).strip()

    @classmethod
    def get_timeout(cls) -> float:
        try:
            return float(os.getenv(ENV_TIMEOUT, str(DEFAULT_TIMEOUT_SECONDS)))
        except (ValueError, TypeError):
            return DEFAULT_TIMEOUT_SECONDS

    @classmethod
    def validate_prompt(cls, prompt: str) -> str:
        if not prompt or not isinstance(prompt, str):
            raise InvalidPromptError("Le prompt ne peut pas être vide.")
        cleaned = prompt.strip()
        if not cleaned:
            raise InvalidPromptError("Le prompt ne peut pas être vide.")
        if len(cleaned) > MAX_PROMPT_LENGTH:
            raise InvalidPromptError(
                f"Le prompt dépasse la limite maximale de {MAX_PROMPT_LENGTH} caractères ({len(cleaned)} fournis)."
            )
        return cleaned

    @classmethod
    def generate_image(
        cls,
        prompt: str,
        style: str = None,
        aspect_ratio: str = "1:1",
        seed: int = None,
    ) -> dict:
        """
        Text-to-Image generation via Pollinations AI.
        Does NOT persist any Media instance.
        """
        cleaned_prompt = cls.validate_prompt(prompt)

        if not cls.is_configured():
            raise AiProviderNotConfiguredError(
                "Le service de génération d'images n'est pas configuré. Veuillez définir la variable POLLINATIONS_API_KEY."
            )

        # Style enrichment if requested
        if style and isinstance(style, str) and style.strip() and style.lower() != "none":
            final_prompt = f"{cleaned_prompt}, style {style.strip()}"
        else:
            final_prompt = cleaned_prompt

        width, height = ALLOWED_ASPECT_RATIOS.get(aspect_ratio, (1024, 1024))
        model = cls.get_image_model()
        api_key = cls.get_api_key()
        base_url = cls.get_base_url()
        timeout = cls.get_timeout()

        headers = {
            "Authorization": f"Bearer {api_key}",
            "User-Agent": "JornalAI-Media/1.0",
        }

        encoded_prompt = quote(final_prompt, safe="")
        url = f"{base_url}/image/{encoded_prompt}"
        params = {
            "model": model,
            "width": width,
            "height": height,
            "nologo": "true",
        }
        if seed is not None:
            params["seed"] = seed

        try:
            response = requests.get(
                url,
                params=params,
                headers=headers,
                timeout=timeout,
            )
        except requests.exceptions.Timeout as exc:
            logger.error("Pollinations generate_image timeout: %s", exc)
            raise AiProviderTimeoutError("Le service de génération d'images a mis trop de temps à répondre (timeout).") from exc
        except requests.exceptions.RequestException as exc:
            logger.error("Pollinations generate_image network error: %s", exc)
            raise AiProviderError(f"Erreur réseau lors de la communication avec le fournisseur d'images: {exc}") from exc

        if response.status_code in (401, 403):
            raise AiProviderAuthError("Échec d'authentification auprès du fournisseur d'images (clé API invalide ou accès refusé).")
        if response.status_code == 402:
            raise AiProviderPaymentRequiredError("Crédits insuffisants ou budget épuisé auprès du fournisseur d'images.")
        if response.status_code == 429:
            raise AiProviderRateLimitError("Limite de requêtes atteinte auprès du fournisseur d'images (rate limit).")
        if response.status_code != 200:
            error_msg = response.text[:200] if response.text else f"Code HTTP {response.status_code}"
            raise AiProviderError(f"Le fournisseur d'images a retourné une erreur: {error_msg}")

        content_type = response.headers.get("Content-Type", "").split(";")[0].strip().lower()
        if "application/json" in content_type:
            try:
                json_data = response.json()
                items = json_data.get("data", [])
                if items and "b64_json" in items[0]:
                    image_bytes = base64.b64decode(items[0]["b64_json"])
                else:
                    raise AiProviderInvalidImageError("Réponse JSON inattendue du fournisseur d'images.")
            except Exception as exc:
                raise AiProviderInvalidImageError(f"Impossible de décoder la réponse JSON du fournisseur d'images: {exc}") from exc
        else:
            image_bytes = response.content

        if not image_bytes or len(image_bytes) < 12:
            raise AiProviderInvalidImageError("La réponse du fournisseur d'images est vide ou invalide.")

        detected_fmt = detect_file_format(image_bytes[:32])
        if detected_fmt not in ("jpeg", "png", "webp", "gif"):
            raise AiProviderInvalidImageError("Le fichier retourné par le fournisseur d'images n'est pas une image valide.")

        mime = f"image/{detected_fmt if detected_fmt != 'jpeg' else 'jpeg'}"
        b64_image = base64.b64encode(image_bytes).decode("ascii")
        data_url = f"data:{mime};base64,{b64_image}"

        return {
            "image": data_url,
            "prompt": final_prompt,
            "model": model,
            "content_type": mime,
            "width": width,
            "height": height,
        }

    @classmethod
    def edit_image(
        cls,
        media_instance,
        prompt: str,
        seed: int = None,
    ) -> dict:
        """
        Image-to-Image editing via Pollinations AI using an existing Media instance.
        Validates source media, reads file, and calls Pollinations image edit endpoint.
        Does NOT modify or overwrite the original Media instance.
        """
        if not media_instance:
            raise InvalidSourceImageError("Aucun média source spécifié.")

        if media_instance.media_type != "image":
            raise InvalidSourceImageError("Seules les images peuvent faire l'objet d'une modification par IA.")

        if not media_instance.file:
            raise InvalidSourceImageError("Aucun fichier physique n'est associé à cette image.")

        cleaned_prompt = cls.validate_prompt(prompt)

        if not cls.is_configured():
            raise AiProviderNotConfiguredError(
                "Le service d'édition d'images n'est pas configuré. Veuillez définir la variable POLLINATIONS_API_KEY."
            )

        file_field = media_instance.file
        try:
            file_field.open("rb")
            header = file_field.read(32)
            file_field.seek(0)
            image_bytes = file_field.read()
        except Exception as exc:
            raise InvalidSourceImageError(f"Impossible de lire le fichier de l'image source: {exc}") from exc
        finally:
            file_field.close()

        if not image_bytes:
            raise InvalidSourceImageError("Le fichier de l'image source est vide.")

        max_image_size = MAX_FILE_SIZES.get("image", 10 * 1024 * 1024)
        if len(image_bytes) > max_image_size:
            raise InvalidSourceImageError("L'image source dépasse la taille maximale autorisée de 10 Mo.")

        detected_fmt = detect_file_format(header)
        if detected_fmt not in ("jpeg", "png", "webp", "gif"):
            raise InvalidSourceImageError("Le format de l'image source n'est pas supporté (JPEG, PNG, WebP acceptés).")

        model = cls.get_edit_model()
        api_key = cls.get_api_key()
        base_url = cls.get_base_url()
        timeout = cls.get_timeout()

        headers = {
            "Authorization": f"Bearer {api_key}",
            "User-Agent": "JornalAI-Media/1.0",
        }

        # Multi-modal OpenAI-compatible endpoint: POST {base_url}/v1/images/edits
        url = f"{base_url}/v1/images/edits"
        file_ext = Path(file_field.name).suffix.lower() or f".{detected_fmt}"
        mime = f"image/{detected_fmt if detected_fmt != 'jpeg' else 'jpeg'}"

        files = {
            "image": (f"source{file_ext}", image_bytes, mime),
        }
        data = {
            "prompt": cleaned_prompt,
            "model": model,
            "response_format": "b64_json",
        }
        if seed is not None:
            data["seed"] = str(seed)

        try:
            response = requests.post(
                url,
                files=files,
                data=data,
                headers=headers,
                timeout=timeout,
            )
        except requests.exceptions.Timeout as exc:
            logger.error("Pollinations edit_image timeout on media %s: %s", media_instance.id, exc)
            raise AiProviderTimeoutError("Le service d'édition d'images a mis trop de temps à répondre (timeout).") from exc
        except requests.exceptions.RequestException as exc:
            logger.error("Pollinations edit_image network error on media %s: %s", media_instance.id, exc)
            raise AiProviderError(f"Erreur réseau lors de la communication avec le fournisseur d'images: {exc}") from exc

        if response.status_code in (401, 403):
            raise AiProviderAuthError("Échec d'authentification auprès du fournisseur d'images (clé API invalide ou accès refusé).")
        if response.status_code == 402:
            raise AiProviderPaymentRequiredError("Crédits insuffisants ou budget épuisé auprès du fournisseur d'images.")
        if response.status_code == 429:
            raise AiProviderRateLimitError("Limite de requêtes atteinte auprès du fournisseur d'images (rate limit).")
        if response.status_code != 200:
            error_msg = response.text[:200] if response.text else f"Code HTTP {response.status_code}"
            raise AiProviderError(f"Le fournisseur d'images a retourné une erreur: {error_msg}")

        content_type = response.headers.get("Content-Type", "").split(";")[0].strip().lower()
        image_bytes_out = None
        if "application/json" in content_type:
            try:
                json_data = response.json()
                items = json_data.get("data", [])
                if items and "b64_json" in items[0]:
                    image_bytes_out = base64.b64decode(items[0]["b64_json"])
                else:
                    raise AiProviderInvalidImageError("Réponse JSON inattendue du fournisseur d'images.")
            except Exception as exc:
                raise AiProviderInvalidImageError(f"Impossible de décoder la réponse JSON du fournisseur d'images: {exc}") from exc
        else:
            image_bytes_out = response.content

        if not image_bytes_out or len(image_bytes_out) < 12:
            raise AiProviderInvalidImageError("La réponse du fournisseur d'images est vide ou invalide.")

        detected_fmt_out = detect_file_format(image_bytes_out[:32])
        if detected_fmt_out not in ("jpeg", "png", "webp", "gif"):
            raise AiProviderInvalidImageError("Le fichier retourné par le fournisseur d'images n'est pas une image valide.")

        out_mime = f"image/{detected_fmt_out if detected_fmt_out != 'jpeg' else 'jpeg'}"
        b64_img = base64.b64encode(image_bytes_out).decode("ascii")
        data_url = f"data:{out_mime};base64,{b64_img}"

        return {
            "image": data_url,
            "source_media_id": str(media_instance.id),
            "prompt": cleaned_prompt,
            "model": model,
            "content_type": out_mime,
            "width": 1024,
            "height": 1024,
        }
