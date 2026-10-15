from django.contrib import admin
from .models import Memory


@admin.register(Memory)
class MemoryAdmin(admin.ModelAdmin):
    list_display = ["title", "user", "category", "importance", "event_date", "favorite", "created_at"]
    list_filter = ["category", "importance", "favorite", "created_at"]
    search_fields = ["title", "description", "location"]
    readonly_fields = ["id", "created_at", "updated_at"]
    fieldsets = (
        ("Memory Information", {
            "fields": ("id", "user", "title", "description")
        }),
        ("Event Details", {
            "fields": ("event_date", "location", "category", "importance")
        }),
        ("Content", {
            "fields": ("tags", "cover", "favorite", "ai_summary")
        }),
        ("Relations", {
            "fields": ("related_journal_entry",)
        }),
        ("Timestamps", {
            "fields": ("created_at", "updated_at")
        }),
    )

