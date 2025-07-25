"""
Django settings for backend project.

Generated by 'django-admin startproject' using Django 5.0.1.

For more information on this file, see
https://docs.djangoproject.com/en/5.0/topics/settings/

For the full list of settings and their values, see
https://docs.djangoproject.com/en/5.0/ref/settings/
"""

import os
import sys
import json
from pathlib import Path
from django.core.exceptions import ImproperlyConfigured
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

# Redirect to overview page after successful login
LOGIN_REDIRECT_URL="/"

# Read SINGLE_USER_MODE from env var, or default to False if not present
# If True authentication is disabled, all plants are owned by DEFAULT_USERNAME
# If False authentication is required, separate accounts own separate plants
SINGLE_USER_MODE = os.environ.get('SINGLE_USER_MODE', '').lower() == 'true'
DEFAULT_USERNAME='DEFAULT'

# Read photo thumbnail/preview resolution and quality env vars, or use defaults
try:
    px = int(os.environ.get('THUMBNAIL_RESOLUTION', 200))
    THUMBNAIL_RESOLUTION = (px, px)
except ValueError as exc:
    raise ImproperlyConfigured('THUMBNAIL_RESOLUTION must be an integer') from exc
try:
    THUMBNAIL_QUALITY = int(os.environ.get('THUMBNAIL_QUALITY', 65))
except ValueError as exc:
    raise ImproperlyConfigured('THUMBNAIL_QUALITY must be an integer') from exc
try:
    px = int(os.environ.get('PREVIEW_RESOLUTION', 800))
    PREVIEW_RESOLUTION = (px, px)
except ValueError as exc:
    raise ImproperlyConfigured('PREVIEW_RESOLUTION must be an integer') from exc
try:
    PREVIEW_QUALITY = int(os.environ.get('PREVIEW_QUALITY', 80))
except ValueError as exc:
    raise ImproperlyConfigured('PREVIEW_QUALITY must be an integer') from exc

# SECURITY WARNING: don't run with debug turned on in production!
# Disable debug unless env var set
DEBUG = bool(os.environ.get('DEBUG_MODE', 0))
# User-configurable debug tool (django-debug-toolbar or silk, default to silk)
DEBUG_TOOL = os.environ.get('DEBUG_TOOL', 'silk')

# Disable non-SSL connections (except in debug mode)
if not DEBUG:
    # Only send cookies with SSL
    CSRF_COOKIE_SECURE = True
    SESSION_COOKIE_SECURE = True
    # Block all non-https requests (1 year expiration time)
    SECURE_HSTS_PRELOAD = True
    SECURE_HSTS_SECONDS = 3600
    # SECURE_HSTS_SECONDS = 31536000
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    # Prevent browsers guessing content type (eg user uploads malicious JS as
    # photo, browser sees contents and tries to execute it)
    SECURE_CONTENT_TYPE_NOSNIFF = True

# Running tests or pylint
TESTING = 'test' in sys.argv or 'pylint' in str(sys.argv)

# Application definition

INSTALLED_APPS = [
    "plant_tracker.apps.PlantTrackerConfig",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Enforce unique constraint on user email field
    "unique_user_email"
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

# Use cached sessions (fallback to database if session no longer in redis)
SESSION_ENGINE = "django.contrib.sessions.backends.cached_db"

# Add debug tools in debug mode
if DEBUG and not TESTING:
    # Add django-debug-toolbar if env var set
    if DEBUG_TOOL.lower() in ("toolbar", "debug_toolbar"):
        INSTALLED_APPS.append("debug_toolbar")
        MIDDLEWARE.append("debug_toolbar.middleware.DebugToolbarMiddleware")
        # Make it work on all IPs (won't work in docker dev setup otherwise)
        DEBUG_TOOLBAR_CONFIG = {
            'SHOW_TOOLBAR_CALLBACK': lambda request: True,
        }
    # Otherwise add django-silk
    else:
        INSTALLED_APPS.append("silk")
        MIDDLEWARE.append("silk.middleware.SilkyMiddleware")

ROOT_URLCONF = "backend.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [ BASE_DIR / 'templates' ],
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

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.environ.get('DATABASE_NAME', "plant_tracker"),
        "USER": os.environ.get('DATABASE_USER', "postgres"),
        "PASSWORD": os.environ.get('DATABASE_PASSWORD'),
        "HOST": os.environ.get('DATABASE_HOST', "127.0.0.1"),
        "PORT": os.environ.get('DATABASE_PORT', "5432"),
    }
}

# Use redis cache (shared with celery)
REDIS_HOST = os.environ.get('REDIS_HOST', "127.0.0.1")
REDIS_PORT = os.environ.get('REDIS_PORT', "6379")
CACHES = {
    "default": {
        "BACKEND": "django_redis.cache.RedisCache",
        "LOCATION": f"redis://{REDIS_HOST}:{REDIS_PORT}/1",
        "OPTIONS": {
            "CLIENT_CLASS": "django_redis.client.DefaultClient",
        }
    }
}

# Celery settings
CELERY_BROKER_URL = f"redis://{REDIS_HOST}:{REDIS_PORT}"
CELERY_RESULT_BACKEND = f"redis://{REDIS_HOST}:{REDIS_PORT}"
CELERY_BROKER_CONNECTION_RETRY_ON_STARTUP = True

