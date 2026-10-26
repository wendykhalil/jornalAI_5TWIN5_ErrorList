"""
backend/apps/media/services.py
Audio transcription service for the Media module (Group 3).

Provides local speech-to-text transcription using faster-whisper.
Designed with:
- Lazy loading (does not load faster-whisper at module import time)
- Thread-safe singleton model caching with double-checked locking
- Concurrency limiting to prevent CPU starvation
- Storage independence (handles both local filesystem and non-local storage)
- Complete segment consumption to trigger real inference
- Graceful degradation with clear exceptions when faster-whisper is not installed
"""

import contextlib
import logging
import os
from pathlib import Path
import tempfile
import threading

logger = logging.getLogger(__name__)

# Default model configuration
DEFAULT_MODEL_SIZE = "base"
DEFAULT_DEVICE = "cpu"
DEFAULT_COMPUTE_TYPE = "int8"
DEFAULT_MAX_CONCURRENT = 2


# ============================================================================
# CUSTOM EXCEPTIONS
# ============================================================================

class AudioTranscriptionError(Exception):
    """Base exception for all audio transcription errors."""
    pass


class AudioTranscriptionUnavailableError(AudioTranscriptionError):
    """Raised when faster-whisper is not installed or model cannot be loaded."""
    pass


class AudioTranscriptionBusyError(AudioTranscriptionError):
    """Raised when the transcription engine is saturated with concurrent requests."""
    pass


class AudioFileNotFoundError(AudioTranscriptionError):
    """Raised when the physical audio file is missing from storage."""
    pass


class InvalidAudioFileError(AudioTranscriptionError):
    """Raised when the file is not audio, empty, or corrupted."""
    pass


class NoSpeechDetectedError(AudioTranscriptionError):
    """Raised when the audio was processed successfully but no words/speech were detected."""
    pass


# ============================================================================
# TRANSCRIPTION SERVICE
# ============================================================================

