from pathlib import Path
from rest_framework import serializers
from .models import Media


# Limites de taille maximales par type de média (en octets)
MAX_FILE_SIZES = {
    "image": 10 * 1024 * 1024,      # 10 Mo
    "audio": 20 * 1024 * 1024,      # 20 Mo
    "video": 50 * 1024 * 1024,      # 50 Mo
    "document": 10 * 1024 * 1024,   # 10 Mo
}

# Extensions autorisées par type de média (en minuscules avec le point)
ALLOWED_EXTENSIONS = {
    "image": {".jpg", ".jpeg", ".png", ".webp", ".gif"},
    "audio": {".mp3", ".wav", ".ogg", ".webm", ".m4a"},
    "video": {".mp4", ".webm"},
    "document": {".pdf"},
}

# Extensions strictement interdites (sécurité)
FORBIDDEN_EXTENSIONS = {
    ".exe", ".bat", ".cmd", ".sh", ".php", ".py", ".pl", ".cgi",
    ".js", ".ts", ".html", ".htm", ".xhtml", ".svg", ".msi", ".vbs",
    ".dll", ".so", ".jar", ".war", ".ear", ".pif", ".scr", ".com",
}

# Correspondance des formats binaires détectés vers les types de médias admissibles
FORMAT_TO_MEDIA_TYPE = {
    "jpeg": "image",
    "png": "image",
    "webp": "image",
    "gif": "image",
    "mp3": "audio",
    "wav": "audio",
    "ogg": "audio",
    "m4a": "audio",
    "mp4": "video",
    "pdf": "document",
    # Le conteneur WebM / Matroska est polyvalent (audio ou vidéo)
    "webm": ("audio", "video"),
}


def detect_file_format(header: bytes) -> str | None:
    """
    Détecte le format binaire d'un fichier à partir de ses premiers octets (magic bytes).
    Retourne l'identifiant du format (str) ou None si non reconnu.
    """
    if len(header) < 4:
        return None

    # PDF : commence par %PDF-
    if header.startswith(b"%PDF-"):
        return "pdf"

    # JPEG : commence par \xFF\xD8\xFF
    if header.startswith(b"\xff\xd8\xff"):
        return "jpeg"

    # PNG : commence par \x89PNG\r\n\x1a\n
    if header.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"

    # GIF : commence par GIF87a ou GIF89a
    if header.startswith(b"GIF87a") or header.startswith(b"GIF89a"):
        return "gif"

    # Conteneur RIFF : WebP ou WAV
    if header.startswith(b"RIFF") and len(header) >= 12:
        riff_type = header[8:12]
        if riff_type == b"WEBP":
            return "webp"
        if riff_type == b"WAVE":
            return "wav"

    # OGG : commence par OggS
    if header.startswith(b"OggS"):
        return "ogg"

    # EBML (WebM / Matroska) : commence par \x1A\x45\xDF\xA3
    if header.startswith(b"\x1a\x45\xdf\xa3"):
        return "webm"

    # ISO Base Media File Format (MP4 / M4A) : octets 4..8 valent b'ftyp'
    if len(header) >= 12 and header[4:8] == b"ftyp":
        major_brand = header[8:12].lower()
        if major_brand in (b"m4a ", b"m4b "):
            return "m4a"
        return "mp4"

    # MP3 : tag ID3v2 ou octets de synchronisation de trame MPEG audio
    if header.startswith(b"ID3"):
        return "mp3"
    if len(header) >= 2 and header[0] == 0xFF and (header[1] & 0xE0) == 0xE0:
        return "mp3"

    return None


class MediaSerializer(serializers.ModelSerializer):
    """
    Serializer for Media model with file upload support.
    Generates absolute URLs for media files to work across frontend/backend on different origins.
    Enforces server-side size limits, extension whitelisting, and magic bytes validation.
    """
    
    url = serializers.SerializerMethodField()
    
    class Meta:
        model = Media
        fields = [
            "id",
            "title",
            "description",
            "media_type",
            "file",
            "url",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "url", "created_at", "updated_at"]

    def validate(self, attrs):
        # Récupération du media_type (fourni dans attrs ou existant sur l'instance)
        media_type = attrs.get("media_type")
        if not media_type:
            media_type = self.instance.media_type if self.instance else "image"

        file = attrs.get("file")
        if not file:
            # Pour un PATCH de métadonnées sans modification de fichier, validation réussie
            return attrs

        # 1. Vérification que le fichier n'est pas vide
        if file.size == 0:
            raise serializers.ValidationError({"file": "Le fichier sélectionné est vide."})

        # 2. Vérification de la limite de taille
        max_size = MAX_FILE_SIZES.get(media_type, 10 * 1024 * 1024)
        if file.size > max_size:
            max_size_mb = max_size // (1024 * 1024)
            file_size_mb = round(file.size / (1024 * 1024), 1)
            raise serializers.ValidationError(
                {
                    "file": (
                        f"Le fichier ({file_size_mb} Mo) dépasse la limite maximale autorisée "
                        f"pour {media_type} ({max_size_mb} Mo)."
                    )
                }
            )

        # 3. Vérification de l'extension
        file_name = getattr(file, "name", "")
        suffix = Path(file_name).suffix.lower()

        if suffix in FORBIDDEN_EXTENSIONS:
            raise serializers.ValidationError(
                {"file": f"L'extension '{suffix}' est strictement interdite pour des raisons de sécurité."}
            )

        allowed_exts = ALLOWED_EXTENSIONS.get(media_type, set())
        if suffix not in allowed_exts:
            valid_exts_str = ", ".join(sorted(allowed_exts))
            raise serializers.ValidationError(
                {
                    "file": (
                        f"Extension '{suffix}' non autorisée pour le type '{media_type}'. "
                        f"Extensions valides : {valid_exts_str}."
                    )
                }
            )

        # 4. Lecture des octets initiaux (magic bytes) et réinitialisation systématique du curseur
        try:
            header = file.read(256)
        finally:
            file.seek(0)

        # 5. Détection du format binaire réel
        detected_format = detect_file_format(header)
        if detected_format is None:
            raise serializers.ValidationError(
                {"file": f"Le contenu du fichier ne correspond pas à un format valide pour {media_type}."}
            )

        # 6. Vérification de la cohérence entre le media_type déclaré et le format détecté
        compatible_types = FORMAT_TO_MEDIA_TYPE.get(detected_format)
        if isinstance(compatible_types, tuple):
            is_coherent = media_type in compatible_types
        else:
            is_coherent = media_type == compatible_types

        if not is_coherent:
            detected_label = (
                compatible_types
                if isinstance(compatible_types, str)
                else "/".join(compatible_types)
            )
            raise serializers.ValidationError(
                {
                    "file": (
                        f"Incohérence détectée : le fichier est de type '{detected_label}' "
                        f"mais a été déclaré comme '{media_type}'."
                    )
                }
            )

        return attrs
    
    def get_url(self, obj):
        """
        Generate absolute URL for the media file.
        Returns full URL like http://localhost:8000/media/2026/10/15/filename.jpg
        instead of relative /media/2026/10/15/filename.jpg
        This ensures images display correctly in frontend regardless of origin.
        """
        if not obj.file:
            return None
        
        request = self.context.get('request')
        relative_url = obj.file.url
        
        if request is not None:
            # Build absolute URL using request's scheme and host
            return request.build_absolute_uri(relative_url)
        
        # Fallback if request context not available (shouldn't happen in normal API usage)
        return relative_url
    
    def create(self, validated_data):
        """
        Create media and generate URL from file field.
        """
        media = Media.objects.create(**validated_data)
        return media
