"""Local semantic vectors for mood notes.

Vectors are compared with cosine similarity. A score is not a probability
and it is not a medical or psychological diagnosis.
"""

import logging
import math
import os

import requests
from django.utils import timezone

from apps.mood.ai import OLLAMA_TIMEOUT

from .models import MoodCheck, MoodNoteEmbedding, mood_note_fingerprint

logger = logging.getLogger(__name__)

DEFAULT_EMBEDDING_MODEL = "nomic-embed-text:latest"
DEFAULT_DIMENSIONS = 768
DEFAULT_MIN_SIMILARITY = 0.45
DEFAULT_BACKFILL_LIMIT = 20
DEFAULT_MAX_CANDIDATES = 500
QUERY_LIMIT = 1000
EXCERPT_LIMIT = 280


class MoodEmbeddingError(Exception):
    """The embedding cannot be used. The message is safe for the client."""

    message = "Le calcul de similarité n'a pas pu aboutir."

    def __init__(self, message=None):
        if message is not None:
            self.message = message
        super().__init__(self.message)


class MoodEmbeddingUnavailable(MoodEmbeddingError):
    """Ollama could not be reached, or the embedding model is missing."""

    message = "La recherche sémantique est temporairement indisponible."


class MoodEmbeddingTimeout(MoodEmbeddingUnavailable):
    """Ollama did not answer in time."""

    message = "La recherche sémantique a expiré."


def configured_embedding_model():
    raw = os.getenv("OLLAMA_MOOD_EMBEDDING_MODEL", DEFAULT_EMBEDDING_MODEL).strip()
    return raw or DEFAULT_EMBEDDING_MODEL


def configured_dimensions():
    return _positive_int("OLLAMA_MOOD_EMBEDDING_DIMENSIONS", DEFAULT_DIMENSIONS)


def min_similarity():
    raw = os.getenv("MOOD_EMBEDDING_MIN_SIMILARITY", "").strip()
    if not raw:
        return DEFAULT_MIN_SIMILARITY
    try:
        value = float(raw)
    except ValueError:
        return DEFAULT_MIN_SIMILARITY
    if not math.isfinite(value) or value < -1 or value > 1:
        return DEFAULT_MIN_SIMILARITY
    return value


def backfill_limit():
    raw = os.getenv("MOOD_EMBEDDING_BACKFILL_LIMIT", "").strip()
    if not raw:
        return DEFAULT_BACKFILL_LIMIT
    try:
        value = int(raw)
    except ValueError:
        return DEFAULT_BACKFILL_LIMIT
    if value < 0:
        return DEFAULT_BACKFILL_LIMIT
    return min(value, 50)


def max_candidates():
    return _positive_int("MOOD_EMBEDDING_MAX_CANDIDATES", DEFAULT_MAX_CANDIDATES)


def _positive_int(name, default):
    raw = os.getenv(name, "").strip()
    if not raw:
        return default
    try:
        value = int(raw)
    except ValueError:
        return default
    if value < 1:
        return default
    return value


def embeddings_url():
    configured = os.getenv("OLLAMA_EMBED_URL", "").strip()
    if configured:
        return configured
    generate = os.getenv("OLLAMA_URL", "http://127.0.0.1:11434/api/generate")
    marker = "/api/generate"
    if generate.endswith(marker):
        return generate[: -len(marker)] + "/api/embeddings"
    return "http://127.0.0.1:11434/api/embeddings"


def embed_text(text, purpose="document"):
    """Return a numeric vector. Does not call Ollama for an empty text."""
    source = (text or "").strip()
    if not source:
        raise MoodEmbeddingError("La note est vide. Aucun embedding ne peut être calculé.")
    prefixed = _prefixed(source, purpose)
    model_name = configured_embedding_model()
    url = embeddings_url()
    body = {"model": model_name}
    if url.rstrip("/").endswith("/api/embed"):
        body["input"] = prefixed
    else:
        body["prompt"] = prefixed
    try:
        response = requests.post(url, json=body, timeout=OLLAMA_TIMEOUT)
        response.raise_for_status()
        payload = response.json()
    except requests.exceptions.Timeout as exc:
        logger.warning("Mood embedding timed out (%s)", exc.__class__.__name__)
        raise MoodEmbeddingTimeout() from exc
    except requests.exceptions.RequestException as exc:
        logger.warning("Mood embedding unavailable (%s)", exc.__class__.__name__)
        raise MoodEmbeddingUnavailable() from exc
    except ValueError as exc:
        logger.warning("Mood embedding rejected (%s)", exc.__class__.__name__)
        raise MoodEmbeddingError() from exc

    try:
        vector = _coerce_vector(payload, configured_dimensions())
    except MoodEmbeddingError:
        logger.warning("Mood embedding rejected (MoodEmbeddingError)")
        raise
    logger.info("Mood embedding completed")
    return vector


def cosine_similarity(left, right):
    """Cosine similarity in [-1, 1]. None when a vector cannot be compared."""
    if not isinstance(left, list) or not isinstance(right, list):
        return None
    if not left or not right or len(left) != len(right):
        return None
    dot = 0.0
    left_norm = 0.0
    right_norm = 0.0
    for first, second in zip(left, right):
        if isinstance(first, bool) or isinstance(second, bool):
            return None
        if not isinstance(first, (int, float)) or not isinstance(second, (int, float)):
            return None
        if not math.isfinite(first) or not math.isfinite(second):
            return None
        dot += first * second
        left_norm += first * first
        right_norm += second * second
    if left_norm == 0 or right_norm == 0:
        return None
    return dot / (math.sqrt(left_norm) * math.sqrt(right_norm))


