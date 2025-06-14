# pylint: disable=missing-docstring,R0801,too-many-lines

import shutil
import threading
from uuid import uuid4
from types import NoneType
from datetime import datetime
from unittest.mock import patch

from django.conf import settings
from django.utils import timezone
from django.core.cache import cache
from django.contrib.auth import get_user_model
from django.test.client import MULTIPART_CONTENT
from django.db import IntegrityError, connections
from django.core.exceptions import ValidationError
from django.test import TestCase, TransactionTestCase, Client

from .tasks import (
    update_cached_plant_options,
    update_cached_group_options
)
from .models import (
    Group,
    Plant,
    Photo,
    WaterEvent,
    RepotEvent
)
from .view_decorators import (
    get_default_user,
    get_plant_from_post_body,
    get_group_from_post_body,
    get_timestamp_from_post_body,
    get_event_type_from_post_body
)
from .unit_test_helpers import (
    JSONClient,
    create_mock_photo,
    create_mock_rgba_png,
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
    def tearDown(self):
        # Revert back to SINGLE_USER_MODE
        settings.SINGLE_USER_MODE = True

    def test_changing_uuid_should_not_create_duplicate(self):
        '''Issue: UUID was originally used as primary_key with editable=True.
        When UUID was changed (assign new QR code) the primary_key no longer
        matched any row in the database, so a new row was created without
        deleting the original. This was fixed by changing the attribute name
        from id to uuid and removing primary_key=True (use default BigAuto).
        '''

        # Create test plant and group, confirm 1 entry each
        plant = Plant.objects.create(uuid=uuid4(), user=get_default_user())
        group = Group.objects.create(uuid=uuid4(), user=get_default_user())
        self.assertEqual(len(Plant.objects.all()), 1)
        self.assertEqual(len(Group.objects.all()), 1)

        # Change both UUIDs, confirm no duplicates were created
        plant.uuid = uuid4()
        group.uuid = uuid4()
        plant.save()
        group.save()
        self.assertEqual(len(Plant.objects.all()), 1)
        self.assertEqual(len(Group.objects.all()), 1)

    def test_photos_with_no_exif_data_should_set_timestamp_to_upload_time(self):
        '''Issue: The timestamp field is populated in the save method using a
        timestamp parsed from exif data, or with the current time if the exif
        param was not found. The current time was copied from the uploaded
        field resulting in a None value because uploaded (set by auto_now_add)
        had not been written to the database yet when it was copied.
        '''

        # Create Photo using mock image with no exif data
        plant = Plant.objects.create(uuid=uuid4(), user=get_default_user())
        photo = Photo.objects.create(
            photo=create_mock_photo(name='photo1.jpg'),
            plant=plant
        )

        # Photo.timestamp should be a datetime object, not NoneType
        self.assertNotEqual(type(photo.timestamp), NoneType)
        self.assertEqual(type(photo.timestamp), datetime)

    def test_photos_with_periods_in_filename_get_incorrect_thumbnail_names(self):
        '''Issue: Photo._create_thumbnail built the thumbnail name by calling
        split('.')[0] and then adding _thumb.jpg suffix. If the photo filename
        contained periods everything after the first period would be truncated
        in the thumbnail name, potentially leading to thumbnail name collisions.
        The _create_thumbnail method now uses rsplit to avoid this.
        '''

        # Create Photo using mock image with periods in filename
        plant = Plant.objects.create(uuid=uuid4(), user=get_default_user())
        photo = Photo.objects.create(
            photo=create_mock_photo(name='photo.of.my.plant.flowering.jpg'),
            plant=plant
        )

        # Confirm filename was not truncated
        self.assertEqual(
            photo.thumbnail.name,
            'thumbnails/photo.of.my.plant.flowering_thumb.webp'
        )

    def test_should_not_allow_creating_plant_with_same_uuid_as_group(self):
        '''Issue: The unique constraint on the Plant.uuid field only applies to
        the Plant table. This did not prevent the user from creating Plant with
        the same UUID as an existing Group. The Group then became inaccessible
        because the /manage endpoint looks up UUIDs in the Plant table first.

        The save methods of both models now raise an exception if their UUID
        already exists in the other table.
        '''

        # Instantiate Group model
        group = Group.objects.create(uuid=uuid4(), user=get_default_user())

        # Attempt to instantiate Plant with same UUID, should raise exception
        with self.assertRaises(IntegrityError):
            Plant.objects.create(uuid=group.uuid, user=get_default_user())

    def test_should_not_allow_creating_group_with_same_uuid_as_plant(self):
        '''Issue: The unique constraint on the Group.uuid field only applies to
        the Group table. This did not prevent the user from creating Group with
        the same UUID as an existing Plant. The new Group could not be accessed
        because the /manage endpoint looks up UUIDs in the Plant table first.

        The save methods of both models now raise an exception if their UUID
        already exists in the other table.
        '''

        # Instantiate Plant model
        plant = Plant.objects.create(uuid=uuid4(), user=get_default_user())

        # Attempt to instantiate Group with same UUID, should raise exception
        with self.assertRaises(IntegrityError):
            Group.objects.create(uuid=plant.uuid, user=get_default_user())

    def test_deleting_group_should_not_delete_plants_in_group(self):
        '''Issue: The Plant model's group ForeignKey originally had on_delete
        set to cascade, causing all Plant entries associated with a group to be
        deleted when the Group was deleted.

        Deleting a group now sets the group key for all Plants previously in
        the group to null.
        '''

        # Create a Group entry and Plant entry with ForeignKey to group
        group = Group.objects.create(uuid=uuid4(), user=get_default_user())
        plant = Plant.objects.create(uuid=uuid4(), group=group, user=get_default_user())

        # Confirm 1 of each model exist, plant has correct relation to Group
        self.assertEqual(len(Group.objects.all()), 1)
        self.assertEqual(len(Plant.objects.all()), 1)
        self.assertIs(plant.group, group)

        # Delete group, confirm group deleted but plant still exists
        group.delete()
        self.assertEqual(len(Group.objects.all()), 0)
        self.assertEqual(len(Plant.objects.all()), 1)

        # Confirm Plant.group is now null
        plant.refresh_from_db()
        self.assertIsNone(plant.group)

    def test_unnamed_plant_and_group_index_should_not_include_other_users_instances(self):
        '''Issue: The "Unnamed plant #" and "Unnamed group #" were determined
        using all unnamed plants/groups in the database, not just plants/groups
        owned by the requesting user. This could cause a user's first unnamed
        plant to be called "Unnamed plant 7" or some other confusing number.
        '''

        # Disable SINGLE_USER_MODE
        settings.SINGLE_USER_MODE = False

        # Create 2 test users with 1 unnamed plant each
        user_model = get_user_model()
        user1 = user_model.objects.create_user(
            username='user1',
            password='123',
            email='user1@gmail.com'
        )
        user2 = user_model.objects.create_user(
            username='user2',
            password='123',
            email='user2@gmail.com'
        )
        Plant.objects.create(uuid=uuid4(), user=user1)
        plant2 = Plant.objects.create(uuid=uuid4(), user=user2)

        # Sign in as user2, request manage_plant page
        client = Client()
        client.login(username='user2', password='123')
        response = client.get(f'/manage/{plant2.uuid}')

        # Confirm plant name is "Unnamed plant 1", not 2
        self.assertEqual(
            response.context['state']['plant_details']['display_name'],
            'Unnamed plant 1'
        )

    def test_unnamed_plant_index_should_not_change_when_added_to_group(self):
        '''Issue: The get_unnamed_plants function used an unsorted queryset,
        assuming the entries would be in the same order they were added to the
        database. This is true on sqlite, but order is non-deterministic on
        postgres. After the database backend was changed to postgres an unnamed
        plant's index could change after a ForeignKey was added (eg add group).
        '''

        # Create 2 test plants and 1 group
        plant1 = Plant.objects.create(uuid=uuid4(), user=get_default_user())
        plant2 = Plant.objects.create(uuid=uuid4(), user=get_default_user())
        group = Group.objects.create(uuid=uuid4(), user=get_default_user())

        # Confirm "Unnamed plant <index>" matches creation order
        self.assertEqual(plant1.get_display_name(), 'Unnamed plant 1')
        self.assertEqual(plant2.get_display_name(), 'Unnamed plant 2')

        # Add plant1 to group, save
        plant1.group = group
        plant1.save()

        # Confirm display name did not change
        self.assertEqual(plant1.get_display_name(), 'Unnamed plant 1')


class ViewRegressionTests(TestCase):
    def tearDown(self):
        # Clear cache after each test (prevent leftover after failed test)
        cache.delete(f'old_uuid_{get_default_user().pk}')

    def test_water_group_fails_due_to_duplicate_timestamp(self):
        '''Issue: The bulk_add_plant_events endpoint did not trap errors when
        creating events. If a plant in UUID list already had an event with the
        same timestamp an uncaught exception would occur, preventing remaining
        events from being created and returning an unexpected response.
        '''

        # Create 3 test plants, create WaterEvent for second plant
        default_user = get_default_user()
        plant1 = Plant.objects.create(uuid=uuid4(), user=default_user)
        plant2 = Plant.objects.create(uuid=uuid4(), user=default_user)
        plant3 = Plant.objects.create(uuid=uuid4(), user=default_user)
        timestamp = timezone.now()
        WaterEvent.objects.create(plant=plant2, timestamp=timestamp)

        # Confirm 1 WaterEvent exists, plant2 has event, plants 1 and 3 do not
        self.assertEqual(len(WaterEvent.objects.all()), 1)
        self.assertEqual(len(plant1.waterevent_set.all()), 0)
        self.assertEqual(len(plant2.waterevent_set.all()), 1)
        self.assertEqual(len(plant3.waterevent_set.all()), 0)

        # Send bulk_add_plants_to_group request for all plants with same
        # timestamp as the existing WaterEvent
        response = JSONClient().post('/bulk_add_plant_events', {
            'plants': [
                str(plant1.uuid),
                str(plant2.uuid),
                str(plant3.uuid)
            ],
            'event_type': 'water',
            'timestamp': timestamp.isoformat()
        })

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
        plant = Plant.objects.create(uuid=uuid4(), user=get_default_user())
        timestamp = timezone.now()
        RepotEvent.objects.create(plant=plant, timestamp=timestamp)
        self.assertEqual(len(plant.repotevent_set.all()), 1)

        # Send request to repot plant with same timestamp
        response = JSONClient().post('/repot_plant', {
            'plant_id': str(plant.uuid),
            'timestamp': timestamp.isoformat(),
            'new_pot_size': ''
        })

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
        plant = Plant.objects.create(uuid=uuid4(), user=get_default_user())
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
        response = JSONClient().post('/delete_plant_photos', {
            'plant_id': str(plant.uuid),
            'delete_photos': [photo1.pk, photo2.pk]
        })

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

        test_plant = Plant.objects.create(uuid=uuid4(), user=get_default_user())

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
        photos = response.json()["urls"]
        self.assertRegex(
            photos[0]["timestamp"],
            r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?\+\d{2}:\d{2}'
        )
        self.assertRegex(
            photos[1]["timestamp"],
            r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?\+\d{2}:\d{2}'
        )

    def test_add_plant_photos_returns_500_when_image_is_rgba(self):
        '''Issue: if the user uploaded an RGBA photo (screenshots) an uncaught
        exception would occur when PIL tried to save the photo as jpg while
        creating the thumbnail, causing add_plant_photos to return 500. This
        prevented all photos in the payload from being saved, not just the RGBA
        photo. The Photo model now checks image mode and converts RGBA to RGB.
        '''

        test_plant = Plant.objects.create(uuid=uuid4(), user=get_default_user())
        self.assertEqual(len(test_plant.photo_set.all()), 0)

        # Create photo with RGBA color mode, post to add_plant_photos endpoint
        data = {
            'plant_id': str(test_plant.uuid),
            'photo_0': create_mock_rgba_png()
        }
        response = self.client.post(
            '/add_plant_photos',
            data=data,
            content_type=MULTIPART_CONTENT
        )

        # Confirm upload was successful
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(test_plant.photo_set.all()), 1)

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
        plant = Plant.objects.create(uuid=uuid4(), user=get_default_user())
        JSONClient().post('/change_qr_code', {'uuid': str(plant.uuid)})
        self.assertEqual(
            cache.get(f'old_uuid_{get_default_user().pk}'),
            str(plant.uuid)
        )

        # Delete plant from database
        plant.delete()

        # Simulate user scanning QR code with UUID that is not in database
        response = self.client.get(f'/manage/{uuid4()}')

        # Confirm request succeeded and rendered registration page
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'plant_tracker/index.html')
        self.assertEqual(
            response.context['js_files'],
            settings.PAGE_DEPENDENCIES['register']['js']
        )
        # Confirm context does NOT contain changing_qr_code key (causes register
        # to show confirm QR prompt since merged with confirm_new_qr_code page)
        self.assertNotIn('changing_qr_code', response.context['state'])

        # Confirm cache was cleared
        self.assertIsNone(cache.get(f'old_uuid_{get_default_user().pk}'))

    def test_edit_plant_details_crashes_when_pot_size_is_null(self):
        '''Issue: The /edit_plant endpoint returns a modified version of the
        payload it received, which previously cast the pot_size param to int
        with no error handling. If the pot_size field was not filled in this
        resulted in a TypeError when None was passed to int().

        The frontend now handles both string and integer values for pot_size,
        the backend returns pot_size unchanged.
        '''

        # Create test plant
        plant = Plant.objects.create(uuid=uuid4(), user=get_default_user())

        # Post details with blank pot_size to /edit_plant endpoint
        response = JSONClient().post('/edit_plant', {
            'plant_id': plant.uuid,
            'name': 'test plant',
            'species': 'Giant Sequoia',
            'description': '',
            'pot_size': ''
        })

        # Post details with string pot_size to /edit_plant endpoint
        response = JSONClient().post('/edit_plant', {
            'plant_id': plant.uuid,
            'name': 'test plant',
            'species': 'Giant Sequoia',
            'description': '',
            'pot_size': '36'
        })

        # Confirm request succeeded, response did not change pot_size
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['pot_size'], '36')

    def test_register_plant_uncaught_exception_if_uuid_already_exists(self):
        '''Issue: The /register_plant endpoint passed user input to the Plant
        class with no error handling. If the UUID already existed in the
        database an uncaught IntegrityError was raiased resulting in 500 error
        response. This could occur if the same QR code was scanned on 2 phones,
        registered on one, and then registered on the other.

        The /register_plant endpoint now returns a 409 if UUID already exists.
        '''

        # Confirm no plants in database
        self.assertEqual(len(Plant.objects.all()), 0)

        # Send register_plant request, confirm expected redirect response
        test_id = uuid4()
        response = JSONClient().post('/register_plant', {
            'uuid': test_id,
            'name': 'test plant',
            'species': 'Giant Sequoia',
            'description': '300 feet and a few thousand years old',
            'pot_size': '4'
        })
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.url, f'/manage/{test_id}')

        # Attempt to register the same UUID again, confirm expected error
        response = JSONClient().post('/register_plant', {
            'uuid': test_id,
            'name': 'second plant',
            'species': 'Redwood',
            'description': 'Wide enough to drive a car through',
            'pot_size': '4'
        })
        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.json(),
            {"error": {'uuid': ['Plant with this Uuid already exists.']}}
        )

        # Confirm only the first plant was created in database
        self.assertEqual(len(Plant.objects.all()), 1)
        self.assertEqual(Plant.objects.all()[0].name, 'test plant')

    def test_register_group_uncaught_exception_if_uuid_already_exists(self):
        '''Issue: The /register_group endpoint passed user input to the Group
        class with no error handling. If the UUID already existed in the
        database an uncaught IntegrityError was raiased resulting in 500 error
        response. This could occur if the same QR code was scanned on 2 phones,
        registered on one, and then registered on the other.

        The /register_group endpoint now returns a 409 if UUID already exists.
        '''

        # Confirm no plants in database
        self.assertEqual(len(Group.objects.all()), 0)

        # Send register_group request, confirm expected redirect response
        test_id = uuid4()
        response = JSONClient().post('/register_group', {
            'uuid': test_id,
            'name': 'test group',
            'location': 'outside',
            'description': ''
        })
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.url, f'/manage/{test_id}')

        # Attempt to register the same UUID again, confirm expected error
        response = JSONClient().post('/register_group', {
            'uuid': test_id,
            'name': 'second group',
            'location': 'inside',
            'description': ''
        })
        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.json(),
            {"error": {'uuid': ['Group with this Uuid already exists.']}}
        )

        # Confirm only the first group was created in database
        self.assertEqual(len(Group.objects.all()), 1)
        self.assertEqual(Group.objects.all()[0].name, 'test group')

    def test_register_endpoints_allow_creating_plant_and_group_with_same_uuid(self):
        '''Issue: The unique constraint on Plant and Group uuid fields only
        applied to their respective tables. If an existing Plant uuid was used
        to instantiate a Group (or vice versa) no error was thrown. This
        resulted in an inaccessible group page because the /manage endpoint
        looks up UUID in the plant table first and would never check group.

        The Plant.save and Group.save methods now prevent duplicate UUIDs.
        '''

        # Create plant and group
        plant = Plant.objects.create(uuid=uuid4(), user=get_default_user())
        group = Group.objects.create(uuid=uuid4(), user=get_default_user())
        self.assertEqual(len(Plant.objects.all()), 1)
        self.assertEqual(len(Group.objects.all()), 1)

        # Attempt to register group using plant's uuid, confirm expected error
        response = JSONClient().post('/register_group', {
            'uuid': plant.uuid,
            'name': 'second group',
            'location': 'inside',
            'description': ''
        })
        self.assertEqual(response.status_code, 409)
        self.assertEqual(
            response.json(),
            {"error": "uuid already exists in database"}
        )

        # Attempt to register plant using group's uuid, confirm expected error
        response = JSONClient().post('/register_plant', {
            'uuid': group.uuid,
            'name': 'second plant',
            'species': 'Redwood',
            'description': 'Wide enough to drive a car through',
            'pot_size': '4'
        })
        self.assertEqual(response.status_code, 409)
        self.assertEqual(
            response.json(),
            {"error": "uuid already exists in database"}
        )

        # Confirm no extra model entries were created
        self.assertEqual(len(Plant.objects.all()), 1)
        self.assertEqual(len(Group.objects.all()), 1)

    def test_edit_plant_details_fails_if_plant_has_photos(self):
        '''Issue: Plant.thumbnail_url and Plant.preview_url contained paths to
        the thumbnail and preview resolutions of most-recent photo (or default
        if configured), but they did not contain domain. This fails URLField
        validation, so once full_clean was added to /edit_plant_details (enforce
        character limits) a ValidationError was raised if photos existed. This
        prevented editing any details of plants with 1 or more photo.
        '''

        # Create plant with 1 photo
        plant = Plant.objects.create(uuid=uuid4(), user=get_default_user())
        Photo.objects.create(
            photo=create_mock_photo(
                creation_time='2024:02:21 10:52:03',
                name='photo1.jpg'
            ),
            plant=plant
        )

        # Send edit_plant request with new name
        response = JSONClient().post('/edit_plant', {
            'plant_id': plant.uuid,
            'name': 'new plant name',
            'species': '',
            'description': '',
            'pot_size': ''
        })

        # Confirm request succeeded, did not return 'Enter a valid URL' error
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {
                'name': 'new plant name',
                'display_name': 'new plant name',
                'species': None,
                'description': None,
                'pot_size': None
            }
        )


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
        plant1 = Plant.objects.create(uuid=uuid4(), name=None, user=get_default_user())
        plant2 = Plant.objects.create(uuid=uuid4(), name=None, user=get_default_user())

        # Request manage_plant page for second plant
        response = self.client.get(f'/manage/{plant2.uuid}')
        state = response.context['state']

        # Confirm display_name in context is "Unnamed plant 2"
        self.assertEqual(state['plant_details']['display_name'], 'Unnamed plant 2')

        # Give first plant a name
        plant1.name = 'My plant'
        plant1.save()

        # Request manage_plant for second plant again
        response = self.client.get(f'/manage/{plant2.uuid}')

        # Confirm display_name in context updated to "Unnamed plant 1"
        self.assertEqual(
            response.context['state']['plant_details']['display_name'],
            'Unnamed plant 1'
        )

    def test_group_name_on_manage_plant_page_updates_correctly(self):
        '''Issue: cached manage_plant state contained display_name of plant's
        group and did not update if group display_name changed (group renamed,
        or unnamed group index changed due to other unnamed group being named).
        This resulted in an outdated group name being shown in the plant
        details dropdown.

        The /manage endpoint now overwrites cached group name with current name.
        '''

        # Create unnamed group containing 1 plant
        group = Group.objects.create(uuid=uuid4(), user=get_default_user())
        plant = Plant.objects.create(uuid=uuid4(), group=group, user=get_default_user())

        # Request manage_plant page, confirm group name is "Unnamed group 1"
        response = self.client.get(f'/manage/{plant.uuid}')
        state = response.context['state']
        self.assertEqual(state['plant_details']['group']['name'], 'Unnamed group 1')

        # Give group a name
        group.name = 'Living room'
        group.save()

        # Request manage_plant page again, confirm group name was updated
        response = self.client.get(f'/manage/{plant.uuid}')
        state = response.context['state']
        self.assertEqual(state['plant_details']['group']['name'], 'Living room')

    def test_plant_options_cache_contains_outdated_plant_thumbnail_url(self):
        '''Issue: the plant_options object that populates manage_group add
        plants modal options only expired when a Plant was saved or deleted. If
        the defualt_photo was set the Plant was saved and the cache updated,
        but if there was no default_photo and a newer photo was uploaded it did
        not update (only the Photo model was saved). This resulted in outdated
        (possibly no longer existing) thumbnails in the add plant options.

        Saving or deleting a Photo now calls Plant.update_thumbnail_url, which
        updates Plant.thumbnail_url and saves (updates cached state).
        '''

        # Create test group, create test plant (not in group) with 1 photo
        default_user = get_default_user()
        group = Group.objects.create(uuid=uuid4(), user=default_user)
        plant = Plant.objects.create(uuid=uuid4(), user=default_user)
        photo1 = Photo.objects.create(
            photo=create_mock_photo(
                creation_time='2024:02:21 10:52:03',
                name='photo1.jpg'
            ),
            plant=plant
        )

        # Request manage_group page
        response = self.client.get(f'/manage/{group.uuid}')

        # Confirm options state contains photo1 thumbnail (most-recent)
        self.assertEqual(
            response.context['state']['options'][str(plant.uuid)]['thumbnail'],
            photo1.get_thumbnail_url()
        )

        # Confirm plant_options object is cached when manage_group loaded
        self.assertIsNotNone(cache.get(f'plant_options_{default_user.pk}'))

        # Create a second Photo with more recent timestamp
        photo2 = Photo.objects.create(
            photo=create_mock_photo(
                creation_time='2024:03:22 10:52:03',
                name='photo2.jpg'
            ),
            plant=plant
        )

        # Confirm manage_group state now contains photo2 thumbnail (most-recent)
        response = self.client.get(f'/manage/{group.uuid}')
        self.assertEqual(
            response.context['state']['options'][str(plant.uuid)]['thumbnail'],
            photo2.get_thumbnail_url()
        )

        # Delete second photo
        JSONClient().post('/delete_plant_photos', {
            'plant_id': str(plant.uuid),
            'delete_photos': [photo2.pk]
        })

        # Confirm manage_group state reverted to photo1 thumbnail
        response = self.client.get(f'/manage/{group.uuid}')
        self.assertEqual(
            response.context['state']['options'][str(plant.uuid)]['thumbnail'],
            photo1.get_thumbnail_url()
        )

    def test_group_options_cache_contains_outdated_number_of_plants_in_group(self):
        '''Issue: the group_options object that populates manage_plant add to
        group options only expired when a Group was saved or deleted. If plants
        were added or removed from the group (saves plant entry, but not group)
        the cached object would contain an outdated number of plants in group.

        The group_options cache is now cleared by add/remove group endpoints.
        '''

        # Create group, plant that is in group, plant that is not in group
        default_user = get_default_user()
        group = Group.objects.create(uuid=uuid4(), user=default_user)
        plant1 = Plant.objects.create(uuid=uuid4(), group=group, user=default_user)
        plant2 = Plant.objects.create(uuid=uuid4(), user=default_user)
        # Trigger group_options cache update (normally called from endpoint)
        group.save()

        # Confirm group option in manage_plant state says 1 plant in group
        response = self.client.get(f'/manage/{plant1.uuid}')
        self.assertEqual(response.context['state']['group_options'][0]['plants'], 1)

        # Add plant2 to the group
        JSONClient().post(
            '/add_plant_to_group',
            {'plant_id': plant2.uuid, 'group_id': group.uuid}
        )

        # Confirm group option in manage_plant state now says 2 plants in group
        response = self.client.get(f'/manage/{plant1.uuid}')
        self.assertEqual(response.context['state']['group_options'][0]['plants'], 2)

        # Remove plant2 from the group
        JSONClient().post('/remove_plant_from_group', {
            'plant_id': plant2.uuid
        })

        # Confirm group option in manage_plant state now says 1 plant in group
        response = self.client.get(f'/manage/{plant1.uuid}')
        self.assertEqual(response.context['state']['group_options'][0]['plants'], 1)

        # Add plant2 to group using the /bulk_add_plants_to_group endpoint
        JSONClient().post('/bulk_add_plants_to_group', {
            'group_id': group.uuid,
            'plants': [plant2.uuid]
        })

        # Confirm group option in manage_plant state now says 2 plants in group
        response = self.client.get(f'/manage/{plant1.uuid}')
        self.assertEqual(response.context['state']['group_options'][0]['plants'], 2)

        # Remove plant2 from group using the /bulk_remove_plants_from_group endpoint
        JSONClient().post('/bulk_remove_plants_from_group', {
            'group_id': group.uuid,
            'plants': [plant2.uuid]
        })

        # Confirm group option in manage_plant state now says 1 plant in group
        response = self.client.get(f'/manage/{plant1.uuid}')
        self.assertEqual(response.context['state']['group_options'][0]['plants'], 1)

    def test_update_cached_plant_options_fails_to_replace_cached_state(self):
        '''Issue: update_cached_plant_options rebuilt + cached state by calling
        models.get_plant_options, but this function only builds state if the
        expected cache key does not exist - otherwise it returns whatever is
        already cached. If the cache was not deleted before calling the
        function nothing would happen, unlike the other update_cached_*
        functions which always build the state.
        '''

        # Set dummy plant_options cache
        user_pk = get_default_user().pk
        cache.set(f'plant_options_{user_pk}', 'foo')

        # Call function, confirm dummy string was overwritten
        update_cached_plant_options(user_pk)
        self.assertNotEqual(cache.get(f'plant_options_{user_pk}'), 'foo')
        self.assertIsInstance(cache.get(f'plant_options_{user_pk}'), dict)

    def test_update_cached_group_options_fails_to_replace_cached_state(self):
        '''Issue: update_cached_group_options rebuilt + cached state by calling
        models.get_group_options, but this function only builds state if the
        expected cache key does not exist - otherwise it returns whatever is
        already cached. If the cache was not deleted before calling the
        function nothing would happen, unlike the other update_cached_*
        functions which always build the state.
        '''

        # Set dummy group_options cache
        user_pk = get_default_user().pk
        cache.set(f'group_options_{user_pk}', 'foo')

        # Call function, confirm dummy string was overwritten
        update_cached_group_options(user_pk)
        self.assertNotEqual(cache.get(f'group_options_{user_pk}'), 'foo')
        self.assertIsInstance(cache.get(f'group_options_{user_pk}'), list)

    def test_scheduled_plant_state_update_not_canceled_when_plant_deleted(self):
        '''Issue: delete_cached_manage_plant_state_hook removed cached state of
        the deleted plant but did not cancel scheduled cached state updates
        (created by update_cached_manage_plant_state_hook after plant watered,
        fertilized, etc). If a plant was deleted while a scheduled state update
        was queued an uncaught Plant.DoesNotExist exception would occur when
        the task ran.
        '''

        # Create plant, create water event for plant
        plant = Plant.objects.create(uuid=uuid4(), user=get_default_user())
        WaterEvent.objects.create(plant=plant, timestamp=timezone.now())

        # Confirm a scheduled task to rebuild plant state exists (created by
        # tasks.update_cached_manage_plant_state_hook when WaterEvent created)
        scheduled_task_id = cache.get(f'rebuild_{plant.uuid}_state_task_id')
        self.assertIsNotNone(scheduled_task_id)

        # Delete plant, confirm scheduled rebuild state task ID was deleted
        # from cache and the task itself was revoked
        with patch('plant_tracker.tasks.app.control.revoke') as mock_revoke:
            plant.delete()
            self.assertIsNone(cache.get(f'rebuild_{plant.uuid}_state_task_id'))
            mock_revoke.assert_any_call(scheduled_task_id, terminate=True)

    def test_archived_plants_added_to_main_overview_state_when_saved(self):
        '''Issue: tasks.update_instance_details_in_cached_overview_state_hook
        added/updated plant details to cached overview state whenever a plant
        was saved, without checking if it was archived (should not appear on
        main overview). This caused archived plants to be immediately added
        back to the overview state.
        '''

        # Create test plant, confirm added to cached overview state
        plant = Plant.objects.create(uuid=uuid4(), user=get_default_user())
        overview_state = cache.get(f'overview_state_{plant.user.pk}')
        self.assertIn(str(plant.uuid), overview_state['plants'])

        # Simulate user archiving plant
        response = JSONClient().post('/archive_plant', {
            'plant_id': str(plant.uuid),
            'archived': True
        })
        self.assertEqual(response.status_code, 200)

        # Confirm plant removed from overview state
        overview_state = cache.get(f'overview_state_{plant.user.pk}')
        self.assertNotIn(str(plant.uuid), overview_state['plants'])

    def test_default_photo_not_updated_in_cached_manage_plant_state(self):
        '''Issue: tasks.add_photo_to_cached_states_hook and
        tasks.remove_photo_from_cached_states_hook updated the photos key in
        cached manage_plant state but did not update the default_photo key,
        which may be outdated if the default/most-recent photo was deleted or
        the new photo is most-recent. This caused an outdated photo (possible
        no longer existing) photo in the details dropdown on next page load.
        '''

        # Create test plant, confirm cached state has no default_photo
        plant = Plant.objects.create(uuid=uuid4(), user=get_default_user())
        self.assertIsNone(
            cache.get(f'{plant.uuid}_state')['plant_details']['thumbnail']
        )
        self.assertEqual(
            cache.get(f'{plant.uuid}_state')['default_photo'],
            {
                'set': False,
                'timestamp': None,
                'image': None,
                'thumbnail': None,
                'preview': None,
                'key': None
            }
        )

        # Create photo, confirm default_photo updated in cached state
        photo = Photo.objects.create(
            photo=create_mock_photo(
                creation_time='2024:02:21 10:52:03',
                name='photo1.jpg'
            ),
            plant=plant
        )
        self.assertEqual(
            cache.get(f'{plant.uuid}_state')['plant_details']['thumbnail'],
            '/media/thumbnails/photo1_thumb.webp'
        )
        self.assertEqual(
            cache.get(f'{plant.uuid}_state')['default_photo'],
            {
                'set': False,
                'timestamp': '2024-02-21T10:52:03+00:00',
                'image': '/media/images/photo1.jpg',
                'thumbnail': '/media/thumbnails/photo1_thumb.webp',
                'preview': '/media/previews/photo1_preview.webp',
                'key': photo.pk
            }
        )

        # Delete photo, confirm default_photo updated in cached state
        photo.delete()
        self.assertIsNone(
            cache.get(f'{plant.uuid}_state')['plant_details']['thumbnail']
        )
        self.assertEqual(
            cache.get(f'{plant.uuid}_state')['default_photo'],
            {
                'set': False,
                'timestamp': None,
                'image': None,
                'thumbnail': None,
                'preview': None,
                'key': None
            }
        )


