'''Django settings used for unit testing and frontend development.

Runs celery tasks synchronously (no delay) and uses local memory caching
instead of redis (redis does not need to be installed or running).

Should not be used for backend development (behaves differently).
'''

# pylint: disable=wildcard-import, unused-wildcard-import

import os
from .settings import *

# Override cache to use fake redis client (does not require actual server,
# won't leave keys or overwrite stuff in development redis store)
CACHES = {
    "default": {
        "BACKEND": "django_redis.cache.RedisCache",
        "LOCATION": "redis://127.0.0.1:9999/1",
        "OPTIONS": {
            "CLIENT_CLASS": "plant_tracker.fake_redis_client.FakeRedisClient",
        }
    }
}
CELERY_BROKER_URL = 'memory://'
CELERY_RESULT_BACKEND = 'cache+memory://'

# Run celery tasks locally (no celery worker or message broker)
CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True

# Temp directory for mock photo uploads, deleted after tests
TEST_DIR = '/tmp/plant_tracker_unit_test'

# Mock photo uploads dir to temp directory deleted after tests
MEDIA_ROOT = os.path.join(TEST_DIR, 'data', 'images')
MEDIA_URL = "/media/"

# Override main settings.py
STORAGES = {
    # Use temp directory configured above
    "default": {
        "BACKEND": "django.core.files.storage.FileSystemStorage",
        "OPTIONS": {
            "location": MEDIA_ROOT,
            "base_url": MEDIA_URL,
        },
    },
    # Disable whitenoise (static files don't exist in CI/CD)
    "staticfiles": {
        "BACKEND": "django.core.files.storage.FileSystemStorage",
    },
}

# Use SINGLE_USER_MODE (disables authentication, can be overridden by tests)
SINGLE_USER_MODE=True
DEFAULT_USERNAME='DEFAULT'

# Mock value for settings.PAGE_DEPENDENCIES (built from webpack manifest.json,
# does not exist in docker CI/CD environment). This may diverge from production
# as code splitting changes but that shouldn't matter; the important thing for
# tests is that render_react_app context includes all files from this.
PAGE_DEPENDENCIES = {
    "login": {
        "js": [
            "react-common.js",
            "login.js"
        ],
        "css": [
            "shared.css"
        ]
    },
    "user_profile": {
        "js": [
            "react-common.js",
            "user_profile.js"
        ],
        "css": [
            "shared.css"
        ]
    },
    "overview": {
        "js": [
            "react-common.js",
            "overview.js"
        ],
        "css": [
            "shared.css"
        ]
    },
    "register": {
        "js": [
            "react-common.js",
            "register.js"
        ],
        "css": [
            "shared.css"
        ]
    },
    "manage_plant": {
        "js": [
            "react-common.js",
            "manage_plant.js"
        ],
        "css": [
            "shared.css",
            "manage_plant.css"
        ]
    },
    "manage_group": {
        "js": [
            "react-common.js",
            "manage_group.js"
        ],
        "css": [
            "shared.css"
        ]
    },
    "password_reset": {
        "js": [
            "icons.js",
            "react-common.js",
            "libs.js",
            "password_reset.js"
        ],
        "css": [
            "shared.css"
        ]
    },
    "permission_denied": {
        "js": [
            "react-common.js",
            "permission_denied.js"
        ],
        "css": [
            "shared.css"
        ]
    },
    "confirm_new_qr_code": {
        "js": [
            "react-common.js",
            "confirm_new_qr_code.js"
        ],
        "css": [
            "shared.css"
        ]
    }
}
