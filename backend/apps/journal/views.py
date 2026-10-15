from datetime import date

from django.db.models import Q
from rest_framework import viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.authentication import JWTAuthentication

from .models import JournalEntry
from .serializers import JournalEntrySerializer


class JournalPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = "page_size"
    max_page_size = 50


class JournalEntryViewSet(viewsets.ModelViewSet):
    serializer_class = JournalEntrySerializer
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    pagination_class = JournalPagination

    def get_queryset(self):
        queryset = JournalEntry.objects.filter(user=self.request.user)
        params = self.request.query_params

        search = params.get("search", "").strip()
        if search:
            queryset = queryset.filter(
                Q(title__icontains=search) | Q(content__icontains=search)
                | Q(tags__icontains=search)
            )

        mood = params.get("mood", "").strip()
        if mood:
            queryset = queryset.filter(mood=mood)

        for field in ("favorite", "draft"):
            value = params.get(field)
            if value is not None and value != "":
                normalized = value.lower()
                if normalized not in ("true", "false"):
                    raise ValidationError({field: "Use true or false."})
                queryset = queryset.filter(**{field: normalized == "true"})

        for key, lookup in (("date_from", "date__gte"), ("date_to", "date__lte")):
            raw = params.get(key)
            if raw:
                try:
                    date.fromisoformat(raw)
                except ValueError:
                    raise ValidationError({key: "Use YYYY-MM-DD."})
                queryset = queryset.filter(**{lookup: raw})

        ordering = params.get("ordering", "-date")
        allowed = {"date", "-date", "title", "-title", "created_at", "-created_at"}
        if ordering not in allowed:
            raise ValidationError({"ordering": "Unsupported ordering value."})
        return queryset.order_by(ordering, "-created_at", "-pk")

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