class ViewDecoratorRegressionTests(TestCase):
    def setUp(self):
        self.plant = Plant.objects.create(uuid=uuid4(), user=get_default_user())
        self.group = Group.objects.create(uuid=uuid4(), user=get_default_user())

    def test_get_plant_from_post_body_traps_wrapped_function_exceptions(self):
        '''Issue: get_plant_from_post_body called the wrapped function inside a
        try/except block used to handle request payload errors. If an uncaught
        exception occurred in the wrapped function it would be caught by the
        wrapper, resulting in a JsonResponse with misleading error.
        '''

        # Create test functions that raise errors caught by decorator
        @get_plant_from_post_body
        def test_key_error(plant, **kwargs):
            raise KeyError("wrapped function error")

        @get_plant_from_post_body
        def test_validation_error(plant, **kwargs):
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
        def test_key_error(group, **kwargs):
            raise KeyError("wrapped function error")

        @get_group_from_post_body
        def test_validation_error(group, **kwargs):
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
        def test_key_error(timestamp, **kwargs):
            raise KeyError("wrapped function error")

        @get_timestamp_from_post_body
        def test_value_error(timestamp, **kwargs):
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
        def test_key_error(event_type, **kwargs):
            raise KeyError("wrapped function error")

        # Exceptions should not be caught by the decorator
        # Confirm exceptions were raised by wrapped function and not decorator
        with self.assertRaises(KeyError) as e:
            test_key_error({'event_type': 'water'})
        self.assertEqual(e.exception.args[0], "wrapped function error")


class DatabaseRaceConditionRegressionTests(TransactionTestCase):
    def test_simultaneous_requests_create_duplicate_water_events(self):
        '''Issue: If two identical events were created simultaneously the Event
        model save method would fail to reject the duplicate timestamp because
        it relied on a database SELECT to see if a duplicate existed (instead of
        a database-level constraint). If both lookups ran before either event
        was committed they would both find 0 matches, allowing both events to be
        created.
        '''

        # Create test plant + fixed timestamp
        plant = Plant.objects.create(uuid=uuid4(), user=get_default_user())
        timestamp = timezone.now()

        def create_water_event():
            try:
                WaterEvent.objects.create(
                    plant=plant,
                    timestamp=timestamp
                )
            except IntegrityError:
                pass
            finally:
                # Close database connection (fix hanging at end of test)
                connections.close_all()

        # Create 2 identical events simultaneously in separate threads
        thread_1 = threading.Thread(target=create_water_event)
        thread_2 = threading.Thread(target=create_water_event)
        thread_1.start()
        thread_2.start()
        thread_1.join()
        thread_2.join()

        # Confirm only 1 event was created
        self.assertEqual(
            len(WaterEvent.objects.filter(plant=plant, timestamp=timestamp)),
            1
        )
