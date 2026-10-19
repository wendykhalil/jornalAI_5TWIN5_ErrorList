
from django.db.models import Q, Count
from rest_framework import generics, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.authentication import JWTAuthentication

from .models import JournalEntry
from .serializers import JournalEntrySerializer
from .views import JournalPagination


class IsJournalAdmin(permissions.BasePermission):
    """
    Allow only application administrators.
    """

    message = "Administrator access required."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.is_active
            and (
                request.user.role == "admin"
                or request.user.is_superuser
            )
        )


class AdminJournalListView(generics.ListAPIView):
    """
    GET /api/admin/journal/

    Admin can list all journal entries.
    """

    authentication_classes = [JWTAuthentication]
    permission_classes = [
        permissions.IsAuthenticated,
        IsJournalAdmin,
    ]

    serializer_class = JournalEntrySerializer
    pagination_class = JournalPagination

    def get_queryset(self):
        queryset = JournalEntry.objects.select_related(
            "user"
        ).prefetch_related("images").all()

        params = self.request.query_params

        search = params.get("search", "").strip()

        if search:
            queryset = queryset.filter(
                Q(title__icontains=search)
                | Q(content__icontains=search)
                | Q(user__username__icontains=search)
            )

        user_id = params.get("user_id")

        if user_id:
            queryset = queryset.filter(
                user_id=user_id
            )

        mood = params.get("mood")

        if mood:
            queryset = queryset.filter(
                mood=mood
            )

        draft = params.get("draft")

        if draft in ("true", "false"):
            queryset = queryset.filter(
                draft=(draft == "true")
            )

        return queryset.order_by(
            "-created_at",
            "-pk"
        )


class AdminJournalDetailView(
    generics.RetrieveDestroyAPIView
):
    """
    GET /api/admin/journal/<id>/
    DELETE /api/admin/journal/<id>/

    Admin can view or delete a journal entry.
    """

    authentication_classes = [JWTAuthentication]
    permission_classes = [
        permissions.IsAuthenticated,
        IsJournalAdmin,
    ]

    serializer_class = JournalEntrySerializer

    queryset = JournalEntry.objects.select_related(
        "user"
    ).prefetch_related("images").all()


class AdminJournalStatsView(APIView):
    """
    GET /api/admin/journal/stats/

    Overall journal statistics.
    """

    authentication_classes = [JWTAuthentication]
    permission_classes = [
        permissions.IsAuthenticated,
        IsJournalAdmin,
    ]

    def get(self, request):
        queryset = JournalEntry.objects.all()

        total_entries = queryset.count()

        total_users = queryset.values(
            "user_id"
        ).distinct().count()

        published_entries = queryset.filter(
            draft=False
        ).count()

        draft_entries = queryset.filter(
            draft=True
        ).count()

        favorite_entries = queryset.filter(
            favorite=True
        ).count()

        mood_distribution = list(
            queryset.values("mood")
            .annotate(count=Count("id"))
            .order_by("-count", "mood")
        )

        return Response({
            "total_entries": total_entries,
            "users_with_entries": total_users,
            "published_entries": published_entries,
            "draft_entries": draft_entries,
            "favorite_entries": favorite_entries,
            "mood_distribution": mood_distribution,
        })
