import os
import sys
from django.conf import settings
from django.apps import AppConfig
from django.contrib.auth import get_user_model


class PlantTrackerConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "plant_tracker"

    def ready(self):
        '''Rebuild all cached state objects when the server starts
        Prevents serving outdated cached state if database was modified offline
        '''
        # if 'test' in sys.argv or 'pylint' in str(sys.argv):
        #     # Skip cache updates when running unit tests or pylint
        #     return
        # if not os.environ.get('RUN_MAIN'):
        #     # Prevent running when celery starts, running twice when dev server
        #     # starts (dev server starts second process to detect file changes)
        #     return

        # from .tasks import update_all_cached_states
        # update_all_cached_states.delay()

        # If SINGLE_USER_MODE enabled make sure default user exists
        if settings.SINGLE_USER_MODE:
            User = get_user_model()
            if not User.objects.filter(username=settings.DEFAULT_USERNAME).exists():
                User.objects.create_user(
                    username=settings.DEFAULT_USERNAME,
                    password='root'
                )