# Serve files from local media root if any required AWS S3 env vars are missing
LOCAL_MEDIA_ROOT = not all(
    var in os.environ
    for var in [
        "AWS_ACCESS_KEY_ID",
        "AWS_SECRET_ACCESS_KEY",
        "AWS_STORAGE_BUCKET_NAME",
        "AWS_S3_REGION_NAME",
        "THUMBNAIL_CDN_DOMAIN",
    ]
)

# Local media root settings
if LOCAL_MEDIA_ROOT:
    # Create data directory if it doesn't exist
    if not os.path.isdir(os.path.join(BASE_DIR, 'data')):
        os.mkdir(os.path.join(BASE_DIR, 'data'))

    # Create image storage directory if it doesn't exist
    if not os.path.isdir(os.path.join(BASE_DIR, 'data', 'images')):
        os.mkdir(os.path.join(BASE_DIR, 'data', 'images'))

    # Set image storage directory and URL
    MEDIA_ROOT = os.path.join(BASE_DIR, 'data', 'images')
    MEDIA_URL = "/media/"

    STORAGES = {
        # Full-resolution and preview resolution photos
        "default": {
            "BACKEND": "django.core.files.storage.FileSystemStorage",
            "OPTIONS": {
                "location": MEDIA_ROOT,
                "base_url": MEDIA_URL,
            },
        },
        # Photo thumbnails
        "public": {
            "BACKEND": "django.core.files.storage.FileSystemStorage",
            "OPTIONS": {
                "location": MEDIA_ROOT,
                "base_url": MEDIA_URL,
            },
        },
        "staticfiles": {
            "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
        },
    }

# AWS S3 settings
else:
    # Read AWS settings from env vars
    AWS_ACCESS_KEY_ID = os.environ.get("AWS_ACCESS_KEY_ID")
    AWS_SECRET_ACCESS_KEY = os.environ.get("AWS_SECRET_ACCESS_KEY")
    AWS_STORAGE_BUCKET_NAME = os.environ.get("AWS_STORAGE_BUCKET_NAME")
    AWS_S3_REGION_NAME = os.environ.get("AWS_S3_REGION_NAME")
    THUMBNAIL_CDN_DOMAIN = os.environ.get("THUMBNAIL_CDN_DOMAIN")

    STORAGES = {
        # Full-resolution and preview resolution photos (requires signed URLs)
        "default": {
            "BACKEND": "storages.backends.s3.S3Storage",
            "OPTIONS": {
                "bucket_name": AWS_STORAGE_BUCKET_NAME,
                "region_name": AWS_S3_REGION_NAME,
                # Require signed URLs, grant access for 2 hours (full-res URLs
                # aren't requested until gallery opened which could be a while)
                "querystring_auth": True,
                "querystring_expire": 7200,
            },
        },
        # Photo thumbnails (publicly accessible)
        "public": {
            "BACKEND": "storages.backends.s3.S3Storage",
            "OPTIONS": {
                "bucket_name": AWS_STORAGE_BUCKET_NAME,
                "region_name": AWS_S3_REGION_NAME,
                "custom_domain": THUMBNAIL_CDN_DOMAIN,
                "querystring_auth": False,
                # Cache up to 30 days
                "object_parameters": {
                    "CacheControl": "public,max-age=2592000,immutable"
                },
            },
        },
        "staticfiles": {
            "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
        },
    }

    # Set base URL used to build photo URLs
    MEDIA_URL = f"https://{AWS_STORAGE_BUCKET_NAME}.s3.{AWS_S3_REGION_NAME}.amazonaws.com/"

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

# Allow logging in with username or email
AUTHENTICATION_BACKENDS = [
    "unique_user_email.backend.EmailBackend",
    "django.contrib.auth.backends.ModelBackend",
]

# Internationalization
# https://docs.djangoproject.com/en/5.0/topics/i18n/

LANGUAGE_CODE = "en-us"

TIME_ZONE = "UTC"

USE_I18N = True

USE_TZ = True


# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/5.0/howto/static-files/

# Serve static files from CDN if configured
STATIC_HOST = os.environ.get("DJANGO_STATIC_HOST", "")

STATIC_URL = STATIC_HOST + "/static/"

STATIC_ROOT = BASE_DIR / "staticfiles"

# Read webpack manifest.json from static directory
MANIFEST_PATH = Path(BASE_DIR, 'plant_tracker/static/plant_tracker/manifest.json')
try:
    with open(MANIFEST_PATH, 'r', encoding='utf-8' ) as file:
        MANIFEST = json.load(file)
except FileNotFoundError:
    MANIFEST = {}

# Build mapping dict with page names as keys, static dependencies as values
PAGE_DEPENDENCIES = {
    page_name: {
        "js": [f for f in dependencies if f.endswith('.js')],
        "css": [f for f in dependencies if f.endswith('.css')]
    } for page_name, dependencies in MANIFEST.items()
}

# Default primary key field type
# https://docs.djangoproject.com/en/5.0/ref/settings/#default-auto-field

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
