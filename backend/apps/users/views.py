
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError

from django.contrib.auth import get_user_model

from .serializers import (
    RegisterSerializer,
    LoginSerializer,
    UserSerializer,
    RefreshTokenSerializer,
    ChangePasswordSerializer,
)

User = get_user_model()


@api_view(["POST"])
@permission_classes([AllowAny])
def register_view(request):
    """
    Register a new user.

    POST /api/auth/register/
    """
    serializer = RegisterSerializer(data=request.data)

    if serializer.is_valid():
        user = serializer.save()

        return Response(
            {
                "message": "User registered successfully.",
                "user": UserSerializer(user).data,
            },
            status=status.HTTP_201_CREATED,
        )

    return Response(
        serializer.errors,
        status=status.HTTP_400_BAD_REQUEST,
    )


@api_view(["POST"])
@permission_classes([AllowAny])
def login_view(request):
    """
    Authenticate user and return JWT tokens.

    POST /api/auth/login/
    """
    serializer = LoginSerializer(data=request.data)

    if serializer.is_valid():
        return Response(
            serializer.validated_data,
            status=status.HTTP_200_OK,
        )

    return Response(
        serializer.errors,
        status=status.HTTP_401_UNAUTHORIZED,
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def logout_view(request):
    """
    Logout by blacklisting the refresh token.

    POST /api/auth/logout/

    Headers:
        Authorization: Bearer <access_token>

    Body:
        {"refresh": "<refresh_token>"}
    """

    refresh_token = request.data.get("refresh")

    if not refresh_token:
        return Response(
            {"detail": "Refresh token is required."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        token = RefreshToken(refresh_token)

        # Check that the refresh token belongs to the
        # currently authenticated user.
        token_user_id = token.payload.get("user_id")

        if str(token_user_id) != str(request.user.pk):
            return Response(
                {
                    "detail": (
                        "Refresh token does not belong "
                        "to this user."
                    )
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        # Invalidate the refresh token.
        token.blacklist()

        return Response(
            {"message": "Logged out successfully."},
            status=status.HTTP_200_OK,
        )

    except TokenError:
        return Response(
            {"detail": "Invalid or expired refresh token."},
            status=status.HTTP_400_BAD_REQUEST,
        )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def current_user_view(request):
    """
    Get current authenticated user.

    GET /api/auth/me/
    """
    serializer = UserSerializer(request.user)

    return Response(
        serializer.data,
        status=status.HTTP_200_OK,
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def change_password_view(request):
    """
    Change the authenticated user's password.

    POST /api/auth/change-password/
    """
    serializer = ChangePasswordSerializer(
        data=request.data,
        context={"user": request.user},
    )

    if serializer.is_valid():
        user = request.user

        user.set_password(
            serializer.validated_data["new_password"]
        )

        user.save()

        return Response(
            {"message": "Password changed successfully."},
            status=status.HTTP_200_OK,
        )

    return Response(
        serializer.errors,
        status=status.HTTP_400_BAD_REQUEST,
    )
