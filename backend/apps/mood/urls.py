from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import MoodCheckViewSet

router = DefaultRouter()
router.register(r"moods", MoodCheckViewSet, basename="mood")

urlpatterns = [
    path("", include(router.urls)),
]
