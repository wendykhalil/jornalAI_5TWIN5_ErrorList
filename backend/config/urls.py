
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static


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
]

# Serve media files in development
if settings.DEBUG:
    urlpatterns += static(
        settings.MEDIA_URL,
        document_root=settings.MEDIA_ROOT
    )
