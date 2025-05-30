import os
import shutil
from concurrent.futures import ProcessPoolExecutor, as_completed

from django.core.management.base import BaseCommand
from django.db import close_old_connections
from django.conf import settings
from plant_tracker.models import Photo


def delete_existing_photo_thumbnails_and_previews():
    '''Deletes all existing photo thumbnails and previews from disk.'''
    thumbnails = os.path.join(settings.MEDIA_ROOT, 'thumbnails')
    if os.path.isdir(thumbnails):
        shutil.rmtree(thumbnails)
    previews = os.path.join(settings.MEDIA_ROOT, 'previews')
    if os.path.isdir(previews):
        shutil.rmtree(previews)


def worker_regenerate(pk: int) -> int:
    '''Takes existing photo primary key, regenerates thumbnail and preview.'''
    close_old_connections()

    # Overwrite thumbnail and preview so save method will regenerate them
    photo = Photo.objects.get(pk=pk)
    photo.thumbnail = None
    photo.preview = None
    photo.save(update_fields=['thumbnail', 'preview'])
    return pk


class Command(BaseCommand):
    help = "Delete all photo thumbnails and previews, regenerate in parallel"

    def handle(self, *args, **options):
        # Delete all existing thumbnails and previews from disk
        delete_existing_photo_thumbnails_and_previews()

        # Get list of all photo primary keys
        pks = list(Photo.objects.values_list('pk', flat=True))
        cpu_count = os.cpu_count() or 1

        self.stdout.write(
            f"\nregenerating {len(pks)} thumbnails on {cpu_count} cores...\n"
        )

        # close the connection in the main process before forking
        close_old_connections()

        with ProcessPoolExecutor(max_workers=cpu_count) as pool:
            # chunksize helps amortize IPC overhead
            futures = {
                pool.submit(worker_regenerate, pk): pk
                for pk in pks
            }

            for future in as_completed(futures):
                pk = futures[future]
                try:
                    future.result()
                    self.stdout.write(f"Finished: {pk}")
                except Exception as e:
                    self.stderr.write(f"FAILED: {pk} ({e!r})")

        self.stdout.write(self.style.SUCCESS("All thumbnails regenerated"))
