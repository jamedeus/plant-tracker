'''Helper functions used in unit tests'''

import os
import shutil
import tempfile
from io import BytesIO

import piexif
from PIL import Image

from django.test import Client
from django.conf import settings
from django.test.utils import override_settings
from django.core.files.uploadedfile import InMemoryUploadedFile


class JSONClient(Client):
    '''Subclass of django.test.Client that defaults to json content_type'''

    # pylint: disable-next=arguments-differ
    def post(self, path, data=None, content_type='application/json', **extra):
        return super().post(path, data, content_type, **extra)

    def get_json(self, path, **extra):
        '''Makes GET request with application/json accept header.'''
        return super().get(path, HTTP_ACCEPT='application/json', **extra)


def enable_isolated_media_root():
    '''Create a per-module temporary MEDIA_ROOT and apply override_settings.

    Returns a tuple of (override_object, module_temp_dir) so the caller can
    disable the override and delete the temp directory in tearDownModule.
    '''
    module_media_root = tempfile.mkdtemp(prefix='plant_tracker_unit_test_')
    media_root = os.path.join(module_media_root, 'data', 'images')
    storages = {
        "default": {
            "BACKEND": "django.core.files.storage.FileSystemStorage",
            "OPTIONS": {
                "location": media_root,
                "base_url": settings.MEDIA_URL,
            },
        },
        "staticfiles": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    }
    override = override_settings(
        TEST_DIR=module_media_root,
        MEDIA_ROOT=media_root,
        STORAGES=storages
    )
    override.enable()
    os.makedirs(media_root, exist_ok=True)
    return override, module_media_root


def cleanup_isolated_media_root(override, module_media_root):
    '''Disable overrides and remove the temporary directory created above.'''
    shutil.rmtree(module_media_root, ignore_errors=True)
    if override:
        override.disable()

def create_mock_photo(
    creation_time=None,
    name='mock_photo.jpg',
    timezone=None,
    blank_exif=False,
    size=(1, 1)
):
    '''Creates a mock JPG in memory with exif parameters set by optional args.

    The creation_time and timezone args set the DateTimeOriginal and
    OffsetTimeOriginal exif parameters respectively. If neither are passed an
    image with no exif data will be created. If the blank_exif arg is True an
    image with exif data containing irrelevant parameters will be created.

    The name arg sets the filename written to disk and used in URLs.

    The size arg sets the dimensions (width, height).
    '''
    mock_photo = BytesIO()
    image = Image.new('RGB', size, color='white')

    # Add creation time and/or timezone if args passed
    if creation_time or timezone:
        exif_params = {'Exif': {}}
        if creation_time:
            exif_params['Exif'][36867] = creation_time.encode()
        if timezone:
            exif_params['Exif'][36881] = timezone.encode()
        exif_bytes = piexif.dump(exif_params)
        image.save(mock_photo, format='JPEG', exif=exif_bytes)
    # Add exif data with no timestamp params if blank_exif arg is True
    elif blank_exif:
        exif_bytes = piexif.dump({'Exif': {42035: 'Canon'.encode()}})
        image.save(mock_photo, format='JPEG', exif=exif_bytes)
    else:
        image.save(mock_photo, format='JPEG')

    mock_photo.seek(0)

    return InMemoryUploadedFile(
        file=mock_photo,
        field_name='photo_1',
        name=name,
        content_type='image/jpeg',
        size=mock_photo.getbuffer().nbytes,
        charset=None
    )


def create_mock_rgba_png(name='mock_rgba.png'):
    '''Creates a mock PNG in memory with RGBA color mode (mock screenshot).'''

    mock_photo = BytesIO()
    image = Image.new('RGBA', (1, 1), color='white')
    image.save(mock_photo, format='PNG')
    mock_photo.seek(0)

    return InMemoryUploadedFile(
        file=mock_photo,
        field_name='photo_1',
        name=name,
        content_type='image/png',
        size=mock_photo.getbuffer().nbytes,
        charset=None
    )