class AudioTranscriptionService:
    """
    Singleton service managing Whisper model lifecycle and audio transcription.
    """

    _model_lock = threading.Lock()
    _model_instance = None
    _concurrency_semaphore = threading.Semaphore(
        int(os.getenv("WHISPER_MAX_CONCURRENT", str(DEFAULT_MAX_CONCURRENT)))
    )

    @classmethod
    def get_model(cls):
        """
        Thread-safe lazy initialization of the faster-whisper WhisperModel.
        Loads model into memory only on first transcription request.
        """
        if cls._model_instance is None:
            with cls._model_lock:
                if cls._model_instance is None:
                    try:
                        from faster_whisper import WhisperModel
                    except ImportError as exc:
                        logger.warning(
                            "faster_whisper is not installed in the Python environment: %s",
                            exc,
                        )
                        raise AudioTranscriptionUnavailableError(
                            "Le moteur de transcription 'faster-whisper' n'est pas installé sur le serveur."
                        ) from exc

                    model_size = os.getenv("WHISPER_MODEL", DEFAULT_MODEL_SIZE)
                    device = os.getenv("WHISPER_DEVICE", DEFAULT_DEVICE)
                    compute_type = os.getenv("WHISPER_COMPUTE_TYPE", DEFAULT_COMPUTE_TYPE)

                    logger.info(
                        "Loading faster-whisper model '%s' (device=%s, compute_type=%s)...",
                        model_size,
                        device,
                        compute_type,
                    )
                    try:
                        cls._model_instance = WhisperModel(
                            model_size,
                            device=device,
                            compute_type=compute_type,
                        )
                    except Exception as exc:
                        logger.error(
                            "Failed to initialize faster-whisper model '%s': %s",
                            model_size,
                            exc,
                        )
                        raise AudioTranscriptionUnavailableError(
                            f"Impossible de charger le modèle de transcription '{model_size}': {exc}"
                        ) from exc

        return cls._model_instance

    @classmethod
    def reset_model(cls):
        """
        Resets the singleton model instance. Useful for tests and memory cleanup.
        """
        with cls._model_lock:
            cls._model_instance = None

    @classmethod
    @contextlib.contextmanager
    def resolve_audio_file_path(cls, file_field):
        """
        Resolves a Django FileField to a readable local filesystem path.

        1. If file_field.path is supported and exists, yields it directly (zero copy).
        2. If file_field is on non-local storage (S3, memory) or raises NotImplementedError,
           streams chunks into a temporary file and deletes it on exit.
        """
        if not file_field or not getattr(file_field, "name", None):
            raise AudioFileNotFoundError("Aucun fichier audio n'est rattaché à ce média.")

        # Check local filesystem path if available
        try:
            local_path = file_field.path
            if os.path.isfile(local_path):
                if os.path.getsize(local_path) == 0:
                    raise InvalidAudioFileError("Le fichier audio sélectionné est vide (0 octet).")
                yield local_path
                return
            else:
                raise AudioFileNotFoundError(
                    f"Le fichier audio physique est introuvable sur le disque serveur: {file_field.name}"
                )
        except (AttributeError, NotImplementedError, ValueError):
            # Non-local storage or custom backend: stream chunks to a temporary file
            pass

        suffix = Path(file_field.name).suffix.lower() or ".audio"
        tmp_file = None
        total_bytes = 0

        try:
            with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
                tmp_file = tmp.name
                file_field.open("rb")
                try:
                    for chunk in file_field.chunks():
                        tmp.write(chunk)
                        total_bytes += len(chunk)
                finally:
                    file_field.close()

            if total_bytes == 0:
                raise InvalidAudioFileError("Le fichier audio sélectionné est vide (0 octet).")

            yield tmp_file
        finally:
            if tmp_file and os.path.exists(tmp_file):
                try:
                    os.unlink(tmp_file)
                except OSError:
                    pass

    @classmethod
    def transcribe_media(cls, media_instance) -> dict:
        """
        Transcribes an audio Media instance.

        Parameters:
            media_instance (Media): The audio Media model instance.

        Returns:
            dict: {
                "text": str,        # Clean full transcribed text
                "language": str,    # Detected ISO language code (e.g. 'fr', 'en')
                "duration": float,  # Audio duration in seconds
                "model": str,       # Model name used
            }

        Raises:
            InvalidAudioFileError: If media is not audio or file is invalid/empty.
            AudioFileNotFoundError: If the physical file does not exist.
            AudioTranscriptionUnavailableError: If faster-whisper is not installed.
            AudioTranscriptionBusyError: If the service is saturated.
            NoSpeechDetectedError: If no audible speech was found in the file.
            AudioTranscriptionError: On other engine failures.
        """
        if media_instance.media_type != "audio":
            raise InvalidAudioFileError("Seuls les fichiers de type audio peuvent être transcrits.")

        if not media_instance.file:
            raise AudioFileNotFoundError("Aucun fichier audio n'est rattaché à ce média.")

        # Concurrency throttle: acquire semaphore with 2-second timeout
        acquired = cls._concurrency_semaphore.acquire(blocking=True, timeout=2.0)
        if not acquired:
            raise AudioTranscriptionBusyError(
                "Le service de transcription est actuellement surchargé. Veuillez réessayer dans quelques instants."
            )

        try:
            with cls.resolve_audio_file_path(media_instance.file) as audio_path:
                model = cls.get_model()
                try:
                    segments_generator, info = model.transcribe(
                        audio_path,
                        beam_size=5,
                        vad_filter=True,
                    )
                except Exception as exc:
                    logger.error("Error during model.transcribe on '%s': %s", audio_path, exc)
                    raise AudioTranscriptionError(
                        f"Échec du traitement audio par le moteur de transcription: {exc}"
                    ) from exc

                # Actively consume the generator to execute inference
                collected_segments = []
                total_duration = getattr(info, "duration", 0.0) or 0.0

                for segment in segments_generator:
                    text_piece = segment.text.strip()
                    if text_piece:
                        collected_segments.append(text_piece)
                    if hasattr(segment, "end") and segment.end is not None:
                        total_duration = max(total_duration, float(segment.end))

                full_text = " ".join(collected_segments).strip()

                if not full_text:
                    raise NoSpeechDetectedError(
                        "Aucune parole audible n'a été détectée dans ce fichier audio."
                    )

                detected_language = getattr(info, "language", "unknown") or "unknown"
                model_name = os.getenv("WHISPER_MODEL", DEFAULT_MODEL_SIZE)

                return {
                    "text": full_text,
                    "language": detected_language,
                    "duration": round(total_duration, 2),
                    "model": model_name,
                }
        finally:
            cls._concurrency_semaphore.release()
