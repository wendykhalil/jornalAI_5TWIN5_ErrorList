from django.db import models
from django.conf import settings
import uuid


class Media(models.Model):
    """
    Media model for storing user-uploaded images, audio, video, and documents.
    """
    
    MEDIA_TYPE_CHOICES = [
        ("image", "Image"),
        ("audio", "Audio"),
        ("video", "Video"),
        ("document", "Document"),
    ]
    
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="media"
    )
    
    title = models.CharField(max_length=255)
    
    description = models.TextField(blank=True)
    
    media_type = models.CharField(
        max_length=20,
        choices=MEDIA_TYPE_CHOICES,
        default="image"
    )
    
    file = models.FileField(upload_to="media/%Y/%m/%d/")
    
    url = models.URLField(
        blank=True,
        editable=False,
        help_text="Auto-generated URL for the uploaded file"
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ["-created_at"]
    
    def __str__(self):
        return self.title
