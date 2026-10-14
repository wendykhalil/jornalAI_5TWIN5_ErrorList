from django.contrib import admin
from django.urls import path, include


urlpatterns = [
    path("admin/", admin.site.urls),

    # Existing authentication API
    path("api/", include("apps.users.urls")),

    # Journal Management API
    path("api/", include("apps.journal.urls")),
]