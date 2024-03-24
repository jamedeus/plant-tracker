from io import BytesIO

import piexif
from PIL import Image

from django.test import Client
from django.core.files.uploadedfile import InMemoryUploadedFile


# Subclass Client, add default for content_type arg
class JSONClient(Client):
    def post(self, path, data=None, content_type='application/json', **extra):
        return super().post(path, data, content_type, **extra)


def create_mock_photo(creation_time, name='mock_photo.jpg'):
    mock_photo = BytesIO()
    image = Image.new('RGB', (1, 1), color='white')
    exif_bytes = piexif.dump({
        'Exif': {
            36867: creation_time.encode(),
        }
    })
    image.save(mock_photo, format='JPEG', exif=exif_bytes)
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
