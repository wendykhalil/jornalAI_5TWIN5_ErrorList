from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from . import views

app_name = "users"
urlpatterns = [
    path("auth/register/", views.register_view, name="register"),
    path("auth/login/", views.login_view, name="login"),
    path("auth/logout/", views.logout_view, name="logout"),
    path("auth/me/", views.current_user_view, name="current-user"),
    path("auth/change-password/", views.change_password_view, name="change-password"),
    path("auth/token/refresh/", views.CustomTokenRefreshView.as_view(), name="token-refresh"),
]
