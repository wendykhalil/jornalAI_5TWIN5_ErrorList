from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import GoalViewSet, HabitViewSet


router = DefaultRouter()
router.register(r"goals", GoalViewSet, basename="goal")
router.register(r"habits", HabitViewSet, basename="habit")

urlpatterns = [
    path("", include(router.urls)),
]
