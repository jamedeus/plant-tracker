'''Django database models'''

from io import BytesIO
from typing import TYPE_CHECKING
from datetime import datetime, timezone

import piexif
from PIL import Image, ImageOps
from pillow_heif import register_heif_opener
from django.db import models
from django.conf import settings
from django.dispatch import receiver
from django.db.models.signals import post_delete
from django.utils import timezone as django_timezone
from django.core.files.uploadedfile import InMemoryUploadedFile

if TYPE_CHECKING:  # pragma: no cover
    from .plant import Plant

# Timestamp format used to print DateTimeFields, parse exif into datetime, etc.
TIME_FORMAT = '%Y:%m:%d %H:%M:%S'

# HEIC image support
register_heif_opener()


def user_image_path(instance, filename):
    '''Returns path to original image in user namespace directory.'''
    return f"user_{instance.plant.user_id}/images/{filename}"


def user_preview_path(instance, filename):
    '''Returns path to preview image in user namespace directory.'''
    return f"user_{instance.plant.user_id}/previews/{filename}"


def user_thumb_path(instance, filename):
    '''Returns path to thumbnail image in user namespace directory.'''
    return f"user_{instance.plant.user_id}/thumbnails/{filename}"


class Photo(models.Model):
    '''Stores a user-uploaded image of a specific plant.'''

    # Original full-resolution photo
    photo = models.ImageField(upload_to=user_image_path)
    # 800x800 preview (shown in photo modals)
    preview = models.ImageField(upload_to=user_preview_path, null=True, blank=True)
    # 200x200 thumbnail (shown on PlantCard, timeline thumbnails, etc)
    thumbnail = models.ImageField(upload_to=user_thumb_path, null=True, blank=True)

    # Store timestamp when created (not editable)
    created = models.DateTimeField(auto_now_add=True)

    # Timestamp will be read from exifdata by save method
    timestamp = models.DateTimeField(null=True, blank=True)

    # Required relation field matching Photo to correct Plant
    plant = models.ForeignKey('Plant', on_delete=models.CASCADE)

    def __str__(self):
        name = self.plant.get_display_name()
        timestamp = self.timestamp.strftime(TIME_FORMAT)
        filename = self.photo.name.rsplit("/", 1)[-1]
        return f"{name} - {timestamp} - {filename}"

    def get_details(self):
        '''Returns dict with timestamp, primary key, and URLs of all resolutions.'''
        return {
            'timestamp': self.timestamp.isoformat(),
            'photo': self.photo.url,
            'thumbnail': self.thumbnail.url,
            'preview': self.preview.url,
            'key': self.pk
        }

    def _crop_to_square(self, image):
        '''Takes PIL.Image, crops to square aspect ratio and returns.'''
        width, height = image.size

        # Already square
        if height == width:
            return image

        # Portrait
        if height > width:
            top = (height - width) / 2
            bottom = height - top
            return image.crop((0, top, width, bottom))

        # Landscape
        left = (width - height) / 2
        right = width - left
        return image.crop((left, 0, right, height))

    def _convert_to_webp(self, image, size, quality, suffix):
        '''Takes PIL.Image, size (2-tuple), quality (1-100), and filename suffix.
        Returns as webp with requested dimensions and quality.
        '''

        # Get ICC profile (color accuracy)
        icc_profile = image.info.get('icc_profile')

        # Resize, save to buffer
        image.thumbnail(size)
        image_buffer = BytesIO()
        image.save(
            image_buffer,
            format='webp',
            method=6,
            quality=quality,
            icc_profile=icc_profile
        )
        image_buffer.seek(0)

        # Add requested suffix to name, return
        image_name = self.photo.name.rsplit('.', 1)[0]
        return InMemoryUploadedFile(
            image_buffer,
            field_name="ImageField",
            name=f"{image_name}_{suffix}.webp",
            content_type="image/webp",
            size=image_buffer.tell(),
            charset=None,
        )

    def _create_thumbnails(self):
        '''Generates reduced-resolution images (up to 200x200 and 800x800) and
        writes to the thumbnail and preview fields respectively.
        '''

        # Open image, rotate and remove exif rotation param if needed
        original = ImageOps.exif_transpose(
            Image.open(self.photo)
        )

        # Thumbnail: crop to square, resize to 200x200
        self.thumbnail = self._convert_to_webp(
            self._crop_to_square(original.copy()),
            size=settings.THUMBNAIL_RESOLUTION,
            quality=settings.THUMBNAIL_QUALITY,
            suffix='thumb'
        )

        # Preview: resize to maximum of 800x800 (usually 800x600 or 600x800)
        self.preview = self._convert_to_webp(
            original.copy(),
            size=settings.PREVIEW_RESOLUTION,
            quality=settings.PREVIEW_QUALITY,
            suffix='preview'
        )

    def save(self, *args, **kwargs):
        # Create thumbnail if it doesn't exist
        if not self.thumbnail or not self.preview:
            self._create_thumbnails()

        # Copy exif timestamp to timestamp field when saved for the first time
        if not self.pk:
            # Read raw exif data
            exif_raw = Image.open(self.photo).info.get('exif')

            if exif_raw:
                exif_data = piexif.load(exif_raw)
                # Parse Date/Time Original and Offset Time Original parameters
                datetime_original = exif_data['Exif'].get(36867)
                if datetime_original:
                    datetime_original = datetime_original.decode()
                offset_original = exif_data['Exif'].get(36881)
                if offset_original:
                    offset_original = offset_original.decode()

                # If both found parse as original timezone + convert to UTC
                if datetime_original and offset_original:
                    # Remove colon if present (not supported by strptime)
                    timestamp = datetime.strptime(
                        f"{datetime_original} {offset_original.replace(':', '')}",
                        f"{TIME_FORMAT} %z"
                    )
                    self.timestamp = timestamp.astimezone(timezone.utc)

                # If offset not found parse as UTC
                elif datetime_original:
                    timestamp = datetime.strptime(datetime_original, TIME_FORMAT)
                    self.timestamp = timestamp.astimezone(timezone.utc)

                # Default to current time if neither exif param found
                else:
                    self.timestamp = django_timezone.now()
            # Default to current time if no exif data found
            else:
                self.timestamp = django_timezone.now()

        super().save(*args, **kwargs)


@receiver(post_delete, sender=Photo)
def delete_photos_from_disk_hook(instance, **kwargs):
    '''Deletes all photo resolutions from disk after a Photo model is deleted.'''
    instance.thumbnail.delete(save=False)
    instance.preview.delete(save=False)
    instance.photo.delete(save=False)
