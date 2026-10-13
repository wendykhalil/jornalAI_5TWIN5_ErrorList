from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import get_user_model
from django.core.validators import EmailValidator
from django.core.exceptions import ValidationError

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    """
    Serializer for user public information.
    Excludes sensitive fields like password and permission details.
    """
    
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'role', 'date_joined']
        read_only_fields = ['id', 'date_joined']


class RegisterSerializer(serializers.ModelSerializer):
    """
    Serializer for user registration.
    Validates input and creates new users with default 'user' role.
    """
    
    email = serializers.EmailField(validators=[EmailValidator()])
    password = serializers.CharField(write_only=True, min_length=8)
    password_confirm = serializers.CharField(write_only=True, min_length=8)
    
    class Meta:
        model = User
        fields = ['username', 'email', 'first_name', 'last_name', 'password', 'password_confirm']
    
    def validate_username(self, value):
        """Ensure username is unique."""
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("This username is already in use.")
        return value
    
    def validate_email(self, value):
        """Ensure email is unique and normalize it."""
        value = value.lower().strip()
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("This email is already registered.")
        return value
    
    def validate(self, data):
        """Validate password confirmation matches."""
        if data['password'] != data['password_confirm']:
            raise serializers.ValidationError({
                'password_confirm': 'Passwords do not match.'
            })
        
        # Reject any attempt to set role in registration
        if 'role' in self.initial_data:
            raise serializers.ValidationError({
                'role': 'Role cannot be set during registration.'
            })
        
        return data
    
    def create(self, validated_data):
        """Create new user with hashed password and default user role."""
        validated_data.pop('password_confirm')
        password = validated_data.pop('password')
        
        # Always create with 'user' role for public registration
        user = User.objects.create_user(
            **validated_data,
            role='user'
        )
        user.set_password(password)
        user.save()
        
        return user


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Custom JWT token serializer that includes user information.
    """
    
    def validate(self, attrs):
        """Authenticate and include user role and basic info in token claims."""
        # Validate credentials
        data = super().validate(attrs)
        
        # Get the user
        user = self.user
        
        # Check if user is active
        if not user.is_active:
            raise serializers.ValidationError('This user account is inactive.')
        
        # Add user info to response
        data['user'] = {
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'role': user.role,
        }
        
        return data


class LoginSerializer(serializers.Serializer):
    """
    Serializer for user login.
    Accepts email or username with password.
    """
    
    username_or_email = serializers.CharField()
    password = serializers.CharField(write_only=True)
    
    def validate(self, data):
        """Authenticate user and return tokens."""
        username_or_email = data.get('username_or_email', '').strip()
        password = data.get('password', '')
        
        if not username_or_email or not password:
            raise serializers.ValidationError({
                'detail': 'Username/email and password are required.'
            })
        
        # Try to find user by email first, then username
        try:
            user = User.objects.get(email=username_or_email.lower())
        except User.DoesNotExist:
            try:
                user = User.objects.get(username=username_or_email)
            except User.DoesNotExist:
                raise serializers.ValidationError({
                    'detail': 'Invalid credentials.'
                })
        
        # Check if user is active
        if not user.is_active:
            raise serializers.ValidationError({
                'detail': 'This user account is inactive.'
            })
        
        # Verify password
        if not user.check_password(password):
            raise serializers.ValidationError({
                'detail': 'Invalid credentials.'
            })
        
        # Generate tokens
        refresh = RefreshToken.for_user(user)
        
        return {
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'role': user.role,
            },
            'access': str(refresh.access_token),
            'refresh': str(refresh),
        }


class RefreshTokenSerializer(serializers.Serializer):
    """
    Serializer for token refresh endpoint.
    """
    
    refresh = serializers.CharField()
    
    def validate_refresh(self, value):
        """Validate refresh token."""
        try:
            RefreshToken(value)
        except Exception:
            raise serializers.ValidationError('Invalid or expired refresh token.')
        return value


class ChangePasswordSerializer(serializers.Serializer):
    """
    Serializer for changing user password.
    """
    
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=8)
    new_password_confirm = serializers.CharField(write_only=True, min_length=8)
    
    def validate(self, data):
        """Validate password change request."""
        if data['new_password'] != data['new_password_confirm']:
            raise serializers.ValidationError({
                'new_password_confirm': 'Passwords do not match.'
            })
        
        user = self.context.get('user')
        if not user or not user.check_password(data['old_password']):
            raise serializers.ValidationError({
                'old_password': 'Current password is incorrect.'
            })
        
        return data
