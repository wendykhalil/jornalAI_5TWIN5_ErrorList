
from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import JournalEntryViewSet
from .admin_views import (
    AdminJournalListView,
    AdminJournalDetailView,
    AdminJournalStatsView,
)

router = DefaultRouter()

router.register(
    r"journal",
    JournalEntryViewSet,
    basename="journal"
)

urlpatterns = [
    path(
        "admin/journal/stats/",
        AdminJournalStatsView.as_view(),
        name="admin-journal-stats"
    ),
    path(
        "admin/journal/",
        AdminJournalListView.as_view(),
        name="admin-journal-list"
    ),
    path(
    "admin/journal/<uuid:pk>/",
    AdminJournalDetailView.as_view(),
    name="admin-journal-detail"
),
    path("", include(router.urls)),
]
