from datetime import date, timedelta
from collections import Counter
import re

from django.utils import timezone
from rest_framework.decorators import action
from rest_framework.response import Response

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


    @action(detail=False, methods=["get"], url_path="analytics")
    def analytics(self, request):
        # Deliberately independent of search/pagination filters.
        entries = list(JournalEntry.objects.filter(user=request.user).values(
            "date", "content", "mood", "draft", "favorite"
        ))
        today = timezone.localdate()
        dates = {entry["date"] for entry in entries if entry["date"]}
        # A streak can end today or yesterday without resetting prematurely.
        cursor = today if today in dates else today - timedelta(days=1)
        streak = 0
        while cursor in dates:
            streak += 1
            cursor -= timedelta(days=1)

        daily_counts = Counter(entry["date"] for entry in entries if entry["date"])
        daily_activity = [
            {"date": (today - timedelta(days=offset)).isoformat(),
             "entries": daily_counts.get(today - timedelta(days=offset), 0)}
            for offset in range(29, -1, -1)
        ]
        mood_counts = Counter(entry["mood"] for entry in entries if entry["mood"])
        month_counts = Counter(
            entry["date"].strftime("%Y-%m") for entry in entries if entry["date"]
        )
        return Response({
            "total_entries": len(entries),
            "published_entries": sum(not entry["draft"] for entry in entries),
            "draft_entries": sum(bool(entry["draft"]) for entry in entries),
            "favorite_entries": sum(bool(entry["favorite"]) for entry in entries),
            "total_words": sum(len(re.findall(r"\b\w+\b", entry["content"] or "", re.UNICODE)) for entry in entries),
            "current_streak": streak,
            "entries_this_month": month_counts.get(today.strftime("%Y-%m"), 0),
            "daily_activity": daily_activity,
            "mood_distribution": [
                {"mood": mood, "count": count}
                for mood, count in sorted(mood_counts.items(), key=lambda pair: (-pair[1], pair[0]))
            ],
            "monthly_activity": [
                {"month": month, "entries": month_counts[month]}
                for month in sorted(month_counts)
            ],
        })
