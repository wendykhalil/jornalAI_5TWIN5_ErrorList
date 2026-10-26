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
            "draft",
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
    
    def validate(self, data):
        """
        Validate based on draft status:
        - If draft=true, allow incomplete fields
        - If draft=false (publishing), require title, description, event_date
        
        Note: Only validate on creation; partial updates can change individual fields.
        """
        # Check if this is a create operation (no instance) and draft=false
        if not hasattr(self, 'instance') or self.instance is None:
            draft = data.get('draft', False)
            
            if not draft:
                # Publishing on create: validate required fields
                if not data.get('title') or not data['title'].strip():
                    raise serializers.ValidationError(
                        {"title": "Title is required for published memories."}
                    )
                if not data.get('description') or not data['description'].strip():
                    raise serializers.ValidationError(
                        {"description": "Description is required for published memories."}
                    )
                if not data.get('event_date'):
                    raise serializers.ValidationError(
                        {"event_date": "Event date is required for published memories."}
                    )
        else:
            # For updates: if transitioning from draft to published, require fields
            draft_value = data.get('draft')
            if draft_value is False and self.instance.draft is True:
                # Transitioning from draft to published: validate all required fields
                title = data.get('title', self.instance.title)
                description = data.get('description', self.instance.description)
                event_date = data.get('event_date', self.instance.event_date)
                
                if not title or not title.strip():
                    raise serializers.ValidationError(
                        {"title": "Title is required for published memories."}
                    )
                if not description or not description.strip():
                    raise serializers.ValidationError(
                        {"description": "Description is required for published memories."}
                    )
                if not event_date:
                    raise serializers.ValidationError(
                        {"event_date": "Event date is required for published memories."}
                    )
        
        return data
