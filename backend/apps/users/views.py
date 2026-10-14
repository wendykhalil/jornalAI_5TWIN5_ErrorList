
import json

from django.contrib.auth import authenticate, get_user_model, login, logout
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.db import IntegrityError
from django.http import JsonResponse
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_GET, require_POST


# =====================================
# REGISTER
# =====================================

@require_POST
def register(request):
    try:
        data = json.loads(request.body)
    except (json.JSONDecodeError, UnicodeDecodeError):
        return JsonResponse(
            {"error": "Invalid JSON data"},
            status=400
        )

    if not isinstance(data, dict):
        return JsonResponse(
            {"error": "Expected a JSON object"},
            status=400
        )

    username = data.get("username")
    email = data.get("email")
    password = data.get("password")

    if not all(
        isinstance(v, str) and v.strip()
        for v in (username, email, password)
    ):
        return JsonResponse(
            {"error": "All fields are required"},
            status=400
        )

    username = username.strip()
    email = email.strip()

    User = get_user_model()

    if User.objects.filter(username=username).exists():
        return JsonResponse(
            {"error": "Username already exists"},
            status=400
        )

    try:
        validate_password(
            password,
            user=User(username=username, email=email)
        )
    except ValidationError as e:
        return JsonResponse(
            {"errors": e.messages},
            status=400
        )

    try:
        user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
            is_staff=False,
            is_superuser=False
        )
    except (IntegrityError, ValidationError):
        return JsonResponse(
            {"error": "Unable to create account"},
            status=400
        )

    return JsonResponse(
        {
            "message": "Account created successfully",
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "role": "user"
            }
        },
        status=201
    )


# =====================================
# CSRF TOKEN
# =====================================

@ensure_csrf_cookie
@require_GET
def csrf_token(request):
    return JsonResponse({
        "message": "CSRF cookie set"
    })


# =====================================
# LOGIN
# =====================================

@require_POST
def login_user(request):
    try:
        data = json.loads(request.body)
    except (json.JSONDecodeError, UnicodeDecodeError):
        return JsonResponse(
            {"error": "Invalid JSON"},
            status=400
        )

    if not isinstance(data, dict):
        return JsonResponse(
            {"error": "Invalid data"},
            status=400
        )

    username = data.get("username")
    password = data.get("password")

    if not isinstance(username, str) or not isinstance(password, str):
        return JsonResponse(
            {"error": "Username and password required"},
            status=400
        )

    user = authenticate(
        request,
        username=username,
        password=password
    )

    if user is None:
        return JsonResponse(
            {"error": "Invalid credentials"},
            status=401
        )

    login(request, user)

    return JsonResponse({
        "message": "Login successful",
        "user": {
            "id": user.id,
            "username": user.username,
            "role": "admin" if user.is_staff else "user"
        }
    })


# =====================================
# LOGOUT
# =====================================

@require_POST
def logout_user(request):
    if not request.user.is_authenticated:
        return JsonResponse(
            {"error": "Not authenticated"},
            status=401
        )

    logout(request)

    return JsonResponse({
        "message": "Logout successful"
    })


# =====================================
# CURRENT USER
# =====================================

@require_GET
def current_user(request):
    if not request.user.is_authenticated:
        return JsonResponse(
            {"error": "Not authenticated"},
            status=401
        )

    user = request.user

    return JsonResponse({
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "role": "admin" if user.is_staff else "user"
    })
