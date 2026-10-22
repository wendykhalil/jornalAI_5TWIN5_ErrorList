from datetime import date

from django.utils.dateparse import parse_date
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.authentication import JWTAuthentication

from . import ai
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

    # ------------------------------------------------------------------
    # AI: insights and RAG coach (Ollama, same config as the journal)
    # ------------------------------------------------------------------
    @action(detail=False, methods=["get"], url_path="insights")
    def insights(self, request):
        """
        Coaching suggestions about goals and habits.
        Written by the LLM when available, otherwise computed with simple
        rules (response["source"] tells which one). ?mode=rules skips the LLM.
        """
        data = ai.collect_user_data(request.user)
        rules = ai.rule_based_insights(data)

        if request.query_params.get("mode") == "rules" or not (
            data["goals"] or data["habits"]
        ):
            return Response({"insights": rules, "source": "rules"})

        try:
            return Response(
                {"insights": ai.ai_insights(data), "source": "ai"}
            )
        except ai.AIUnavailable as exc:
            return Response(
                {"insights": rules, "source": "rules", "warning": exc.message}
            )

    @action(detail=False, methods=["post"], url_path="coach")
    def coach(self, request):
        """
        RAG chatbot. Body: {"question": "...", "history": [{role, content}]}
        Retrieves the user's relevant goals / habits / journal entries and
        asks the LLM to answer from them.
        """
        question = request.data.get("question", "")
        if not isinstance(question, str) or not question.strip():
            return Response(
                {"error": "Please ask a question."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        question = question.strip()
        if len(question) > 1000:
            return Response(
                {"error": "Maximum 1000 characters."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        history = request.data.get("history", [])
        if not isinstance(history, list):
            history = []
        history = [t for t in history if isinstance(t, dict)]

        try:
            return Response(ai.coach_answer(request.user, question, history))
        except ai.AIUnavailable as exc:
            return Response({"error": exc.message}, status=exc.status_code)


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
