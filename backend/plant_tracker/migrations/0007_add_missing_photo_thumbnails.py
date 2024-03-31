# Generated by Django 5.0.3 on 2024-03-31 03:44

from io import BytesIO

from PIL import Image, ImageOps
from django.db import migrations
from django.core.files.uploadedfile import InMemoryUploadedFile


def generate_thumbnail(photo_field):
    '''Takes ImageField, returns InMemoryUploadedFile containing thumbnail'''

    # Open image, rotate and remove exif rotation param if needed
    image = ImageOps.exif_transpose(
        Image.open(photo_field)
    )

    # Resize to a maximum resolution of 800x800, write to buffer
    image.thumbnail((800, 800))
    image_buffer = BytesIO()
    image.save(image_buffer, format='JPEG', quality=80)

    # Return as InMemoryUploadedFile with _thumb suffix added to filename
    image_name = photo_field.name.split('.')[0]
    return InMemoryUploadedFile(
        image_buffer,
        'ImageField',
        f"{image_name}_thumb.jpg",
        'image/jpeg',
        image_buffer.tell(),
        None
    )


def generate_missing_thumbnails(apps, schema_editor):
    '''Iterate Photo model and generate missing thumbnail for all entries'''
    Photo = apps.get_model('plant_tracker', 'Photo')
    for photo in Photo.objects.all():
        if not photo.thumbnail:
            photo.thumbnail = generate_thumbnail(photo.photo)
            photo.save()


class Migration(migrations.Migration):

    dependencies = [
        ('plant_tracker', '0006_photo_thumbnail'),
    ]

    operations = [
        migrations.RunPython(generate_missing_thumbnails),
    ]
