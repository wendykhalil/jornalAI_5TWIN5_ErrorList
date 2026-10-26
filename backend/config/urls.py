
from django.contrib import admin
from django.urls import path, include
from apps.media.views import serve_private_media


urlpatterns = [
    path("admin/", admin.site.urls),

    # Authentication API
    path("api/", include("apps.users.urls")),

    # Journal Management API
    path("api/", include("apps.journal.urls")),

    # Memories Management API
    path("api/", include("apps.memories.urls")),

    # Media Management API
    path("api/", include("apps.media.urls")),

    # Mood Tracking API
    path("api/", include("apps.mood.urls")),

    # Goals & Habits Management API
    path("api/", include("apps.goals.urls")),

    # Private Media File Access (Authenticated & Per-User Authorized)
    path("media/<path:file_path>", serve_private_media, name="private-media"),
]
