from django.db import models
from django.contrib.auth.models import AbstractUser


class User(AbstractUser):
    """
    Custom user model extending Django's AbstractUser with role-based access control.
    
    Roles:
    - 'user': Regular application user (default for public registration)
    - 'admin': Administrator with access to admin features
    
    Note: Application roles are distinct from Django's is_staff and is_superuser flags.
    Roles control access to application features through the REST API.
    """
    
    ROLE_CHOICES = [
        ('user', 'Regular User'),
        ('admin', 'Administrator'),
    ]
    
    email = models.EmailField(unique=True)  # Override to make truly unique
    
    role = models.CharField(
        max_length=10,
        choices=ROLE_CHOICES,
        default='user',
        help_text='Application-level role for feature access control'
    )
    
    class Meta:
        ordering = ['-date_joined']
        indexes = [
            models.Index(fields=['email']),
            models.Index(fields=['role']),
        ]
    
    def __str__(self):
        return f"{self.username} ({self.get_role_display()})"
    
    def is_admin(self):
        """Check if user has admin role."""
        return self.role == 'admin'
