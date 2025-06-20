import os

from django.core.management.base import BaseCommand
from django.conf import settings
from plant_tracker.models import Photo


def delete_orphan_photos(field_name, subdir):
    '''Takes Photo model ImageField name (photo, thumbnail, or preview) and
    MEDIA_ROOT subdir (images, thumbnails, or previews) and deletes all photos
    in subdir that are not associated with a Photo model entry.
    '''
    print(f"\nSearching {subdir} for orphan photos...")
    for filename in os.listdir(os.path.join(settings.MEDIA_ROOT, subdir)):
        try:
            Photo.objects.get(**{field_name: os.path.join(subdir, filename)})
        except Photo.DoesNotExist:
            path = os.path.join(settings.MEDIA_ROOT, subdir, filename)
            print(f"  Deleting {path}")
            os.remove(path)


class Command(BaseCommand):
    help = "Delete all photos from disk that are not associated with a Photo entry"

    def handle(self, *args, **options):
        delete_orphan_photos('photo', 'images')
        delete_orphan_photos('thumbnail', 'thumbnails')
        delete_orphan_photos('preview', 'previews')
        self.stdout.write(self.style.SUCCESS("\nDone!"))
