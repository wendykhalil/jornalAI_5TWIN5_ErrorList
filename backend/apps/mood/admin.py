from django.contrib import admin

from .models import MoodCheck


@admin.register(MoodCheck)
class MoodCheckAdmin(admin.ModelAdmin):
    list_display = ["mood", "intensity", "user", "date", "created_at"]
    list_filter = ["mood", "intensity", "date"]
    search_fields = ["note", "user__username", "user__email"]
    readonly_fields = ["id", "created_at", "updated_at"]
