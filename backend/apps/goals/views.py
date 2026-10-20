from datetime import date

from django.utils.dateparse import parse_date
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.authentication import JWTAuthentication

from .models import Goal, Habit, HabitCheck
from .serializers import GoalSerializer, HabitCheckSerializer, HabitSerializer


class GoalViewSet(viewsets.ModelViewSet):
    """
    CRUD for goals. JWT required, users only see their own goals.
    Optional filter: ?status=in-progress
    """

    serializer_class = GoalSerializer
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = Goal.objects.filter(user=self.request.user)
        status_param = self.request.query_params.get("status")
        if status_param:
            queryset = queryset.filter(status=status_param)
        return queryset.order_by("-created_at")

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class HabitViewSet(viewsets.ModelViewSet):
    """
    CRUD for habits. JWT required, users only see their own habits.

    Extra endpoints:
    - POST /api/habits/{id}/check/   validate (or unvalidate) a day
    - GET  /api/habits/{id}/checks/  history of validations
    """

    serializer_class = HabitSerializer
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Habit.objects.filter(user=self.request.user).order_by("name")

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=True, methods=["post"], url_path="check")
    def check(self, request, pk=None):
        """
        Body (all optional): {"date": "YYYY-MM-DD", "completed": true}
        Defaults to today and completed=true.
        """
        habit = self.get_object()

        raw_date = request.data.get("date")
        if raw_date:
            check_date = parse_date(str(raw_date))
            if check_date is None:
                return Response(
                    {"date": "Invalid date. Use the YYYY-MM-DD format."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        else:
            check_date = date.today()

        completed = request.data.get("completed", True)
        if not isinstance(completed, bool):
            return Response(
                {"completed": "Must be true or false."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        habit_check, created = HabitCheck.objects.update_or_create(
            habit=habit,
            date=check_date,
            defaults={"completed": completed},
        )
        serializer = HabitCheckSerializer(habit_check)
        return Response(
            serializer.data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    @action(detail=True, methods=["get"], url_path="checks")
    def checks(self, request, pk=None):
        habit = self.get_object()
        serializer = HabitCheckSerializer(habit.checks.all(), many=True)
        return Response(serializer.data)
