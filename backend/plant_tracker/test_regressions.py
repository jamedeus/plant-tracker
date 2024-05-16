import os
import shutil
from uuid import uuid4
from types import NoneType
from datetime import datetime

from django.test.client import MULTIPART_CONTENT
from django.core.exceptions import ValidationError
from django.test import TestCase, override_settings

from .models import (
    Tray,
    Plant,
    Photo,
    WaterEvent,
    RepotEvent
)
from .view_decorators import (
    get_plant_from_post_body,
    get_tray_from_post_body,
    get_timestamp_from_post_body,
    get_event_type_from_post_body
)
from .unit_test_helpers import JSONClient, create_mock_photo

# Temp directory for mock photo uploads, deleted after tests
TEST_DIR = '/tmp/plant_tracker_unit_test'


# Create test directory or mock photo uploads
def setUpModule():
    if not os.path.isdir(os.path.join(TEST_DIR, 'data', 'images')):
        os.makedirs(os.path.join(TEST_DIR, 'data', 'images'))


# Delete mock photo directory after tests
def tearDownModule():
    print("\nDeleting mock photos...\n")
    shutil.rmtree(TEST_DIR, ignore_errors=True)


class ModelRegressionTests(TestCase):
    def test_changing_uuid_should_not_create_duplicate(self):
        '''Issue: UUID was originally used as primary_key with editable=True.
        When UUID was changed (assign new QR code) the primary_key no longer
        matched any row in the database, so a new row was created without
        deleting the original. This was fixed by changing the attribute name
        from id to uuid and removing primary_key=True (use default BigAuto).
        '''

        # Create test plant and tray, confirm 1 entry each
        plant = Plant.objects.create(uuid=uuid4())
        tray = Tray.objects.create(uuid=uuid4())
        self.assertEqual(len(Plant.objects.all()), 1)
        self.assertEqual(len(Tray.objects.all()), 1)

        # Change both UUIDs, confirm no duplicates were created
        plant.uuid = uuid4()
        tray.uuid = uuid4()
        plant.save()
        tray.save()
        self.assertEqual(len(Plant.objects.all()), 1)
        self.assertEqual(len(Tray.objects.all()), 1)

    @override_settings(MEDIA_ROOT=os.path.join(TEST_DIR, 'data', 'images'))
    def test_photos_with_no_exif_data_should_set_created_time_to_upload_time(self):
        '''Issue: The created field is populated in the save method using a
        timestamp parsed from exif data, or with the current time if the exif
        param was not found. The current time was copied from the uploaded
        field resulting in a None value because uploaded (set by auto_now_add)
        had not been written to the database yet when it was copied.
        '''

        # Create Photo using mock image with no exif data
        plant = Plant.objects.create(uuid=uuid4())
        photo = Photo.objects.create(
            photo=create_mock_photo(name='photo1.jpg'),
            plant=plant
        )

        # Photo.created should be a datetime object, not NoneType
        self.assertNotEqual(type(photo.created), NoneType)
        self.assertEqual(type(photo.created), datetime)


