from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import GoalStepViewSet, GoalViewSet, HabitViewSet


router = DefaultRouter()
router.register(r"goals", GoalViewSet, basename="goal")
router.register(r"habits", HabitViewSet, basename="habit")
router.register(r"goal-steps", GoalStepViewSet, basename="goal-step")

urlpatterns = [
    path("", include(router.urls)),
]
