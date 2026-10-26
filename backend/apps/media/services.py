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

# Ephemeral audio prompt configuration
MAX_PROMPT_AUDIO_SIZE = 10 * 1024 * 1024  # 10 Mo
MAX_PROMPT_AUDIO_DURATION = 30.0          # 30 secondes
ALLOWED_PROMPT_AUDIO_EXTENSIONS = {".webm", ".ogg", ".wav", ".mp3", ".m4a"}


def detect_audio_signature(header: bytes) -> str | None:
    """
    Detects the audio format from the file's initial magic bytes.
    Returns format identifier ('webm', 'ogg', 'wav', 'mp3', 'm4a') or None.
    """
    if len(header) < 2:
        return None

    # EBML (WebM / Matroska) : begins with \x1A\x45\xDF\xA3
    if header.startswith(b"\x1a\x45\xdf\xa3"):
        return "webm"

    # OGG container : begins with OggS
    if header.startswith(b"OggS"):
        return "ogg"

    # RIFF WAV : begins with RIFF and has WAVE at offset 8..12
    if header.startswith(b"RIFF") and len(header) >= 12 and header[8:12] == b"WAVE":
        return "wav"

    # MP3 : ID3 tag or MPEG sync word (first 11 bits set: 0xFF followed by 0xE0 mask)
    if header.startswith(b"ID3"):
        return "mp3"
    if len(header) >= 2 and header[0] == 0xFF and (header[1] & 0xE0) == 0xE0:
        return "mp3"

    # ISO BMFF (M4A) : begins with ftyp at offset 4..8
    if len(header) >= 12 and header[4:8] == b"ftyp":
        major_brand = header[8:12].lower()
        if major_brand in (b"m4a ", b"m4b ", b"isom", b"mp42"):
            return "m4a"

    return None


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


class AudioDurationExceededError(AudioTranscriptionError):
    """Raised when the audio duration exceeds the allowed limit (e.g. 30 seconds)."""
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

    @classmethod
    def transcribe_audio_prompt(
        cls,
        audio_file,
        max_duration: float = MAX_PROMPT_AUDIO_DURATION,
    ) -> dict:
        """
        Transcribes an ephemeral voice prompt for AI generation/editing.
        Validates size (<= 10MB), extension, magic bytes, decodability via PyAV,
        and enforces maximum duration (<= 30s) both via container metadata and decoded audio.
        Guarantees temporary file cleanup under all circumstances.
        Does NOT persist any Media instance to the database.

        Parameters:
            audio_file (UploadedFile): The temporary uploaded audio file.
            max_duration (float): Maximum allowed duration in seconds (default 30.0s).

        Returns:
            dict: {
                "text": str,        # Transcribed prompt text
                "language": str,    # Detected language code (e.g. 'fr', 'en')
                "duration": float,  # Audio duration in seconds
            }

        Raises:
            InvalidAudioFileError: If file is missing, empty, oversized, invalid extension/signature or undecodable.
            AudioDurationExceededError: If duration exceeds max_duration.
            NoSpeechDetectedError: If no audible speech is detected.
            AudioTranscriptionUnavailableError: If faster-whisper is not installed.
            AudioTranscriptionBusyError: If the service is saturated.
            AudioTranscriptionError: On other internal transcription failures.
        """
        if not audio_file:
            raise InvalidAudioFileError("Aucun fichier audio n'a été fourni.")

        file_size = getattr(audio_file, "size", 0)
        if file_size <= 0:
            raise InvalidAudioFileError("Le fichier audio fourni est vide (0 octet).")

        if file_size > MAX_PROMPT_AUDIO_SIZE:
            size_mb = round(file_size / (1024 * 1024), 1)
            raise InvalidAudioFileError(
                f"Le fichier audio ({size_mb} Mo) dépasse la limite maximale autorisée de 10 Mo."
            )

        file_name = getattr(audio_file, "name", "") or "prompt.webm"
        suffix = Path(file_name).suffix.lower()

        if suffix not in ALLOWED_PROMPT_AUDIO_EXTENSIONS:
            raise InvalidAudioFileError(
                f"L'extension '{suffix}' n'est pas autorisée. Formats acceptés : WebM, OGG, WAV, MP3, M4A."
            )

        # Validate magic bytes / signature
        header = audio_file.read(32)
        if hasattr(audio_file, "seek"):
            audio_file.seek(0)

        detected_format = detect_audio_signature(header)
        if detected_format is None:
            raise InvalidAudioFileError(
                "La signature binaire du fichier ne correspond pas à un format audio autorisé (WebM, OGG, WAV, MP3, M4A)."
            )

        temp_path = None
        try:
            with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as temp_file:
                temp_path = temp_file.name
                if hasattr(audio_file, "chunks"):
                    for chunk in audio_file.chunks():
                        temp_file.write(chunk)
                else:
                    temp_file.write(audio_file.read())

            # Format decodability & container duration validation via PyAV
            try:
                import av
                with av.open(temp_path) as container:
                    if not container.streams.audio:
                        raise InvalidAudioFileError("Le fichier ne contient aucun flux audio valide.")
                    if container.duration is not None:
                        container_duration = float(container.duration / av.time_base)
                        if container_duration > max_duration:
                            raise AudioDurationExceededError(
                                f"La durée de l'audio ({container_duration:.1f}s) dépasse la limite maximale autorisée de {max_duration:.0f} secondes."
                            )
            except AudioDurationExceededError:
                raise
            except InvalidAudioFileError:
                raise
            except Exception as exc:
                logger.error("Audio container probe failure on '%s': %s", temp_path, exc)
                raise InvalidAudioFileError(f"Le fichier audio est corrompu ou illisible: {exc}") from exc

            # Concurrency throttle: acquire semaphore with 2-second timeout
            acquired = cls._concurrency_semaphore.acquire(blocking=True, timeout=2.0)
            if not acquired:
                raise AudioTranscriptionBusyError(
                    "Le service de transcription est actuellement surchargé. Veuillez réessayer dans quelques instants."
                )

            try:
                model = cls.get_model()
                try:
                    segments_generator, info = model.transcribe(
                        temp_path,
                        beam_size=5,
                        vad_filter=True,
                    )
                except Exception as exc:
                    logger.error("Error during model.transcribe on prompt '%s': %s", temp_path, exc)
                    raise AudioTranscriptionError(
                        f"Échec du traitement audio par le moteur de transcription: {exc}"
                    ) from exc

                collected_segments = []
                total_duration = getattr(info, "duration", 0.0) or 0.0

                for segment in segments_generator:
                    text_piece = segment.text.strip()
                    if text_piece:
                        collected_segments.append(text_piece)
                    if hasattr(segment, "end") and segment.end is not None:
                        total_duration = max(total_duration, float(segment.end))

                if total_duration > max_duration:
                    raise AudioDurationExceededError(
                        f"La durée de l'audio ({total_duration:.1f}s) dépasse la limite maximale autorisée de {max_duration:.0f} secondes."
                    )

                full_text = " ".join(collected_segments).strip()
                if not full_text:
                    raise NoSpeechDetectedError(
                        "Aucune parole audible n'a été détectée dans cet enregistrement vocal."
                    )

                detected_language = getattr(info, "language", "unknown") or "unknown"

                return {
                    "text": full_text,
                    "language": detected_language,
                    "duration": round(total_duration, 2),
                }
            finally:
                cls._concurrency_semaphore.release()
        finally:
            if temp_path and os.path.exists(temp_path):
                try:
                    os.unlink(temp_path)
                except OSError as exc:
                    logger.warning("Could not delete temporary prompt audio file '%s': %s", temp_path, exc)