class ViewRegressionTests(TestCase):
    def test_water_tray_fails_due_to_duplicate_timestamp(self):
        '''Issue: The bulk_add_plant_events endpoint did not trap errors when
        creating events. If a plant in UUID list already had an event with the
        same timestamp an uncaught exception would occur, preventing remaining
        events from being created and returning an unexpected response.
        '''

        # Create 3 test plants, create WaterEvent for second plant
        plant1 = Plant.objects.create(uuid=uuid4())
        plant2 = Plant.objects.create(uuid=uuid4())
        plant3 = Plant.objects.create(uuid=uuid4())
        timestamp = datetime.now()
        WaterEvent.objects.create(plant=plant2, timestamp=timestamp)

        # Confirm 1 WaterEvent exists, plant2 has event, plants 1 and 3 do not
        self.assertEqual(len(WaterEvent.objects.all()), 1)
        self.assertEqual(len(plant1.waterevent_set.all()), 0)
        self.assertEqual(len(plant2.waterevent_set.all()), 1)
        self.assertEqual(len(plant3.waterevent_set.all()), 0)

        # Send bulk_add_plants_to_tray request for all plants with same
        # timestamp as the existing WaterEvent
        payload = {
            'plants': [
                str(plant1.uuid),
                str(plant2.uuid),
                str(plant3.uuid)
            ],
            'event_type': 'water',
            'timestamp': timestamp.isoformat()
        }
        response = JSONClient().post('/bulk_add_plant_events', payload)

        # Request should succeed despite conflicting event, plant2 should be
        # listed as failed in response
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {
                "action": "water",
                "plants": [str(plant1.uuid), str(plant3.uuid)],
                "failed": [str(plant2.uuid)]
            }
        )

        # Confirm events were created for plants 1 and 3, but not 2
        self.assertEqual(len(plant1.waterevent_set.all()), 1)
        self.assertEqual(len(plant2.waterevent_set.all()), 1)
        self.assertEqual(len(plant3.waterevent_set.all()), 1)

    def test_repot_plant_does_not_handle_duplicate_timestamp(self):
        '''Issue: The repot_plant endpoint did not handle errors while creating
        RepotEvent, leading to an uncaught exception and unexpected response if
        an event with the same timestamp already existed for the target plant.
        '''

        # Create test plant with 1 RepotEvent
        plant = Plant.objects.create(uuid=uuid4())
        timestamp = datetime.now()
        RepotEvent.objects.create(plant=plant, timestamp=timestamp)
        self.assertEqual(len(plant.repotevent_set.all()), 1)

        # Send request to repot plant with same timestamp
        payload = {
            'plant_id': str(plant.uuid),
            'timestamp': timestamp.isoformat(),
            'new_pot_size': ''
        }
        response = JSONClient().post('/repot_plant', payload)

        # Confirm correct error, confirm no RepotEvent was created
        self.assertEqual(response.status_code, 409)
        self.assertEqual(
            response.json(),
            {"error": "Event with same timestamp already exists"}
        )
        self.assertEqual(len(plant.repotevent_set.all()), 1)

    @override_settings(MEDIA_ROOT=os.path.join(TEST_DIR, 'data', 'images'))
    def test_delete_plant_photos_fails_due_to_duplicate_creation_times(self):
        '''Issue: delete_plant_photos looked up photos in the database using a
        plant UUID and creation timestamp. If multiple photos of the same plant
        had identical creation timestamps an uncaught exception was raised,
        preventing the photos from being deleted. The primary key is now used
        instead, which also prevents a duplicate react key on the frontend.
        '''

        # Create 2 mock photos with identical creation times
        plant = Plant.objects.create(uuid=uuid4())
        photo1 = Photo.objects.create(
            photo=create_mock_photo('2024:03:21 10:52:03'),
            plant=plant
        )
        photo2 = Photo.objects.create(
            photo=create_mock_photo('2024:03:21 10:52:03'),
            plant=plant
        )
        self.assertEqual(len(Photo.objects.all()), 2)

        # Make request to delete both photos from database
        payload = {
            'plant_id': str(plant.uuid),
            'delete_photos': [photo1.pk, photo2.pk]
        }
        response = JSONClient().post('/delete_plant_photos', payload)

        # Should succeed despite duplicate timestamp, confirm removed from db
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(Photo.objects.all()), 0)


