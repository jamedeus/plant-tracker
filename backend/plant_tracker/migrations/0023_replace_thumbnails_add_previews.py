# Generated by Django 5.2 on 2025-05-27 07:16

import os
import shutil
from io import BytesIO

from PIL import Image, ImageOps
from django.db import migrations
from django.conf import settings
from django.core.files.uploadedfile import InMemoryUploadedFile


def crop_to_square(image):
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


def convert_to_webp(image, size, quality, filename):
    '''Takes PIL.Image, size (2-tuple), quality (1-100), and filename.
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
    return InMemoryUploadedFile(
        image_buffer,
        field_name="ImageField",
        name=filename,
        content_type="image/webp",
        size=image_buffer.tell(),
        charset=None,
    )


def regenerate_existing_photo_thumbnails(apps, schema_editor):
    '''Iterates Photo model, generates a 200x200 webp thumbnail and up to
    800x800 webp preview for each entry (overwrites existing).
    '''
    Photo = apps.get_model('plant_tracker', 'Photo')
    for photo in Photo.objects.all():
        # Open in context manager so file is closed afterward (avoids crash due
        # to too many open files after about 1000 photos)
        with photo.photo.open('rb') as file, Image.open(file) as image:
            # Rrotate and remove exif rotation param if needed
            original = ImageOps.exif_transpose(image)

        # Get filename, no extension
        image_name = photo.photo.name.rsplit('.', 1)[0]

        # Crop copy to square, resize to 200x200, save as thumbnail
        thumbnail = crop_to_square(original.copy())
        photo.thumbnail = convert_to_webp(thumbnail, (200, 200), 65, f"{image_name}_thumb.webp")

        # Scale down original to max of 800x800, save as preview
        photo.preview = convert_to_webp(original.copy(), (800, 800), 80, f"{image_name}_preview.webp")
        photo.save()
        print(f'Generated new thumbnail and preview for {photo}')


def delete_existing_photo_thumbnails(apps, schema_editor):
    '''Deletes all existing photo thumbnails and previews from disk.'''
    thumbnails = os.path.join(settings.MEDIA_ROOT, 'thumbnails')
    if os.path.isdir(thumbnails):
        print('deleting thumbnails')
        shutil.rmtree(thumbnails)
    previews = os.path.join(settings.MEDIA_ROOT, 'previews')
    if os.path.isdir(previews):
        print('deleting previews')
        shutil.rmtree(previews)


class Migration(migrations.Migration):

    dependencies = [
        ('plant_tracker', '0022_photo_preview'),
    ]

    operations = [
        migrations.RunPython(delete_existing_photo_thumbnails),
        migrations.RunPython(regenerate_existing_photo_thumbnails),
    ]
