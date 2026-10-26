from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

from .models import Media
from .serializers import MediaSerializer


class MediaViewSet(viewsets.ModelViewSet):
    """
    API ViewSet for managing user media files.
    
    Features:
    - JWT authentication required
    - User isolation: users only see their own media
    - Auto-set owner on creation
    - Support for multipart form data (file uploads)
    - Standard CRUD operations with DefaultRouter
    """
    serializer_class = MediaSerializer
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    parser_classes = (MultiPartParser, FormParser, JSONParser)
    
    def get_queryset(self):
        """Filter media to current user only."""
        return Media.objects.filter(
            user=self.request.user
        ).order_by("-created_at")
    
    def perform_create(self, serializer):
        """Auto-set the current user as the media owner."""
        serializer.save(user=self.request.user)
