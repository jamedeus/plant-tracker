import shutil
from uuid import uuid4
from types import NoneType
from datetime import datetime

from django.conf import settings
from django.test import TestCase
from django.utils import timezone
from django.core.cache import cache
from django.test.client import MULTIPART_CONTENT
from django.core.exceptions import ValidationError

from .models import (
    Group,
    Plant,
    Photo,
    WaterEvent,
    RepotEvent
)
from .view_decorators import (
    get_plant_from_post_body,
    get_group_from_post_body,
    get_timestamp_from_post_body,
    get_event_type_from_post_body
)
from .unit_test_helpers import (
    JSONClient,
    create_mock_photo,
    schedule_cached_state_update_patch
)


def setUpModule():
    # Prevent creating celery tasks to rebuild cached states
    schedule_cached_state_update_patch.start()


def tearDownModule():
    # Delete mock photo directory after tests
    print("\nDeleting mock photos...\n")
    shutil.rmtree(settings.TEST_DIR, ignore_errors=True)

    # Re-enable cached state celery tasks
    schedule_cached_state_update_patch.stop()


class ModelRegressionTests(TestCase):
    def test_changing_uuid_should_not_create_duplicate(self):
        '''Issue: UUID was originally used as primary_key with editable=True.
        When UUID was changed (assign new QR code) the primary_key no longer
        matched any row in the database, so a new row was created without
        deleting the original. This was fixed by changing the attribute name
        from id to uuid and removing primary_key=True (use default BigAuto).
        '''

        # Create test plant and group, confirm 1 entry each
        plant = Plant.objects.create(uuid=uuid4())
        group = Group.objects.create(uuid=uuid4())
        self.assertEqual(len(Plant.objects.all()), 1)
        self.assertEqual(len(Group.objects.all()), 1)

        # Change both UUIDs, confirm no duplicates were created
        plant.uuid = uuid4()
        group.uuid = uuid4()
        plant.save()
        group.save()
        self.assertEqual(len(Plant.objects.all()), 1)
        self.assertEqual(len(Group.objects.all()), 1)

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
    def tearDown(self):
        # Clear cache after each test (prevent leftover after failed test)
        cache.delete('old_uuid')

    def test_water_group_fails_due_to_duplicate_timestamp(self):
        '''Issue: The bulk_add_plant_events endpoint did not trap errors when
        creating events. If a plant in UUID list already had an event with the
        same timestamp an uncaught exception would occur, preventing remaining
        events from being created and returning an unexpected response.
        '''

        # Create 3 test plants, create WaterEvent for second plant
        plant1 = Plant.objects.create(uuid=uuid4())
        plant2 = Plant.objects.create(uuid=uuid4())
        plant3 = Plant.objects.create(uuid=uuid4())
        timestamp = timezone.now()
        WaterEvent.objects.create(plant=plant2, timestamp=timestamp)

        # Confirm 1 WaterEvent exists, plant2 has event, plants 1 and 3 do not
        self.assertEqual(len(WaterEvent.objects.all()), 1)
        self.assertEqual(len(plant1.waterevent_set.all()), 0)
        self.assertEqual(len(plant2.waterevent_set.all()), 1)
        self.assertEqual(len(plant3.waterevent_set.all()), 0)

        # Send bulk_add_plants_to_group request for all plants with same
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
        timestamp = timezone.now()
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

    def test_add_plant_photos_returns_timestamp_with_no_timezone(self):
        '''Issue: add_plant_photos returned a strftime string with no timezone,
        which is not the same format as manage_plant state. This could cause
        photos to appear on wrong timeline day when merged with existing state.

        The database stores all timestamps as UTC, frontend converts to user's
        timezone. If the frontend receives a timestamps with no timezone luxon
        assumes it is already in the current timezone. This caused photos taken
        after 4pm PST (after midnight UTC) to appear on next timeline day.

        The add_plant_photos response now uses the same format as manage_plant.
        '''

        test_plant = Plant.objects.create(uuid=uuid4())

        # Create photos with and without exif creation times
        with_exif = create_mock_photo(
            creation_time='2024:03:21 10:52:03',
            timezone='-07:00',
            name='both.jpg'
        )
        no_exif = create_mock_photo()

        # Post both photos to add_plant_photos endpoint
        data = {
            'plant_id': str(test_plant.uuid),
            'photo_0': with_exif,
            'photo_1': no_exif
        }
        response = self.client.post(
            '/add_plant_photos',
            data=data,
            content_type=MULTIPART_CONTENT
        )

        # Confirm both timestamp strings have timezone offset
        photo_urls = response.json()["urls"]
        self.assertRegex(
            photo_urls[0]["created"],
            r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?\+\d{2}:\d{2}'
        )
        self.assertRegex(
            photo_urls[1]["created"],
            r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?\+\d{2}:\d{2}'
        )

    def test_manage_endpoint_crashes_if_plant_expecting_new_qr_is_deleted(self):
        '''Issue: after /manage was split in f6e229fd requests for new UUIDs
        while old_uuid cache was set (expecting new QR code) were passed to
        render_confirm_new_qr_code_page, which did not have a default return
        statement. If the cached UUID was deleted from database before the new
        QR code was scanned no response was returned. Previously this would
        fall through the conditional and return the registration page.

        Fix: render_confirm_new_qr_code_page now calls render_registration_page
        and clears old_uuid cache if the UUID is not found in the database.
        '''

        # Create test plant, post UUID to /change_qr_code, confirm cache set
        plant = Plant.objects.create(uuid=uuid4())
        JSONClient().post('/change_qr_code', {'uuid': str(plant.uuid)})
        self.assertEqual(cache.get('old_uuid'), str(plant.uuid))

        # Delete plant from database
        plant.delete()

        # Simulate user scanning QR code with UUID that is not in database
        response = self.client.get(f'/manage/{uuid4()}')

        # Confirm request succeeded and rendered registration page
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'plant_tracker/index.html')
        self.assertEqual(
            response.context['js_bundle'],
            'plant_tracker/register.js'
        )

        # Confirm cache was cleared
        self.assertIsNone(cache.get('old_uuid'))


