from io import BytesIO

import piexif
from PIL import Image

from django.test import Client
from django.core.files.uploadedfile import InMemoryUploadedFile


class JSONClient(Client):
    '''Subclass of django.test.Client that defaults to json content_type'''
    def post(self, path, data=None, content_type='application/json', **extra):
        return super().post(path, data, content_type, **extra)


def create_mock_photo(creation_time=None, name='mock_photo.jpg'):
    '''Creates a mock JPG in memory with exif DateTimeOriginal parameter
    Takes DateTimeOriginal string (required) and filename string (optional)
    '''
    mock_photo = BytesIO()
    image = Image.new('RGB', (1, 1), color='white')

    # Add creation time if arg passed
    if creation_time:
        exif_bytes = piexif.dump({
            'Exif': {
                36867: creation_time.encode(),
            }
        })
        image.save(mock_photo, format='JPEG', exif=exif_bytes)
    else:
        image.save(mock_photo, format='JPEG')

    mock_photo.seek(0)

    uploaded_photo = InMemoryUploadedFile(
        file=mock_photo,
        field_name='photo_1',
        name=name,
        content_type='image/jpeg',
        size=mock_photo.getbuffer().nbytes,
        charset=None
    )

    return uploaded_photo
