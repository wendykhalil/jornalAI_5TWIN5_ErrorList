from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import MemoryViewSet


router = DefaultRouter()
router.register(
    r"memories",
    MemoryViewSet,
    basename="memory"
)

urlpatterns = [
    path("", include(router.urls)),
]
