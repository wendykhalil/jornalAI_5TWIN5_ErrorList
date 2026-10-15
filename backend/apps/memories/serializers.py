from rest_framework import serializers
from .models import Memory


class MemorySerializer(serializers.ModelSerializer):
    """
    Serializer for Memory model with validation for tags, category, and importance.
    Ensures cover URLs are absolute for cross-origin display.
    """
    
    class Meta:
        model = Memory
        fields = [
            "id",
            "title",
            "description",
            "event_date",
            "location",
            "category",
            "importance",
            "tags",
            "cover",
            "favorite",
            "ai_summary",
            "related_journal_entry",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "ai_summary"]
    
    def to_representation(self, instance):
        """
        Override to_representation to ensure cover URLs are absolute.
        This transforms the response to show absolute URLs while allowing input as-is.
        """
        data = super().to_representation(instance)
        
        # Convert cover URL to absolute if needed
        if data.get('cover'):
            cover_url = data['cover']
            
            # If already absolute, return as-is
            if cover_url.startswith(('http://', 'https://')):
                return data
            
            # If relative path, construct absolute URL
            if cover_url.startswith('/'):
                request = self.context.get('request')
                if request is not None:
                    data['cover'] = request.build_absolute_uri(cover_url)
        
        return data
    
    def validate_tags(self, value):
        """Ensure tags is a list of strings."""
        if not isinstance(value, list):
            raise serializers.ValidationError("Tags must be a list.")
        
        if not all(isinstance(tag, str) for tag in value):
            raise serializers.ValidationError("All tags must be strings.")
        
        return value
    
    def validate_category(self, value):
        """Validate category choice."""
        valid_categories = [choice[0] for choice in Memory.CATEGORY_CHOICES]
        if value not in valid_categories:
            raise serializers.ValidationError(
                f"Invalid category. Must be one of: {', '.join(valid_categories)}"
            )
        return value
    
    def validate_importance(self, value):
        """Validate importance choice."""
        valid_importances = [choice[0] for choice in Memory.IMPORTANCE_CHOICES]
        if value not in valid_importances:
            raise serializers.ValidationError(
                f"Invalid importance. Must be one of: {', '.join(valid_importances)}"
            )
        return value
