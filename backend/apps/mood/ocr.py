"""Temporary text extraction for a mood note.

Images go through Tesseract. Text PDFs are read with pypdf.
Nothing is stored and nothing is sent to Ollama.
"""

import glob
import io
import logging
import os
import shutil
import subprocess
import tempfile

from PIL import Image

logger = logging.getLogger(__name__)

DEFAULT_MAX_BYTES = 5 * 1024 * 1024
DEFAULT_MAX_PAGES = 10
DEFAULT_MAX_CHARS = 20000
DEFAULT_LANGS = "fra+eng"
MAX_IMAGE_PIXELS = 20_000_000
PDF_RENDER_DPI = 150
PDF_RENDER_TIMEOUT = 60
SCANNED_PDF_UNAVAILABLE = (
    "Ce PDF ne contient pas de texte extractible. "
    "S'il s'agit d'un document scanné, sa lecture nécessite Poppler et Tesseract, "
    "qui ne sont pas disponibles."
)

JPEG_MAGIC = bytes.fromhex("FFD8FF")
PNG_MAGIC = bytes.fromhex("89504E470D0A1A0A")
PDF_MAGIC = b"%PDF-"


class OcrRejected(Exception):
    """The file cannot be read. The message is safe for the client."""

    def __init__(self, message):
        super().__init__(message)
        self.message = message


class OcrUnavailable(Exception):
    """Tesseract or its language data cannot be used."""

    def __init__(self, message):
        super().__init__(message)
        self.message = message


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


def max_bytes():
    return _positive_int("MOOD_OCR_MAX_BYTES", DEFAULT_MAX_BYTES)


def max_pages():
    return _positive_int("MOOD_OCR_MAX_PAGES", DEFAULT_MAX_PAGES)


def max_chars():
    return _positive_int("MOOD_OCR_MAX_CHARS", DEFAULT_MAX_CHARS)


def configured_languages():
    raw = os.getenv("MOOD_OCR_LANGS", DEFAULT_LANGS)
    parts = [part.strip() for part in raw.replace(",", "+").split("+") if part.strip()]
    return parts or ["fra", "eng"]


def _env_flag(name, default=True):
    raw = os.getenv(name, "").strip().lower()
    if not raw:
        return default
    return raw not in {"0", "false", "off", "no"}


def tesseract_command():
    configured = os.getenv("TESSERACT_CMD", "").strip().strip('"')
    if configured:
        return configured if os.path.isfile(configured) else None
    found = shutil.which("tesseract")
    if found:
        return found
    windows = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
    if os.path.isfile(windows):
        return windows
    return None


def scanned_pdf_enabled():
    return _env_flag("MOOD_OCR_SCANNED_PDF", default=True)


def poppler_executable():
    configured = os.getenv("POPPLER_PATH", "").strip().strip('"')
    names = ("pdftoppm.exe", "pdftoppm") if os.name == "nt" else ("pdftoppm",)
    if configured:
        if os.path.isdir(configured):
            for name in names:
                candidate = os.path.join(configured, name)
                if os.path.isfile(candidate):
                    return candidate
            return None
        return configured if os.path.isfile(configured) else None
    found = shutil.which("pdftoppm")
    if found:
        return found
    if os.name != "nt":
        return None
    local = os.environ.get("LOCALAPPDATA", "")
    patterns = [
        r"C:\Program Files\poppler*\Library\bin\pdftoppm.exe",
        r"C:\Program Files\Poppler*\Library\bin\pdftoppm.exe",
        os.path.join(local, "Microsoft", "WinGet", "Links", "pdftoppm.exe"),
        os.path.join(
            local,
            "Microsoft",
            "WinGet",
            "Packages",
            "oschwartz10612.Poppler*",
            "poppler-*",
            "Library",
            "bin",
            "pdftoppm.exe",
        ),
    ]
    for pattern in patterns:
        matches = sorted(glob.glob(pattern))
        if matches:
            return matches[-1]
    return None


def _size_label(limit):
    mebibyte = 1024 * 1024
    if limit % mebibyte == 0:
        return f"{limit // mebibyte} Mo"
    return f"{limit} octets"


def detect_format(data):
    if data.startswith(JPEG_MAGIC):
        return "jpeg"
    if data.startswith(PNG_MAGIC):
        return "png"
    if len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp"
    if data.startswith(PDF_MAGIC):
        return "pdf"
    return None


