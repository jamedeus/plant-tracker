from io import BytesIO

import piexif
from PIL import Image

from django.test import Client
from django.core.files.uploadedfile import InMemoryUploadedFile


class JSONClient(Client):
    '''Subclass of django.test.Client that defaults to json content_type'''
    def post(self, path, data=None, content_type='application/json', **extra):
        return super().post(path, data, content_type, **extra)


def create_mock_photo(creation_time=None, name='mock_photo.jpg', timezone=None):
    '''Creates a mock JPG in memory with exif DateTimeOriginal parameter
    Takes DateTimeOriginal string (required) and filename string (optional)
    '''
    mock_photo = BytesIO()
    image = Image.new('RGB', (1, 1), color='white')

    # Add creation time and/or timezone if args passed
    if creation_time or timezone:
        exif_params = {'Exif': {}}
        if creation_time:
            exif_params['Exif'][36867] = creation_time.encode()
        if timezone:
            exif_params['Exif'][36881] = timezone.encode()
        exif_bytes = piexif.dump(exif_params)
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
