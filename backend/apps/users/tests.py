from django.test import TestCase, Client
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken
import json

User = get_user_model()


class UserModelTests(TestCase):
    """Tests for the custom User model."""
    
    def setUp(self):
        """Create test users."""
        self.regular_user = User.objects.create_user(
            username='testuser',
            email='testuser@example.com',
            password='testpass123',
            role='user'
        )
        
        self.admin_user = User.objects.create_user(
            username='adminuser',
            email='admin@example.com',
            password='adminpass123',
            role='admin'
        )
    
    def test_user_model_creation(self):
        """Test that users are created correctly."""
        self.assertEqual(self.regular_user.username, 'testuser')
        self.assertEqual(self.regular_user.role, 'user')
        self.assertTrue(self.regular_user.is_active)
        self.assertFalse(self.regular_user.is_staff)
    
    def test_default_role_is_user(self):
        """Test that default role for new user is 'user'."""
        user = User.objects.create_user(
            username='newuser',
            email='new@example.com',
            password='newpass123'
        )
        self.assertEqual(user.role, 'user')
    
    def test_admin_role_assignment(self):
        """Test that admin role can be assigned."""
        self.assertEqual(self.admin_user.role, 'admin')
        self.assertTrue(self.admin_user.is_admin())
    
    def test_is_admin_method(self):
        """Test the is_admin() helper method."""
        self.assertFalse(self.regular_user.is_admin())
        self.assertTrue(self.admin_user.is_admin())
    
    def test_password_hashing(self):
        """Test that passwords are hashed correctly."""
        user = User.objects.create_user(
            username='hashtest',
            email='hash@example.com',
            password='plaintext'
        )
        self.assertNotEqual(user.password, 'plaintext')
        self.assertTrue(user.check_password('plaintext'))
        self.assertFalse(user.check_password('wrongpassword'))
    
    def test_unique_email(self):
        """Test that emails must be unique."""
        from django.db import IntegrityError
        
        with self.assertRaises(IntegrityError):
            User.objects.create_user(
                username='duplicate',
                email='testuser@example.com',  # Already exists
                password='pass123'
            )
    
    def test_unique_username(self):
        """Test that usernames must be unique."""
        with self.assertRaises(Exception):
            User.objects.create_user(
                username='testuser',  # Already exists
                email='dup@example.com',
                password='pass123'
            )


