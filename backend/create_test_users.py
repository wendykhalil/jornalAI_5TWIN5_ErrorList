import django
import os

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth import get_user_model

User = get_user_model()

# Create test users
user1, created = User.objects.get_or_create(
    username='testuser',
    defaults={'email': 'testuser@example.com', 'role': 'user', 'is_active': True}
)
if created:
    user1.set_password('testpass123')
    user1.save()
    print(f"Created user: {user1.username}")
else:
    print(f"User already exists: {user1.username}")

user2, created = User.objects.get_or_create(
    username='testadmin',
    defaults={'email': 'testadmin@example.com', 'role': 'user', 'is_active': True}
)
if created:
    user2.set_password('adminpass123')
    user2.save()
    print(f"Created user: {user2.username}")
else:
    print(f"User already exists: {user2.username}")

print(f"\nUser 1: {user1.username} - Role: {user1.role}")
print(f"User 2: {user2.username} - Role: {user2.role}")