def read_upload(uploaded):
    if uploaded is None:
        raise OcrRejected("Choisissez un fichier.")
    limit = max_bytes()
    try:
        size = getattr(uploaded, "size", None)
        if size == 0:
            raise OcrRejected("Le fichier est vide.")
        if size is not None and size > limit:
            raise OcrRejected(f"Le fichier dépasse la limite de {_size_label(limit)}.")
        chunks = []
        total = 0
        for chunk in uploaded.chunks():
            total += len(chunk)
            if total > limit:
                raise OcrRejected(f"Le fichier dépasse la limite de {_size_label(limit)}.")
            chunks.append(chunk)
    finally:
        try:
            uploaded.close()
        except Exception:
            logger.warning("Mood OCR upload close failed")
    data = b"".join(chunks)
    if not data:
        raise OcrRejected("Le fichier est vide.")
    return data


def installed_languages():
    command = tesseract_command()
    if not command:
        raise OcrUnavailable(
            "Tesseract n'est pas installé. L'OCR des images est indisponible."
        )
    try:
        import pytesseract
    except ImportError as exc:
        logger.warning("Mood OCR import failed (%s)", exc.__class__.__name__)
        raise OcrUnavailable(
            "Le module Python pytesseract n'est pas installé."
        ) from exc
    pytesseract.pytesseract.tesseract_cmd = command
    try:
        return list(pytesseract.get_languages(config=""))
    except Exception as exc:
        logger.warning("Mood OCR languages unavailable (%s)", exc.__class__.__name__)
        raise OcrUnavailable("Tesseract n'a pas pu être utilisé.") from exc


def language_argument():
    installed = set(installed_languages())
    requested = configured_languages()
    missing = [lang for lang in requested if lang not in installed]
    if missing:
        raise OcrUnavailable(
            "Données linguistiques Tesseract manquantes : " + ", ".join(missing) + "."
        )
    return "+".join(requested)


def read_image_text(image, lang):
    import pytesseract
    command = tesseract_command()
    if command:
        pytesseract.pytesseract.tesseract_cmd = command
    try:
        return pytesseract.image_to_string(image, lang=lang) or ""
    except Exception as exc:
        logger.warning("Mood OCR image failed (%s)", exc.__class__.__name__)
        if exc.__class__.__name__ == "TesseractNotFoundError":
            raise OcrUnavailable(
                "Tesseract n'est pas installé. L'OCR des images est indisponible."
            ) from exc
        message = str(exc).lower()
        if "language" in message or "traineddata" in message:
            raise OcrUnavailable(
                "Les données linguistiques Tesseract demandées ne sont pas installées."
            ) from exc
        raise OcrUnavailable("L'OCR de l'image n'a pas pu aboutir.") from exc


def _finish(text, document_type, language, page_count=None):
    cleaned = (text or "").strip()
    limit = max_chars()
    message = None
    if len(cleaned) > limit:
        cleaned = cleaned[:limit].rstrip()
        message = f"Le texte a été limité à {limit} caractères."
    return {
        "status": "success",
        "text": cleaned,
        "document_type": document_type,
        "language": language,
        "page_count": page_count,
        "message": message,
    }


def extract_image(data):
    try:
        image = Image.open(io.BytesIO(data))
        width, height = image.size
        if width < 1 or height < 1 or width * height > MAX_IMAGE_PIXELS:
            raise OcrRejected("L'image est trop grande pour être analysée.")
        if image.format not in {"JPEG", "PNG", "WEBP"}:
            raise OcrRejected("Format d'image non pris en charge.")
        image.load()
        if image.mode not in ("RGB", "L"):
            image = image.convert("RGB")
    except OcrRejected:
        raise
    except Exception as exc:
        logger.warning("Mood OCR image rejected (%s)", exc.__class__.__name__)
        raise OcrRejected("L'image est illisible ou endommagée.") from exc
    lang = language_argument()
    text = read_image_text(image, lang)
    logger.info("Mood OCR completed")
    if not (text or "").strip():
        return {
            "status": "no_text",
            "text": "",
            "document_type": "image",
            "language": lang,
            "page_count": None,
            "message": "Aucun texte n'a été reconnu dans l'image.",
        }
    return _finish(text, "image", lang)


def _pdf_without_text(page_count, message):
    logger.info("Mood OCR completed")
    return {
        "status": "no_text",
        "text": "",
        "document_type": "pdf",
        "language": None,
        "page_count": page_count,
        "message": message,
    }