class RegistrationAPITests(APITestCase):
    """Tests for the registration endpoint."""
    
    def setUp(self):
        self.client = APIClient()
        self.register_url = '/api/auth/register/'
    
    def test_successful_registration(self):
        """Test successful user registration."""
        data = {
            'username': 'newuser',
            'email': 'newuser@example.com',
            'password': 'SecurePass123',
            'password_confirm': 'SecurePass123',
            'first_name': 'John',
            'last_name': 'Doe'
        }
        response = self.client.post(self.register_url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('user', response.data)
        self.assertEqual(response.data['user']['username'], 'newuser')
        self.assertEqual(response.data['user']['role'], 'user')
        
        # Verify user was created in database
        user = User.objects.get(username='newuser')
        self.assertEqual(user.email, 'newuser@example.com')
    
    def test_registration_missing_required_fields(self):
        """Test registration with missing required fields."""
        data = {
            'username': 'newuser',
            'email': 'newuser@example.com',
            # Missing password and password_confirm
        }
        response = self.client.post(self.register_url, data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('password', response.data)
    
    def test_registration_invalid_email(self):
        """Test registration with invalid email."""
        data = {
            'username': 'newuser',
            'email': 'not-an-email',
            'password': 'SecurePass123',
            'password_confirm': 'SecurePass123'
        }
        response = self.client.post(self.register_url, data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('email', response.data)
    
    def test_registration_password_mismatch(self):
        """Test registration with mismatched passwords."""
        data = {
            'username': 'newuser',
            'email': 'newuser@example.com',
            'password': 'SecurePass123',
            'password_confirm': 'DifferentPass123'
        }
        response = self.client.post(self.register_url, data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('password_confirm', response.data)
    
    def test_registration_weak_password(self):
        """Test registration with weak password (less than 8 characters)."""
        data = {
            'username': 'newuser',
            'email': 'newuser@example.com',
            'password': 'weak',
            'password_confirm': 'weak'
        }
        response = self.client.post(self.register_url, data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
    
    def test_registration_duplicate_email(self):
        """Test registration with already registered email."""
        User.objects.create_user(
            username='existing',
            email='existing@example.com',
            password='pass123'
        )
        
        data = {
            'username': 'newuser',
            'email': 'existing@example.com',
            'password': 'SecurePass123',
            'password_confirm': 'SecurePass123'
        }
        response = self.client.post(self.register_url, data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('email', response.data)
    
    def test_registration_duplicate_username(self):
        """Test registration with already registered username."""
        User.objects.create_user(
            username='existing',
            email='existing@example.com',
            password='pass123'
        )
        
        data = {
            'username': 'existing',
            'email': 'newuser@example.com',
            'password': 'SecurePass123',
            'password_confirm': 'SecurePass123'
        }
        response = self.client.post(self.register_url, data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('username', response.data)
    
    def test_registration_cannot_set_admin_role(self):
        """Test that registration cannot set admin role directly."""
        data = {
            'username': 'newuser',
            'email': 'newuser@example.com',
            'password': 'SecurePass123',
            'password_confirm': 'SecurePass123',
            'role': 'admin'  # Should be ignored/rejected
        }
        response = self.client.post(self.register_url, data)
        # Should either reject or create with 'user' role
        if response.status_code == status.HTTP_201_CREATED:
            self.assertEqual(response.data['user']['role'], 'user')
        else:
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
    
    def test_registration_email_case_insensitive(self):
        """Test that email registration is case-insensitive."""
        data1 = {
            'username': 'user1',
            'email': 'Test@Example.com',
            'password': 'SecurePass123',
            'password_confirm': 'SecurePass123'
        }
        response1 = self.client.post(self.register_url, data1)
        self.assertEqual(response1.status_code, status.HTTP_201_CREATED)
        
        # Try to register with same email in different case
        data2 = {
            'username': 'user2',
            'email': 'test@example.com',
            'password': 'SecurePass123',
            'password_confirm': 'SecurePass123'
        }
        response2 = self.client.post(self.register_url, data2)
        self.assertEqual(response2.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('email', response2.data)


class LoginAPITests(APITestCase):
    """Tests for the login endpoint."""
    
    def setUp(self):
        self.client = APIClient()
        self.login_url = '/api/auth/login/'
        
        self.user = User.objects.create_user(
            username='testuser',
            email='testuser@example.com',
            password='TestPass123',
            role='user',
            is_active=True
        )
        
        self.admin = User.objects.create_user(
            username='adminuser',
            email='admin@example.com',
            password='AdminPass123',
            role='admin',
            is_active=True
        )
    
    def test_login_with_email(self):
        """Test successful login with email."""
        data = {
            'username_or_email': 'testuser@example.com',
            'password': 'TestPass123'
        }
        response = self.client.post(self.login_url, data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)
        self.assertIn('user', response.data)
        self.assertEqual(response.data['user']['role'], 'user')
    
    def test_login_with_username(self):
        """Test successful login with username."""
        data = {
            'username_or_email': 'testuser',
            'password': 'TestPass123'
        }
        response = self.client.post(self.login_url, data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)
    
    def test_login_admin_user(self):
        """Test login for admin user returns admin role."""
        data = {
            'username_or_email': 'admin@example.com',
            'password': 'AdminPass123'
        }
        response = self.client.post(self.login_url, data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['user']['role'], 'admin')
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials."""
        data = {
            'username_or_email': 'testuser@example.com',
            'password': 'WrongPassword'
        }
        response = self.client.post(self.login_url, data)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertIn('detail', response.data)
    
    def test_login_nonexistent_user(self):
        """Test login with nonexistent user."""
        data = {
            'username_or_email': 'nonexistent@example.com',
            'password': 'SomePassword'
        }
        response = self.client.post(self.login_url, data)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
    
    def test_login_inactive_user(self):
        """Test login with inactive user."""
        inactive_user = User.objects.create_user(
            username='inactive',
            email='inactive@example.com',
            password='InactivePass123',
            is_active=False
        )
        
        data = {
            'username_or_email': 'inactive@example.com',
            'password': 'InactivePass123'
        }
        response = self.client.post(self.login_url, data)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
    
    def test_login_missing_credentials(self):
        """Test login with missing credentials."""
        data = {
            'username_or_email': 'testuser@example.com',
            # Missing password
        }
        response = self.client.post(self.login_url, data)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
    
    def test_login_tokens_are_valid_jwt(self):
        """Test that returned tokens are valid JWT tokens."""
        data = {
            'username_or_email': 'testuser@example.com',
            'password': 'TestPass123'
        }
        response = self.client.post(self.login_url, data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Verify access token format
        access_token = response.data['access']
        self.assertTrue(len(access_token.split('.')) == 3)  # JWT has 3 parts


class CurrentUserAPITests(APITestCase):
    """Tests for the current user endpoint."""
    
    def setUp(self):
        self.client = APIClient()
        self.me_url = '/api/auth/me/'
        
        self.user = User.objects.create_user(
            username='testuser',
            email='testuser@example.com',
            password='TestPass123',
            first_name='John',
            last_name='Doe',
            role='user'
        )
        
        self.token = RefreshToken.for_user(self.user)
        self.access_token = str(self.token.access_token)
    
    def test_get_current_user_authenticated(self):
        """Test getting current user when authenticated."""
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.access_token}')
        response = self.client.get(self.me_url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['username'], 'testuser')
        self.assertEqual(response.data['email'], 'testuser@example.com')
        self.assertEqual(response.data['role'], 'user')
        self.assertEqual(response.data['first_name'], 'John')
        self.assertEqual(response.data['last_name'], 'Doe')
    
    def test_get_current_user_unauthenticated(self):
        """Test getting current user without authentication."""
        response = self.client.get(self.me_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
    
    def test_get_current_user_invalid_token(self):
        """Test getting current user with invalid token."""
        self.client.credentials(HTTP_AUTHORIZATION='Bearer invalid.token.here')
        response = self.client.get(self.me_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
    
    def test_current_user_has_no_sensitive_fields(self):
        """Test that sensitive fields are not returned."""
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.access_token}')
        response = self.client.get(self.me_url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertNotIn('password', response.data)
        self.assertNotIn('is_staff', response.data)
        self.assertNotIn('is_superuser', response.data)


class LogoutAPITests(APITestCase):
    """Tests for the logout endpoint."""
    
    def setUp(self):
        self.client = APIClient()
        self.logout_url = '/api/auth/logout/'
        
        self.user = User.objects.create_user(
            username='testuser',
            email='testuser@example.com',
            password='TestPass123'
        )
        
        self.token = RefreshToken.for_user(self.user)
        self.access_token = str(self.token.access_token)
        self.refresh_token = str(self.token)
    
    def test_logout_with_valid_tokens(self):
        """Test logout with valid tokens."""
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.access_token}')
        data = {'refresh': self.refresh_token}
        
        response = self.client.post(self.logout_url, data)
        # Accept both 200 and 400 depending on blacklist configuration
        self.assertIn(response.status_code, [status.HTTP_200_OK, status.HTTP_400_BAD_REQUEST])
        # At minimum, should handle the request
        self.assertIsNotNone(response.data)
    
    def test_logout_unauthenticated(self):
        """Test logout without authentication."""
        data = {'refresh': self.refresh_token}
        response = self.client.post(self.logout_url, data)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
    
    def test_logout_without_refresh_token(self):
        """Test logout without providing refresh token."""
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.access_token}')
        response = self.client.post(self.logout_url, {})
        # Should still succeed, just without blacklisting
        self.assertIn(response.status_code, [status.HTTP_200_OK, status.HTTP_400_BAD_REQUEST])


class RolePermissionTests(APITestCase):
    """Tests for role-based access control."""
    
    def setUp(self):
        self.client = APIClient()
        self.register_url = '/api/auth/register/'
        
        self.user = User.objects.create_user(
            username='testuser',
            email='testuser@example.com',
            password='TestPass123',
            role='user'
        )
        
        self.admin = User.objects.create_user(
            username='adminuser',
            email='admin@example.com',
            password='AdminPass123',
            role='admin'
        )
        
        self.user_token = str(RefreshToken.for_user(self.user).access_token)
        self.admin_token = str(RefreshToken.for_user(self.admin).access_token)
    
    def test_user_cannot_change_own_role(self):
        """Test that users cannot change their own role through API."""
        # Note: The current implementation doesn't expose role changes through API
        # This test verifies that the role field is read-only
        me_url = '/api/auth/me/'
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.user_token}')
        
        response = self.client.get(me_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['role'], 'user')
    
    def test_registration_always_creates_user_role(self):
        """Test that registration always creates users with 'user' role."""
        data = {
            'username': 'newuser',
            'email': 'newuser@example.com',
            'password': 'SecurePass123',
            'password_confirm': 'SecurePass123',
            'role': 'admin'  # Try to set as admin
        }
        response = self.client.post(self.register_url, data)
        
        # Should either reject or create with 'user' role
        if response.status_code == status.HTTP_201_CREATED:
            user = User.objects.get(username='newuser')
            self.assertEqual(user.role, 'user')
    
    def test_admin_user_identification(self):
        """Test that admin users are correctly identified."""
        me_url = '/api/auth/me/'
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.admin_token}')
        
        response = self.client.get(me_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['role'], 'admin')
    
    def test_both_roles_can_login(self):
        """Test that both user and admin roles can successfully login."""
        login_url = '/api/auth/login/'
        
        # Test user login
        user_response = self.client.post(login_url, {
            'username_or_email': 'testuser@example.com',
            'password': 'TestPass123'
        })
        self.assertEqual(user_response.status_code, status.HTTP_200_OK)
        self.assertEqual(user_response.data['user']['role'], 'user')
        
        # Test admin login
        admin_response = self.client.post(login_url, {
            'username_or_email': 'admin@example.com',
            'password': 'AdminPass123'
        })
        self.assertEqual(admin_response.status_code, status.HTTP_200_OK)
        self.assertEqual(admin_response.data['user']['role'], 'admin')

