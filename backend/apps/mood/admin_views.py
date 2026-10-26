from datetime import datetime, time, timedelta

from django.db.models import Avg, Count
from django.utils import timezone
from rest_framework import generics, permissions, serializers
from rest_framework.exceptions import ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.authentication import JWTAuthentication

from .models import MoodCheck


class IsMoodAdmin(permissions.BasePermission):
    """Allow only application administrators."""

    message = "Administrator access required."

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and user.is_active
            and (user.role == "admin" or user.is_superuser)
        )


class AdminMoodPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100


class AdminMoodCheckSerializer(serializers.ModelSerializer):
    """Operational mood metadata. The personal note is never included."""

    username = serializers.CharField(source="user.username", read_only=True)
    has_note = serializers.SerializerMethodField()

    class Meta:
        model = MoodCheck
        fields = ["id", "username", "mood", "intensity", "date", "has_note"]

    def get_has_note(self, obj):
        return bool((obj.note or "").strip())


def _aware_bounds(start_day, end_day):
    start = timezone.make_aware(datetime.combine(start_day, time.min))
    end = timezone.make_aware(datetime.combine(end_day, time.max))
    return start, end


def _local_day(value):
    if timezone.is_aware(value):
        value = timezone.localtime(value)
    return value.date()


class AdminMoodListView(generics.ListAPIView):
    """GET /api/admin/moods/ — check-ins of every user, without notes."""

    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated, IsMoodAdmin]
    serializer_class = AdminMoodCheckSerializer
    pagination_class = AdminMoodPagination

    def get_queryset(self):
        queryset = MoodCheck.objects.select_related("user")
        params = self.request.query_params

        mood = params.get("mood", "").strip()
        if mood:
            allowed = [choice[0] for choice in MoodCheck.MOOD_CHOICES]
            if mood not in allowed:
                raise ValidationError({"mood": "Humeur inconnue."})
            queryset = queryset.filter(mood=mood)

        search = params.get("search", "").strip()
        if search:
            queryset = queryset.filter(user__username__icontains=search)

        return queryset.order_by("-date", "-created_at")


class AdminMoodStatsView(APIView):
    """GET /api/admin/moods/stats/ — counts computed from stored check-ins."""

    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated, IsMoodAdmin]

    def get(self, request):
        queryset = MoodCheck.objects.all()
        today = timezone.localdate()
        week_start = today - timedelta(days=today.weekday())
        previous_week_end = week_start - timedelta(days=1)
        previous_week_start = week_start - timedelta(days=7)
        month_start = today.replace(day=1)
        chart_start = today - timedelta(days=13)

        def count_between(start_day, end_day):
            start, end = _aware_bounds(start_day, end_day)
            return queryset.filter(date__gte=start, date__lte=end).count()

        average = queryset.aggregate(value=Avg("intensity"))["value"]
        distribution = list(
            queryset.order_by()
            .values("mood")
            .annotate(count=Count("id"))
            .order_by("-count", "mood")
        )
        dominant = distribution[0] if distribution else None

        chart_start_at, chart_end_at = _aware_bounds(chart_start, today)
        grouped = {}
        for stamp, intensity in queryset.filter(
            date__gte=chart_start_at,
            date__lte=chart_end_at,
        ).values_list("date", "intensity"):
            bucket = grouped.setdefault(
                _local_day(stamp),
                {"count": 0, "total": 0},
            )
            bucket["count"] += 1
            bucket["total"] += intensity

        daily = []
        for offset in range(14):
            day = chart_start + timedelta(days=offset)
            row = grouped.get(day)
            average_intensity = None
            if row:
                average_intensity = round(row["total"] / row["count"], 1)
            daily.append({
                "date": day.isoformat(),
                "count": row["count"] if row else 0,
                "average_intensity": average_intensity,
            })

        return Response({
            "total": queryset.count(),
            "this_week": count_between(week_start, week_start + timedelta(days=6)),
            "previous_week": count_between(previous_week_start, previous_week_end),
            "this_month": count_between(month_start, today),
            "users_with_checkins": queryset.values("user_id").distinct().count(),
            "average_intensity": round(average, 1) if average is not None else None,
            "dominant_mood": dominant["mood"] if dominant else None,
            "dominant_count": dominant["count"] if dominant else 0,
            "distribution": distribution,
            "daily": daily,
        })
