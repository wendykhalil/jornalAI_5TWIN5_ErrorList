
"""
Django settings for config project.
"""

import os
from pathlib import Path

from dotenv import load_dotenv


# Base directory
BASE_DIR = Path(__file__).resolve().parent.parent

# Load environment variables from .env
load_dotenv(BASE_DIR / ".env")

# Security
SECRET_KEY = os.getenv(
    "DJANGO_SECRET_KEY",
    "django-insecure-dev-key-change-before-production",
)

DEBUG = os.getenv("DJANGO_DEBUG", "False").lower() == "true"

_default_hosts = (
    "127.0.0.1,localhost,mindlog-ai.swedencentral.cloudapp.azure.com,20.240.53.98"
)
ALLOWED_HOSTS = [
    host.strip()
    for host in os.getenv("DJANGO_ALLOWED_HOSTS", _default_hosts).split(",")
    if host.strip()
]

# Applications
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework_simplejwt.token_blacklist",

    # Jornal AI applications
    "apps.users",
    "apps.journal",
    "apps.mood",
    "apps.media",
    "apps.memories",
    "apps.goals",
    
    # Third-party
    "rest_framework",
    "corsheaders",
    "rest_framework_simplejwt",
]

# Middleware
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",  # Add CORS before common middleware
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

# Templates
TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

# Database: MySQL / MariaDB (XAMPP)
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.mysql",
        "NAME": os.getenv("DB_NAME", "jornal_ai"),
        "USER": os.getenv("DB_USER", "root"),
        "PASSWORD": os.getenv("DB_PASSWORD", ""),
        "HOST": os.getenv("DB_HOST", "127.0.0.1"),
        "PORT": os.getenv("DB_PORT", "3306"),
        "OPTIONS": {
            "charset": "utf8mb4",
            "init_command": "SET sql_mode='STRICT_TRANS_TABLES'",
        },
    }
}

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.CommonPasswordValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.NumericPasswordValidator",
    },
]

# Internationalization
LANGUAGE_CODE = "en-us"
TIME_ZONE = "Africa/Tunis"
USE_I18N = True
USE_TZ = True

# Static files
STATIC_URL = "static/"
STATIC_ROOT = os.path.join(BASE_DIR, "staticfiles")

# Media files (user uploads)
MEDIA_URL = "/media/"
MEDIA_ROOT = os.path.join(BASE_DIR, "media")

# Default primary key field type
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Custom User Model
AUTH_USER_MODEL = "users.User"

# Django REST Framework Configuration
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
}

# SimpleJWT Configuration
from datetime import timedelta

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(hours=1),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "ALGORITHM": "HS256",
    "SIGNING_KEY": SECRET_KEY,
    "VERIFYING_KEY": None,
    "AUTH_HEADER_TYPES": ("Bearer",),
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",
    "AUTH_TOKEN_CLASSES": ("rest_framework_simplejwt.tokens.AccessToken",),
    "TOKEN_TYPE_CLAIM": "token_type",
}

# CORS Configuration for frontend integration
_raw_cors = os.getenv("CORS_ALLOWED_ORIGINS")
if _raw_cors:
    CORS_ALLOWED_ORIGINS = [
        origin.strip() for origin in _raw_cors.split(",") if origin.strip()
    ]
else:
    CORS_ALLOWED_ORIGINS = [
        "https://mindlog-ai.swedencentral.cloudapp.azure.com",
        "http://mindlog-ai.swedencentral.cloudapp.azure.com",
        "https://20.240.53.98",
        "http://20.240.53.98",
        "http://localhost:8443",
        "http://localhost:5173",
        "http://127.0.0.1:8443",
        "http://127.0.0.1:5173",
        "http://192.168.1.179:8443",
    ]

CORS_ALLOW_CREDENTIALS = True

# CSRF Trusted Origins (required for requests through reverse proxy)
_raw_csrf = os.getenv("CSRF_TRUSTED_ORIGINS")
if _raw_csrf:
    CSRF_TRUSTED_ORIGINS = [
        origin.strip() for origin in _raw_csrf.split(",") if origin.strip()
    ]
else:
    CSRF_TRUSTED_ORIGINS = [
        "https://mindlog-ai.swedencentral.cloudapp.azure.com",
        "http://mindlog-ai.swedencentral.cloudapp.azure.com",
        "https://20.240.53.98",
        "http://20.240.53.98",
        "http://localhost:8443",
        "http://localhost:5173",
        "http://127.0.0.1:8443",
        "http://127.0.0.1:5173",
    ]

# Reverse Proxy SSL Header
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

# Nginx X-Accel-Redirect for high-speed authenticated private media streaming
USE_X_ACCEL_REDIRECT = os.getenv("USE_X_ACCEL_REDIRECT", "False").lower() == "true"

# Production Security Headers (when DEBUG=False)
if not DEBUG:
    SESSION_COOKIE_SECURE = (
        os.getenv("SESSION_COOKIE_SECURE", "True").lower() == "true"
    )
    CSRF_COOKIE_SECURE = (
        os.getenv("CSRF_COOKIE_SECURE", "True").lower() == "true"
    )
    SECURE_BROWSER_XSS_FILTER = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    X_FRAME_OPTIONS = "DENY"
