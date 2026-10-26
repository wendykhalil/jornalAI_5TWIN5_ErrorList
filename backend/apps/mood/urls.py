from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .admin_views import AdminMoodListView, AdminMoodStatsView
from .views import MoodCheckViewSet

router = DefaultRouter()
router.register(r"moods", MoodCheckViewSet, basename="mood")

urlpatterns = [
    path("admin/moods/stats/", AdminMoodStatsView.as_view(), name="admin-mood-stats"),
    path("admin/moods/", AdminMoodListView.as_view(), name="admin-mood-list"),
    path("", include(router.urls)),
]
