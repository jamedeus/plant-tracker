import os
import sys
from django.conf import settings
from django.apps import AppConfig
from django.core.cache import caches
from django.utils.autoreload import autoreload_started


class PlantTrackerConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "plant_tracker"

    def ready(self):
        '''Rebuild all cached state objects when the server starts.
        Prevents serving outdated cached state if database was modified offline.
        '''
        if 'test' in sys.argv or 'pylint' in str(sys.argv):
            # Skip cache updates when running unit tests or pylint
            return

        if 'manage.py' in sys.argv[0] and 'runserver' not in sys.argv:
            # Skip cache updates when running management commands
            return

        if 'celery' in sys.argv[0]:
            # Skip cache updates when starting celery worker
            return

        # Prevent cache update running for each gunicorn worker
        # Sets cache key that expires in 30 seconds, only runs if not set
        if not caches["default"].get('startup_update_cached_states'):
            caches["default"].set('startup_update_cached_states', 1, 30)
            from .tasks import update_all_cached_states
            update_all_cached_states.delay()
