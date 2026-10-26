from django.contrib import admin

from .models import Goal, GoalProgress, GoalStep, Habit, HabitCheck


@admin.register(Goal)
class GoalAdmin(admin.ModelAdmin):
    list_display = ["title", "user", "status", "progress", "start_date", "end_date"]
    list_filter = ["status", "start_date"]
    search_fields = ["title", "description"]
    readonly_fields = ["id", "created_at", "updated_at"]


@admin.register(GoalProgress)
class GoalProgressAdmin(admin.ModelAdmin):
    list_display = ["goal", "progress", "created_at"]
    list_filter = ["progress", "created_at"]
    readonly_fields = ["id", "created_at"]


@admin.register(GoalStep)
class GoalStepAdmin(admin.ModelAdmin):
    list_display = ["title", "goal", "done", "order", "due_date"]
    list_filter = ["done", "due_date"]
    search_fields = ["title"]
    readonly_fields = ["id", "created_at", "updated_at"]


@admin.register(Habit)
class HabitAdmin(admin.ModelAdmin):
    list_display = ["name", "user", "frequency", "created_at"]
    list_filter = ["frequency"]
    search_fields = ["name"]
    readonly_fields = ["id", "created_at", "updated_at"]


@admin.register(HabitCheck)
class HabitCheckAdmin(admin.ModelAdmin):
    list_display = ["habit", "date", "completed"]
    list_filter = ["completed", "date"]
    readonly_fields = ["id", "created_at"]
