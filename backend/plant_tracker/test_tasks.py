# pylint: disable=missing-docstring,line-too-long,R0801,too-many-lines,global-statement


from uuid import uuid4
from unittest.mock import patch

from django.test import TestCase
from django.core.cache import cache

from .models import Plant, Photo
from .view_decorators import get_default_user
from .unit_test_helpers import (
    create_mock_photo,
    enable_isolated_media_root,
    cleanup_isolated_media_root
)
from .tasks import (
    update_cached_overview_state,
    update_all_cached_states,
    process_photo_upload
)

OVERRIDE = None
MODULE_MEDIA_ROOT = None


def setUpModule():
    global OVERRIDE, MODULE_MEDIA_ROOT
    OVERRIDE, MODULE_MEDIA_ROOT = enable_isolated_media_root()


def tearDownModule():
    # Delete mock photo directory after tests
    cleanup_isolated_media_root(OVERRIDE, MODULE_MEDIA_ROOT)


class HelperFunctionTests(TestCase):
    '''Test helper functions that are used by multiple tasks'''

    def setUp(self):
        # Clear entire cache before each test
        cache.clear()


class TaskTests(TestCase):
    '''Test task functions'''

    def setUp(self):
        # Clear entire cache before each test
        cache.clear()

    def test_update_cached_overview_state(self):
        # Confirm overview_state cache is not set
        user_id = get_default_user().pk
        self.assertIsNone(cache.get(f'overview_state_{user_id}'))

        # Run task immediately
        update_cached_overview_state.delay(user_id)

        # Confirm overview state was generated and cached
        self.assertTrue(isinstance(cache.get(f'overview_state_{user_id}'), dict))

    def test_update_all_cached_states(self):
        default_user = get_default_user()
        # Replace cached overview state with dummy strings
        cache.set(f'overview_state_{default_user.pk}', 'foo')

        # Call update_all_cached_states method
        update_all_cached_states()

        # Confirm cached overview state was rebuilt (no longer dummy strings)
        self.assertIsInstance(cache.get(f'overview_state_{default_user.pk}'), dict)

    def test_process_photo_upload(self):
        # Simulate pending photo upload
        plant = Plant.objects.create(uuid=uuid4(), user=get_default_user())
        photo = Photo.objects.create(
            plant=plant,
            photo=create_mock_photo('2024:03:21 10:52:03')
        )
        cache.set(
            f"pending_photo_upload_{photo.pk}",
            {'status': 'processing', 'plant_id': str(plant.uuid)}
        )

        # Confirm photo thumbnail and preview were not generated
        self.assertIsNone(photo.thumbnail.name)
        self.assertIsNone(photo.preview.name)
        self.assertTrue(photo.pending)

        # Run task immediately
        process_photo_upload.delay(photo.pk)
        photo.refresh_from_db()

        # Confirm thumbnail and preview were generated
        self.assertIsNotNone(photo.thumbnail.name)
        self.assertIsNotNone(photo.preview.name)
        self.assertFalse(photo.pending)

        # Confirm cached status changed to complete, details were added
        self.assertEqual(
            cache.get(f"pending_photo_upload_{photo.pk}"),
            {
                'status': 'complete',
                'plant_id': str(plant.uuid),
                'photo_details': photo.get_details()
            }
        )

    def test_process_photo_upload_photo_does_not_exist(self):
        # Run task with photo key that does not exist in database
        process_photo_upload.delay(404)

        # Confirm cached status changed to failed
        self.assertEqual(
            cache.get(f"pending_photo_upload_{404}"),
            {'status': 'failed'}
        )

    def test_process_photo_upload_error_while_processing(self):
        # Simulate pending photo upload
        plant = Plant.objects.create(uuid=uuid4(), user=get_default_user())
        photo = Photo.objects.create(
            plant=plant,
            photo=create_mock_photo('2024:03:21 10:52:03')
        )
        cache.set(
            f"pending_photo_upload_{photo.pk}",
            {'status': 'processing', 'plant_id': str(plant.uuid)}
        )

        # Simulate exception when task tries to open photo
        with patch('PIL.Image.open', side_effect=IOError), \
            self.assertRaises(IOError):
            process_photo_upload.delay(photo.pk)

        # Confirm cached status changed to failed
        self.assertEqual(
            cache.get(f"pending_photo_upload_{photo.pk}"),
            {'status': 'failed', 'plant_id': str(plant.uuid)}
        )
