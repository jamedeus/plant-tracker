'''Django settings used for unit testing and frontend development.

Runs celery tasks synchronously (no delay) and uses local memory caching
instead of redis (redis does not need to be installed or running).

Should not be used for backend development (behaves differently).
'''

# pylint: disable=wildcard-import, unused-wildcard-import

import os
from .settings import *

# Override cache to local memory cache instead of redis
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache"
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
