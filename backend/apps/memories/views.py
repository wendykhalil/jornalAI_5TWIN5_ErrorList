from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.authentication import JWTAuthentication

from .models import Memory
from .serializers import MemorySerializer


class MemoryViewSet(viewsets.ModelViewSet):
    """
    API ViewSet for managing memories.
    
    Features:
    - JWT authentication required
    - User isolation: users only see their own memories
    - Auto-set owner on creation
    - Standard CRUD operations with DefaultRouter
    """
    serializer_class = MemorySerializer
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Filter memories to current user only."""
        return Memory.objects.filter(
            user=self.request.user
        ).order_by("-event_date", "-created_at")
    
    def perform_create(self, serializer):
        """Auto-set the current user as the memory owner."""
        serializer.save(user=self.request.user)

