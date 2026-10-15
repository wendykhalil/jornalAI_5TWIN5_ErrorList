from django.contrib import admin
from .models import Media


@admin.register(Media)
class MediaAdmin(admin.ModelAdmin):
    list_display = ["title", "user", "media_type", "created_at"]
    list_filter = ["media_type", "created_at"]
    search_fields = ["title", "description"]
    readonly_fields = ["id", "url", "created_at", "updated_at"]
    fieldsets = (
        ("Media Information", {
            "fields": ("id", "user", "title", "description", "media_type")
        }),
        ("File", {
            "fields": ("file", "url")
        }),
        ("Timestamps", {
            "fields": ("created_at", "updated_at")
        }),
    )

