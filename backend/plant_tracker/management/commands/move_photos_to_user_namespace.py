'''Command to move photos from data/images/[images||previews||thumbnails]
(old layout) to data/user_*/[images||previews||thumbnails] (new layout).

Assumes all photos are stored in local storage (not S3).

New layout allows using cloudfront signed cookies to give access to an entire
user namespace without exposing other user's photos or relying on expiring
querystring auth.
'''

import os

from django.db import transaction
from django.core.management.base import BaseCommand

from plant_tracker.models import Photo


class Command(BaseCommand):
    help = "Move all existing photos into user namespace subdirectories."

    def handle(self, *args, **options):
        for photo in Photo.objects.select_related("plant"):
            # Create user namespace directory if it doesn't exist
            user_dir = os.path.join('data', 'images', f"user_{photo.plant.user.pk}")
            if not os.path.exists(user_dir):
                os.makedirs(os.path.join(user_dir, 'images'))
                os.makedirs(os.path.join(user_dir, 'previews'))
                os.makedirs(os.path.join(user_dir, 'thumbnails'))

            with transaction.atomic():
                # Move all 3 resolutions
                for attr in ("photo", "preview", "thumbnail"):
                    field = getattr(photo, attr)
                    subdir, filename = field.name.split("/")
                    new_name = f"user_{photo.plant.user.pk}/{subdir}/{filename}"
                    os.rename(
                        field.path,
                        field.storage.path(new_name)
                    )
                    setattr(photo, attr, new_name)
                photo.save(update_fields=["photo", "preview", "thumbnail"])

            self.stdout.write(
                self.style.SUCCESS(f"moved photo {photo.pk}")
            )
        self.stdout.write(self.style.SUCCESS("\nDone"))
