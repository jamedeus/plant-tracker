import os
import sys
from django.conf import settings
from django.apps import AppConfig
from django.utils.autoreload import autoreload_started


def watch_manifest(sender, **kwargs):
    '''Watch manifest.json and restart the dev server when it changes.

    The backend reads manifest.json at startup serves the static files it lists
    for each page. If a new static file is created by webpack the dev server
    needs to read manifest.json again or it won't serve the new file.
    '''
    if os.path.exists(settings.MANIFEST_PATH):
        sender.watch_dir(settings.MANIFEST_PATH.parent, "manifest.json")


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

        from .tasks import update_all_cached_states
        update_all_cached_states.delay()

        # Reload dev server when manifest.json changes
        if settings.DEBUG:
            autoreload_started.connect(watch_manifest)
