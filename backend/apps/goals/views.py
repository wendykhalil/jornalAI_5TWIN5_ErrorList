from datetime import date

from django.db import transaction
from django.utils.dateparse import parse_date
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.authentication import JWTAuthentication

from . import ai
from .models import Goal, GoalStep, Habit, HabitCheck
from .serializers import (
    GoalProgressSerializer,
    GoalSerializer,
    GoalStepSerializer,
    HabitCheckSerializer,
    HabitSerializer,
)
from .services import record_progress, sync_progress_from_steps


class GoalViewSet(viewsets.ModelViewSet):
    """
    CRUD for goals. JWT required, users only see their own goals.
    Optional filter: ?status=in-progress
    """

    serializer_class = GoalSerializer
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = Goal.objects.filter(user=self.request.user).prefetch_related("steps")
        status_param = self.request.query_params.get("status")
        if status_param:
            queryset = queryset.filter(status=status_param)
        return queryset.order_by("-created_at")

    def perform_create(self, serializer):
        goal = serializer.save(user=self.request.user)
        record_progress(goal)

    def perform_update(self, serializer):
        goal = serializer.save()
        record_progress(goal)

    @action(detail=True, methods=["get"], url_path="history")
    def history(self, request, pk=None):
        goal = self.get_object()
        if not goal.history.exists():
            record_progress(goal)
        return Response(GoalProgressSerializer(goal.history.all(), many=True).data)

    @action(detail=True, methods=["get", "post"], url_path="steps")
    def steps(self, request, pk=None):
        goal = self.get_object()
        if request.method == "GET":
            return Response(GoalStepSerializer(goal.steps.all(), many=True).data)

        payload = request.data
        raw_steps = payload.get("steps") if isinstance(payload, dict) else None
        if raw_steps is None:
            raw_steps = [payload]
        if not isinstance(raw_steps, list) or not raw_steps:
            return Response(
                {"steps": "Provide a step object or a non-empty steps list."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if goal.steps.count() + len(raw_steps) > 50:
            return Response(
                {"steps": "An objective cannot have more than 50 steps."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializers = []
        for item in raw_steps:
            if not isinstance(item, dict):
                return Response(
                    {"steps": "Each step must be an object."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            step_serializer = GoalStepSerializer(data=item)
            step_serializer.is_valid(raise_exception=True)
            serializers.append(step_serializer)

        with transaction.atomic():
            next_order = goal.steps.order_by("-order").values_list("order", flat=True).first()
            next_order = (next_order + 1) if next_order is not None else 0
            created = [
                step_serializer.save(goal=goal, order=next_order + index)
                for index, step_serializer in enumerate(serializers)
            ]
            sync_progress_from_steps(goal)
        return Response(
            GoalStepSerializer(created, many=True).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"], url_path="breakdown")
    def breakdown(self, request, pk=None):
        goal = self.get_object()
        try:
            return Response({"steps": ai.breakdown_goal(goal)})
        except ai.AIUnavailable as exc:
            return Response({"error": exc.message}, status=exc.status_code)

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


class GoalStepViewSet(
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = GoalStepSerializer
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    def get_queryset(self):
        return GoalStep.objects.filter(goal__user=self.request.user).select_related(
            "goal"
        )

    def perform_update(self, serializer):
        step = serializer.save()
        sync_progress_from_steps(step.goal)

    def perform_destroy(self, instance):
        goal = instance.goal
        instance.delete()
        sync_progress_from_steps(goal)
