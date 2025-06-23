import os
import sys
from django.apps import AppConfig


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
        if not os.environ.get('RUN_MAIN'):
            # Prevent running when celery starts, running twice when dev server
            # starts (dev server starts second process to detect file changes)
            return

        # from .tasks import update_all_cached_states
        # update_all_cached_states.delay()
