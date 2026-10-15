from rest_framework import serializers
from .models import Media


class MediaSerializer(serializers.ModelSerializer):
    """
    Serializer for Media model with file upload support.
    Generates absolute URLs for media files to work across frontend/backend on different origins.
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