def ensure_embedding(check):
    """Store one current vector for this check-in, or reuse it.

    An empty note removes any previous vector. Mood and intensity are untouched.
    """
    note = check.note or ""
    if not note.strip():
        MoodNoteEmbedding.objects.filter(mood_check=check).delete()
        return None

    model_name = configured_embedding_model()
    dimensions = configured_dimensions()
    stored = _stored(check)
    if stored and _vector_is_current(stored, note, model_name, dimensions):
        return stored

    vector = embed_text(note, purpose="document")
    saved, _created = MoodNoteEmbedding.objects.update_or_create(
        mood_check=check,
        defaults={
            "vector": vector,
            "dimensions": len(vector),
            "text_sha256": mood_note_fingerprint(note),
            "model_name": model_name,
            "generated_at": timezone.now(),
        },
    )
    return saved


def search_user_notes(user, query, limit):
    """Rank one user's notes. The owner filter is applied before scoring."""
    queryset = (
        MoodCheck.objects.filter(user=user)
        .exclude(note="")
        .select_related("note_embedding")
        .order_by("-date", "-created_at")
    )
    total = queryset.count()
    cap = max_candidates()
    checks = [check for check in queryset[:cap] if (check.note or "").strip()]
    omitted = max(0, total - cap)
    if not checks:
        logger.info("Mood embedding search completed")
        return _payload([], 0, omitted, "Aucun check-in avec une note à comparer.")

    query_vector = embed_text(query, purpose="query")
    model_name = configured_embedding_model()
    dimensions = configured_dimensions()
    ready = []
    budget = backfill_limit()
    pending = 0
    for check in checks:
        current = _current_vector(check, model_name, dimensions)
        if current is not None:
            ready.append((check, current))
            continue
        if _invalid_current(check, model_name, dimensions):
            logger.warning("Mood embedding skipped (invalid vector)")
            continue
        if budget <= 0:
            pending += 1
            continue
        budget -= 1
        try:
            saved = ensure_embedding(check)
        except MoodEmbeddingUnavailable:
            raise
        except MoodEmbeddingError:
            logger.warning("Mood embedding skipped (MoodEmbeddingError)")
            continue
        if saved is None:
            continue
        vector = _decode_vector(saved.vector, dimensions)
        if vector is None:
            logger.warning("Mood embedding skipped (invalid vector)")
            continue
        ready.append((check, vector))

    minimum = min_similarity()
    ranked = []
    for check, vector in ready:
        score = cosine_similarity(query_vector, vector)
        if score is None or score < minimum:
            continue
        ranked.append((score, check))
    ranked.sort(key=lambda item: item[0], reverse=True)
    chosen = ranked[:limit]
    logger.info("Mood embedding search completed")
    message = None
    if not chosen:
        message = "Aucun check-in ne se rapproche assez de cette recherche."
    return _payload(
        [_result(check, score) for score, check in chosen],
        pending,
        omitted,
        message,
    )


def _prefixed(text, purpose):
    if purpose == "query":
        return "search_query: " + text
    return "search_document: " + text


def _coerce_vector(payload, dimensions):
    if not isinstance(payload, dict):
        raise MoodEmbeddingError()
    raw = payload.get("embedding")
    if raw is None and isinstance(payload.get("embeddings"), list) and payload["embeddings"]:
        raw = payload["embeddings"][0]
    return _decode_vector(raw, dimensions, reject=True)


def _decode_vector(raw, dimensions, reject=False):
    if not isinstance(raw, list) or len(raw) != dimensions:
        if reject:
            raise MoodEmbeddingError()
        return None
    cleaned = []
    for item in raw:
        if isinstance(item, bool) or not isinstance(item, (int, float)):
            if reject:
                raise MoodEmbeddingError()
            return None
        number = float(item)
        if not math.isfinite(number):
            if reject:
                raise MoodEmbeddingError()
            return None
        cleaned.append(number)
    return cleaned


def _stored(check):
    try:
        return check.note_embedding
    except MoodNoteEmbedding.DoesNotExist:
        return None


def _vector_is_current(stored, note, model_name, dimensions):
    return (
        stored.matches_note(note, model_name)
        and stored.dimensions == dimensions
        and _decode_vector(stored.vector, dimensions) is not None
    )


def _current_vector(check, model_name, dimensions):
    stored = _stored(check)
    if stored is None or not _vector_is_current(stored, check.note, model_name, dimensions):
        return None
    return _decode_vector(stored.vector, dimensions)


def _invalid_current(check, model_name, dimensions):
    stored = _stored(check)
    if stored is None or not stored.matches_note(check.note, model_name):
        return False
    if stored.dimensions != dimensions:
        return False
    return _decode_vector(stored.vector, dimensions) is None


def _excerpt(note):
    text = " ".join((note or "").split())
    if len(text) <= EXCERPT_LIMIT:
        return text
    return text[:EXCERPT_LIMIT].rstrip() + "…"


def _result(check, score):
    return {
        "id": str(check.id),
        "date": check.date.isoformat(),
        "mood": check.mood,
        "intensity": check.intensity,
        "excerpt": _excerpt(check.note),
        "similarity": round(score, 4),
    }


def _payload(results, pending, omitted, message):
    return {
        "results": results,
        "count": len(results),
        "pending": pending,
        "omitted": omitted,
        "similarity_metric": "cosine",
        "message": message,
    }
