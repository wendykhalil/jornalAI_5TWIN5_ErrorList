from django.urls import path
from .views import (
    register,
    csrf_token,
    login_user,
    logout_user,
    current_user,
)

urlpatterns = [
    path("csrf/", csrf_token, name="csrf"),
    path("register/", register, name="register"),
    path("login/", login_user, name="login"),
    path("logout/", logout_user, name="logout"),
    path("me/", current_user, name="current_user"),
]