class ViewDecoratorRegressionTests(TestCase):
    def setUp(self):
        self.plant = Plant.objects.create(uuid=uuid4())
        self.tray = Tray.objects.create(uuid=uuid4())

    def test_get_plant_from_post_body_traps_wrapped_function_exceptions(self):
        '''Issue: get_plant_from_post_body called the wrapped function inside a
        try/except block used to handle request payload errors. If an uncaught
        exception occurred in the wrapped function it would be caught by the
        wrapper, resulting in a JsonResponse with misleading error.
        '''

        # Create test functions that raise errors caught by decorator
        @get_plant_from_post_body
        def test_key_error(plant, data):
            raise KeyError("wrapped function error")

        @get_plant_from_post_body
        def test_validation_error(plant, data):
            raise ValidationError("wrapped function error")

        # Exceptions should not be caught by the decorator
        # Confirm exceptions were raised by wrapped function and not decorator
        with self.assertRaises(KeyError) as e:
            test_key_error({'plant_id': str(self.plant.uuid)})
        self.assertEqual(e.exception.args[0], "wrapped function error")

        with self.assertRaises(ValidationError) as e:
            test_validation_error({'plant_id': str(self.plant.uuid)})
        self.assertEqual(e.exception.args[0], "wrapped function error")

    def test_get_tray_from_post_body_traps_wrapped_function_exceptions(self):
        '''Issue: get_tray_from_post_body called the wrapped function inside a
        try/except block used to handle request payload errors. If an uncaught
        exception occurred in the wrapped function it would be caught by the
        wrapper, resulting in a JsonResponse with misleading error.
        '''

        # Create test functions that raise errors caught by decorator
        @get_tray_from_post_body
        def test_key_error(tray, data):
            raise KeyError("wrapped function error")

        @get_tray_from_post_body
        def test_validation_error(tray, data):
            raise ValidationError("wrapped function error")

        # Exceptions should not be caught by the decorator
        # Confirm exceptions were raised by wrapped function and not decorator
        with self.assertRaises(KeyError) as e:
            test_key_error({'tray_id': str(self.tray.uuid)})
        self.assertEqual(e.exception.args[0], "wrapped function error")

        with self.assertRaises(ValidationError) as e:
            test_validation_error({'tray_id': str(self.tray.uuid)})
        self.assertEqual(e.exception.args[0], "wrapped function error")

    def test_get_timestamp_from_post_body_traps_wrapped_function_exceptions(self):
        '''Issue: get_timestamp_from_post_body called the wrapped function
        inside a try/except block used to handle request payload errors. If an
        uncaught exception occurred in the wrapped function it would be caught
        by the wrapper, resulting in a JsonResponse with misleading error.
        '''

        # Create test functions that raise errors caught by decorator
        @get_timestamp_from_post_body
        def test_key_error(timestamp, data):
            raise KeyError("wrapped function error")

        @get_timestamp_from_post_body
        def test_value_error(timestamp, data):
            raise ValueError("wrapped function error")

        # Exceptions should not be caught by the decorator
        # Confirm exceptions were raised by wrapped function and not decorator
        with self.assertRaises(KeyError) as e:
            test_key_error({'timestamp': '2024-02-06T03:06:26.000Z'})
        self.assertEqual(e.exception.args[0], "wrapped function error")

        with self.assertRaises(ValueError) as e:
            test_value_error({'timestamp': '2024-02-06T03:06:26.000Z'})
        self.assertEqual(e.exception.args[0], "wrapped function error")

    def test_get_event_type_from_post_body_traps_wrapped_function_exceptions(self):
        '''Issue: get_event_type_from_post_body called the wrapped function
        inside a try/except block used to handle request payload errors. If an
        uncaught exception occurred in the wrapped function it would be caught
        by the wrapper, resulting in a JsonResponse with misleading error.
        '''

        # Create test function that raise error caught by decorator
        @get_event_type_from_post_body
        def test_key_error(event_type, data):
            raise KeyError("wrapped function error")

        # Exceptions should not be caught by the decorator
        # Confirm exceptions were raised by wrapped function and not decorator
        with self.assertRaises(KeyError) as e:
            test_key_error({'event_type': 'water'})
        self.assertEqual(e.exception.args[0], "wrapped function error")
