from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView
from django.contrib.auth import get_user_model

from .serializers import (
    RegisterSerializer,
    LoginSerializer,
    UserSerializer,
    RefreshTokenSerializer,
    ChangePasswordSerializer,
)

User = get_user_model()


@api_view(['POST'])
@permission_classes([AllowAny])
def register_view(request):
    """
    Register a new user.
    
    POST /api/auth/register/
    {
        "username": "string",
        "email": "user@example.com",
        "password": "secure_password",
        "password_confirm": "secure_password",
        "first_name": "optional",
        "last_name": "optional"
    }
    
    Returns:
    {
        "id": 1,
        "username": "user",
        "email": "user@example.com",
        "role": "user"
    }
    """
    if request.method == 'POST':
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            user_data = UserSerializer(user).data
            return Response(
                {
                    'message': 'User registered successfully.',
                    'user': user_data
                },
                status=status.HTTP_201_CREATED
            )
        
        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST
        )


@api_view(['POST'])
@permission_classes([AllowAny])
def login_view(request):
    """
    Authenticate user and return JWT tokens.
    
    POST /api/auth/login/
    {
        "username_or_email": "user@example.com or username",
        "password": "password"
    }
    
    Returns:
    {
        "user": {
            "id": 1,
            "username": "user",
            "email": "user@example.com",
            "role": "user"
        },
        "access": "jwt_token",
        "refresh": "refresh_token"
    }
    """
    if request.method == 'POST':
        serializer = LoginSerializer(data=request.data)
        if serializer.is_valid():
            return Response(
                serializer.validated_data,
                status=status.HTTP_200_OK
            )
        
        return Response(
            serializer.errors,
            status=status.HTTP_401_UNAUTHORIZED
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout_view(request):
    """
    Logout user by blacklisting refresh token.
    
    POST /api/auth/logout/
    Headers: Authorization: Bearer {access_token}
    {
        "refresh": "refresh_token"
    }
    
    Note: This is optional. Logout is primarily handled on the frontend by
    deleting the JWT token. The backend doesn't maintain a logout state
    for stateless JWT authentication.
    """
    try:
        refresh_token = request.data.get('refresh')
        if refresh_token:
            token = RefreshToken(refresh_token)
            token.blacklist()
        
        return Response(
            {'message': 'Logged out successfully.'},
            status=status.HTTP_200_OK
        )
    except Exception as e:
        return Response(
            {'detail': 'Invalid or expired refresh token.'},
            status=status.HTTP_400_BAD_REQUEST
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def current_user_view(request):
    """
    Get current authenticated user information.
    
    GET /api/auth/me/
    Headers: Authorization: Bearer {access_token}
    
    Returns:
    {
        "id": 1,
        "username": "user",
        "email": "user@example.com",
        "first_name": "John",
        "last_name": "Doe",
        "role": "user",
        "date_joined": "2026-10-13T14:30:00Z"
    }
    """
    serializer = UserSerializer(request.user)
    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def change_password_view(request):
    """
    Change user password.
    
    POST /api/auth/change-password/
    Headers: Authorization: Bearer {access_token}
    {
        "old_password": "current_password",
        "new_password": "new_secure_password",
        "new_password_confirm": "new_secure_password"
    }
    
    Returns:
    {
        "message": "Password changed successfully."
    }
    """
    serializer = ChangePasswordSerializer(
        data=request.data,
        context={'user': request.user}
    )
    
    if serializer.is_valid():
        user = request.user
        user.set_password(serializer.validated_data['new_password'])
        user.save()
        return Response(
            {'message': 'Password changed successfully.'},
            status=status.HTTP_200_OK
        )
    
    return Response(
        serializer.errors,
        status=status.HTTP_400_BAD_REQUEST
    )

