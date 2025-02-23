"""
Django settings for backend project.

Generated by 'django-admin startproject' using Django 5.0.1.

For more information on this file, see
https://docs.djangoproject.com/en/5.0/topics/settings/

For the full list of settings and their values, see
https://docs.djangoproject.com/en/5.0/ref/settings/
"""

import os
from pathlib import Path
from django.core.management.utils import get_random_secret_key

from .validate_url_prefix import validate_url_prefix

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# Quick-start development settings - unsuitable for production
# See https://docs.djangoproject.com/en/5.0/howto/deployment/checklist/

# Read SECRET_KEY from env var, or generate new key if not present
SECRET_KEY = os.environ.get('SECRET_KEY')
if SECRET_KEY is None:
    SECRET_KEY = get_random_secret_key()

# Read ALLOWED_HOSTS from env var, or use wildcard if not present
try:
    ALLOWED_HOSTS = os.environ.get('ALLOWED_HOSTS').split(',')
except AttributeError:
    ALLOWED_HOSTS = ['*']

# Add all allowed hosts to CSRF_TRUSTED_ORIGINS
CSRF_TRUSTED_ORIGINS = []
for i in ALLOWED_HOSTS:
    CSRF_TRUSTED_ORIGINS.append(f'http://{i}')
    CSRF_TRUSTED_ORIGINS.append(f'https://{i}')

# Get URL prefix used to generate QR code stickers from env var
URL_PREFIX = validate_url_prefix(os.environ.get('URL_PREFIX'))


# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = True

# Application definition

INSTALLED_APPS = [
    "plant_tracker.apps.PlantTrackerConfig",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "backend.urls"

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

WSGI_APPLICATION = "backend.wsgi.application"


# Database
# https://docs.djangoproject.com/en/5.0/ref/settings/#databases

# Create data directory if it doesn't exist
if not os.path.isdir(os.path.join(BASE_DIR, 'data')):
    os.mkdir(os.path.join(BASE_DIR, 'data'))

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": os.path.join(BASE_DIR, 'data', 'db.sqlite3'),
    }
}

# Create image storage directory if it doesn't exist
if not os.path.isdir(os.path.join(BASE_DIR, 'data', 'images')):
    os.mkdir(os.path.join(BASE_DIR, 'data', 'images'))

# Set image storage directory and URL
MEDIA_ROOT = os.path.join(BASE_DIR, 'data', 'images')
MEDIA_URL = "media/"

# Use redis cache (shared with celery)
CACHES = {
    "default": {
        "BACKEND": "django_redis.cache.RedisCache",
        "LOCATION": "redis://127.0.0.1:6379/1",
        "OPTIONS": {
            "CLIENT_CLASS": "django_redis.client.DefaultClient",
        }
    }
}

# Password validation
# https://docs.djangoproject.com/en/5.0/ref/settings/#auth-password-validators

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
# https://docs.djangoproject.com/en/5.0/topics/i18n/

LANGUAGE_CODE = "en-us"

TIME_ZONE = "UTC"

USE_I18N = True

USE_TZ = True


# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/5.0/howto/static-files/

STATIC_URL = "static/"

# Default primary key field type
# https://docs.djangoproject.com/en/5.0/ref/settings/#default-auto-field

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Celery settings
CELERY_BROKER_URL = "redis://localhost:6379"
CELERY_RESULT_BACKEND = "redis://localhost:6379"
CELERY_BROKER_CONNECTION_RETRY_ON_STARTUP = True
