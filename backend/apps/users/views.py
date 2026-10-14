from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from .serializers import (
    RegisterSerializer, LoginSerializer, UserSerializer,
    RefreshTokenSerializer, ChangePasswordSerializer,
)

User = get_user_model()

@api_view(["POST"])
@permission_classes([AllowAny])
def register_view(request):
    serializer = RegisterSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.save()
        return Response({"message": "User registered successfully.", "user": UserSerializer(user).data}, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(["POST"])
@permission_classes([AllowAny])
def login_view(request):
    serializer = LoginSerializer(data=request.data)
    if serializer.is_valid():
        return Response(serializer.validated_data, status=status.HTTP_200_OK)
    return Response(serializer.errors, status=status.HTTP_401_UNAUTHORIZED)

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def logout_view(request):
    refresh_token = request.data.get("refresh")
    if not refresh_token:
        return Response({"detail": "Refresh token is required."}, status=status.HTTP_400_BAD_REQUEST)
    try:
        token = RefreshToken(refresh_token)
        if str(token.payload.get("user_id")) != str(request.user.pk):
            return Response({"detail": "Refresh token does not belong to this user."}, status=status.HTTP_403_FORBIDDEN)
        token.blacklist()
        return Response({"message": "Logged out successfully."}, status=status.HTTP_200_OK)
    except TokenError:
        return Response({"detail": "Invalid or expired refresh token."}, status=status.HTTP_400_BAD_REQUEST)

@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated])
def current_user_view(request):
    if request.method == "GET":
        return Response(UserSerializer(request.user).data)

    permitted = {"first_name", "last_name", "username", "email"}
    incoming = set(request.data.keys())
    if not incoming.issubset(permitted):
        return Response({"detail": "Unsupported profile field."}, status=status.HTTP_400_BAD_REQUEST)

    user = request.user
    for key in incoming:
        value = request.data[key]
        if not isinstance(value, str):
            return Response({key: ["Must be a string."]}, status=status.HTTP_400_BAD_REQUEST)
        value = value.strip()
        if key in {"username", "email"} and not value:
            return Response({key: ["This field is required."]}, status=status.HTTP_400_BAD_REQUEST)
        setattr(user, key, value)

    if User.objects.exclude(pk=user.pk).filter(username=user.username).exists():
        return Response({"username": ["Username already in use."]}, status=status.HTTP_400_BAD_REQUEST)
    if user.email and User.objects.exclude(pk=user.pk).filter(email__iexact=user.email).exists():
        return Response({"email": ["Email already in use."]}, status=status.HTTP_400_BAD_REQUEST)

    try:
        user.full_clean()
        with transaction.atomic():
            user.save(update_fields=list(incoming)) if incoming else None
    except ValidationError as error:
        return Response(error.message_dict if hasattr(error, "message_dict") else {"detail": error.messages}, status=status.HTTP_400_BAD_REQUEST)
    except IntegrityError:
        return Response({"detail": "Username or email already in use."}, status=status.HTTP_400_BAD_REQUEST)

    return Response(UserSerializer(user).data)

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def change_password_view(request):
    serializer = ChangePasswordSerializer(data=request.data, context={"user": request.user})
    if serializer.is_valid():
        user = request.user
        user.set_password(serializer.validated_data["new_password"])
        user.save()
        return Response({"message": "Password changed successfully."}, status=status.HTTP_200_OK)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