def _open_ocr_image(data):
    try:
        image = Image.open(io.BytesIO(data))
        width, height = image.size
        if width < 1 or height < 1 or width * height > MAX_IMAGE_PIXELS:
            raise OcrRejected("L'image est trop grande pour être analysée.")
        image.load()
        if image.mode not in ("RGB", "L"):
            image = image.convert("RGB")
        return image
    except OcrRejected:
        raise
    except Exception as exc:
        logger.warning("Mood OCR image rejected (%s)", exc.__class__.__name__)
        raise OcrRejected("L'image est illisible ou endommagée.") from exc


def render_pdf_pages(data, page_count):
    executable = poppler_executable()
    if not executable:
        raise OcrUnavailable(SCANNED_PDF_UNAVAILABLE)
    directory = tempfile.mkdtemp(prefix="mood-ocr-")
    try:
        source = os.path.join(directory, "document.pdf")
        with open(source, "wb") as handle:
            handle.write(data)
        prefix = os.path.join(directory, "page")
        try:
            completed = subprocess.run(
                [
                    executable,
                    "-png",
                    "-r",
                    str(PDF_RENDER_DPI),
                    "-f",
                    "1",
                    "-l",
                    str(page_count),
                    source,
                    prefix,
                ],
                capture_output=True,
                timeout=PDF_RENDER_TIMEOUT,
                check=False,
                creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
            )
        except subprocess.TimeoutExpired:
            logger.warning("Mood OCR pdf render timed out")
            raise OcrRejected("La conversion du PDF a pris trop de temps.")
        except OSError:
            logger.warning("Mood OCR pdf render could not start")
            raise OcrRejected("Le PDF scanné n'a pas pu être converti.")
        if completed.returncode != 0:
            logger.warning("Mood OCR pdf render failed")
            raise OcrRejected("Le PDF scanné n'a pas pu être converti.")
        names = sorted(
            name for name in os.listdir(directory)
            if name.startswith("page") and name.lower().endswith(".png")
        )
        if not names:
            raise OcrRejected("Le PDF scanné n'a pas pu être converti.")
        pages = []
        for name in names:
            with open(os.path.join(directory, name), "rb") as handle:
                pages.append(handle.read())
        return pages
    finally:
        shutil.rmtree(directory, ignore_errors=True)


def extract_scanned_pdf(data, page_count):
    if not scanned_pdf_enabled():
        return _pdf_without_text(
            page_count,
            "Ce PDF ne contient pas de texte extractible. La lecture des PDF scannés est désactivée.",
        )
    if not poppler_executable() or not tesseract_command():
        return _pdf_without_text(page_count, SCANNED_PDF_UNAVAILABLE)
    lang = language_argument()
    pages = render_pdf_pages(data, page_count)
    parts = []
    for page in pages:
        image = _open_ocr_image(page)
        try:
            parts.append(read_image_text(image, lang))
        finally:
            image.close()
    text = "\n".join(parts).strip()
    logger.info("Mood OCR completed")
    if not text:
        return {
            "status": "no_text",
            "text": "",
            "document_type": "pdf",
            "language": lang,
            "page_count": page_count,
            "message": "Aucun texte n'a été reconnu dans le PDF.",
        }
    return _finish(text, "pdf", lang, page_count=page_count)


def extract_pdf(data):
    from pypdf import PdfReader

    try:
        reader = PdfReader(io.BytesIO(data))
        if reader.is_encrypted:
            raise OcrRejected("Les PDF protégés par mot de passe ne sont pas pris en charge.")
        page_count = len(reader.pages)
    except OcrRejected:
        raise
    except Exception as exc:
        logger.warning("Mood OCR pdf rejected (%s)", exc.__class__.__name__)
        raise OcrRejected("Le PDF est illisible ou endommagé.") from exc
    if page_count < 1:
        raise OcrRejected("Le PDF ne contient aucune page.")
    if page_count > max_pages():
        raise OcrRejected(f"Le PDF dépasse la limite de {max_pages()} pages.")
    parts = []
    try:
        for page in reader.pages:
            parts.append(page.extract_text() or "")
    except Exception as exc:
        logger.warning("Mood OCR pdf extract failed (%s)", exc.__class__.__name__)
        raise OcrRejected("Le texte du PDF n'a pas pu être lu.") from exc
    text = "\n".join(parts).strip()
    if not text:
        return extract_scanned_pdf(data, page_count)
    logger.info("Mood OCR completed")
    return _finish(text, "pdf", None, page_count=page_count)


def extract_upload(uploaded):
    data = read_upload(uploaded)
    kind = detect_format(data)
    if kind is None:
        raise OcrRejected(
            "Format non pris en charge. Utilisez une image PNG, JPEG, WEBP ou un PDF."
        )
    if kind == "pdf":
        return extract_pdf(data)
    return extract_image(data)