class CachedStateRegressionTests(TestCase):
    def setUp(self):
        # Allow creating celery tasks (and prevent hook called when saving a
        # single model from clearing all cached states)
        schedule_cached_state_update_patch.stop()

    def tearDown(self):
        # Prevent creating celery tasks in other test suites
        schedule_cached_state_update_patch.start()

    def test_display_name_of_unnamed_plants_update_correctly(self):
        '''Issue: cached manage_plant state is not updated until plant is saved
        in database. If plant has no name or species its display_name will have
        a sequential number (eg "Unnamed plant 3") which will change if another
        unnamed plant with lower database key is given a name (eg should become
        "Unnamed plant 2"). Since editing a different plant does not update the
        cached states of others this could result in an outdated display_name.

        The /manage endpoint now overwrites cached display_name with current
        value if the plant has no name.
        '''

        # Create 2 unnamed plants
        plant1 = Plant.objects.create(uuid=uuid4(), name=None)
        plant2 = Plant.objects.create(uuid=uuid4(), name=None)

        # Request manage_plant page for second plant
        response = self.client.get(f'/manage/{plant2.uuid}')
        state = response.context['state']

        # Confirm display_name in context is "Unnamed plant 2"
        self.assertEqual(state['plant']['display_name'], 'Unnamed plant 2')

        # Give first plant a name
        plant1.name = 'My plant'
        plant1.save()

        # Request manage_plant for second plant again
        response = self.client.get(f'/manage/{plant2.uuid}')

        # Confirm display_name in context updated to "Unnamed plant 1"
        self.assertEqual(
            response.context['state']['plant']['display_name'],
            'Unnamed plant 1'
        )


class ViewDecoratorRegressionTests(TestCase):
    def setUp(self):
        self.plant = Plant.objects.create(uuid=uuid4())
        self.group = Group.objects.create(uuid=uuid4())

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

    def test_get_group_from_post_body_traps_wrapped_function_exceptions(self):
        '''Issue: get_group_from_post_body called the wrapped function inside a
        try/except block used to handle request payload errors. If an uncaught
        exception occurred in the wrapped function it would be caught by the
        wrapper, resulting in a JsonResponse with misleading error.
        '''

        # Create test functions that raise errors caught by decorator
        @get_group_from_post_body
        def test_key_error(group, data):
            raise KeyError("wrapped function error")

        @get_group_from_post_body
        def test_validation_error(group, data):
            raise ValidationError("wrapped function error")

        # Exceptions should not be caught by the decorator
        # Confirm exceptions were raised by wrapped function and not decorator
        with self.assertRaises(KeyError) as e:
            test_key_error({'group_id': str(self.group.uuid)})
        self.assertEqual(e.exception.args[0], "wrapped function error")

        with self.assertRaises(ValidationError) as e:
            test_validation_error({'group_id': str(self.group.uuid)})
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
