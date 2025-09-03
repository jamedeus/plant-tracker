# pylint: disable=missing-docstring,R0801,too-many-lines,global-statement

import threading
from uuid import uuid4
from types import NoneType
from datetime import datetime

from django.conf import settings
from django.utils import timezone
from django.core.cache import cache
from django.contrib.auth import get_user_model
from django.test.client import MULTIPART_CONTENT
from django.db import IntegrityError, connections
from django.core.exceptions import ValidationError
from django.test import TestCase, TransactionTestCase, Client

from .get_state_views import build_overview_state, get_overview_state
from .models import (
    Group,
    Plant,
    Photo,
    WaterEvent,
    FertilizeEvent,
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
    enable_isolated_media_root,
    cleanup_isolated_media_root,
)


OVERRIDE = None
MODULE_MEDIA_ROOT = None


def setUpModule():
    global OVERRIDE, MODULE_MEDIA_ROOT
    OVERRIDE, MODULE_MEDIA_ROOT = enable_isolated_media_root()


def tearDownModule():
    # Delete mock photo directory after tests
    print("\nDeleting mock photos...\n")
    cleanup_isolated_media_root(OVERRIDE, MODULE_MEDIA_ROOT)


class ModelRegressionTests(TestCase):
    def setUp(self):
        # Clear entire cache before each test
        cache.clear()

        self.user = get_default_user()

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
            'user_1/thumbnails/photo.of.my.plant.flowering_thumb.webp'
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

        # Sign in as user2, request manage_plant state
        client = Client()
        client.login(username='user2', password='123')
        response = client.get(
            f'/get_manage_state/{plant2.uuid}',
            HTTP_ACCEPT='application/json'
        )

        # Confirm plant name is "Unnamed plant 1", not 2
        self.assertEqual(
            response.json()['state']['plant_details']['display_name'],
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


class ModelRegressionTestsTransaction(TransactionTestCase):
    '''For model regression tests that need database transactions to actually
    be committed to reproduce (uses TransactionTestCase instead of TestCase).
    '''

    def setUp(self):
        # Clear entire cache before each test
        cache.clear()

        # Ensure default user exists (may already exist from migrations)
        self.user, _ = get_user_model().objects.get_or_create(username=settings.DEFAULT_USERNAME)

        # Clear cached user instance
        get_default_user.cache_clear()

    def test_unable_to_delete_plant_with_default_photo(self):
        '''Issue: Since e105bd3e Plant.delete removes all associated Photos with
        _raw_delete before plant itself is deleted (bypasses post_delete signals
        that would run for each photo if removed by Plant.delete cascading).
        This also bypassed on_delete=models.SET_NULL on Plant.default_photo,
        leaving plant with a ForeignKey to a non-existing photo, which triggered
        an uncaught IntegrityError. This was fixed by wrapping everything in a
        single transaction so the plant and photo are deleted at the same time.
        '''

        # Create plant with default photo
        plant = Plant.objects.create(uuid=uuid4(), user=get_default_user())
        photo = Photo.objects.create(
            photo=create_mock_photo(name='photo.of.my.plant.flowering.jpg'),
            plant=plant
        )
        plant.default_photo = photo
        plant.save()

        # Delete plant, should not raise IntegrityError
        response = JSONClient().post('/bulk_delete_plants_and_groups', {
            'uuids': [str(plant.uuid)]
        })
        self.assertEqual(response.status_code, 200)


class ViewRegressionTests(TestCase):
    def setUp(self):
        # Clear entire cache before each test
        cache.clear()

    def tearDown(self):
        # Revert back to SINGLE_USER_MODE
        settings.SINGLE_USER_MODE = True

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

        # Request should succeed despite conflicting event
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {
                "action": "water",
                "timestamp": timestamp.isoformat(),
                "plants": [
                    str(plant1.uuid),
                    str(plant2.uuid),
                    str(plant3.uuid)
                ],
                "failed": []
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
        response = self.client.get(
            f'/get_manage_state/{uuid4()}',
            HTTP_ACCEPT='application/json'
        )
        self.assertEqual(response.status_code, 200)

        # Confirm response does NOT contain changing_qr_code key (causes register
        # to show confirm QR prompt since merged with confirm_new_qr_code page)
        self.assertNotIn('changing_qr_code', response.json()['state'])

        # Confirm cache was cleared
        self.assertIsNone(cache.get(f'old_uuid_{get_default_user().pk}'))

    def test_edit_plant_details_crashes_when_pot_size_is_null(self):
        '''Issue: The /edit_plant_details endpoint returns a modified version of
        the payload it received, which previously cast the pot_size param to int
        with no error handling. If the pot_size field was not filled in this
        resulted in a TypeError when None was passed to int().

        The frontend now handles both string and integer values for pot_size,
        the backend returns pot_size unchanged.
        '''

        # Create test plant
        plant = Plant.objects.create(uuid=uuid4(), user=get_default_user())

        # Post details with blank pot_size to /edit_plant_details endpoint
        response = JSONClient().post('/edit_plant_details', {
            'plant_id': plant.uuid,
            'name': 'test plant',
            'species': 'Giant Sequoia',
            'description': '',
            'pot_size': ''
        })

        # Post details with string pot_size to /edit_plant_details endpoint
        response = JSONClient().post('/edit_plant_details', {
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
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'success': 'plant registered'})

        # Attempt to register the same UUID again, confirm expected error
        response = JSONClient().post('/register_plant', {
            'uuid': test_id,
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
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'success': 'group registered'})

        # Attempt to register the same UUID again, confirm expected error
        response = JSONClient().post('/register_group', {
            'uuid': test_id,
            'name': 'second group',
            'location': 'inside',
            'description': ''
        })
        self.assertEqual(response.status_code, 409)
        self.assertEqual(
            response.json(),
            {"error": "uuid already exists in database"}
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

        # Send edit_plant_details request with new name
        response = JSONClient().post('/edit_plant_details', {
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

    def test_number_of_plants_in_group_does_not_update_in_cached_overview_state(self):
        '''Issue: The endpoints that add/remove plants to/from groups scheduled
        a cached group_options update but did not update the groups details (new
        number of plants) in cached overview state. Since these endpoints only
        save the plant entry (add group ForeignKey) they did not trigger the
        Group post_save signal that does this either.
        '''

        # Create plant and group
        plant = Plant.objects.create(uuid=uuid4(), user=get_default_user())
        group = Group.objects.create(uuid=uuid4(), user=get_default_user())

        # Confirm cached overview state says group has 0 plants
        overview_state = build_overview_state(get_default_user())
        self.assertEqual(overview_state['groups'][str(group.uuid)]['plants'], 0)

        # Send add_plant_to_group request
        response = JSONClient().post('/add_plant_to_group', {
            'plant_id': plant.uuid,
            'group_id': group.uuid
        })
        self.assertEqual(response.status_code, 200)

        # Confirm cached overview state says group has 1 plants
        overview_state = cache.get(f'overview_state_{get_default_user().pk}')
        self.assertEqual(overview_state['groups'][str(group.uuid)]['plants'], 1)

        # Send add_plant_to_group request
        response = JSONClient().post('/remove_plant_from_group', {
            'plant_id': plant.uuid
        })
        self.assertEqual(response.status_code, 200)

        # Confirm cached overview state says group has 0 plants
        overview_state = cache.get(f'overview_state_{get_default_user().pk}')
        self.assertEqual(overview_state['groups'][str(group.uuid)]['plants'], 0)

        # Send bulk_add_plants_to_group request
        response = JSONClient().post('/bulk_add_plants_to_group', {
            'group_id': group.uuid,
            'plants': [plant.uuid]
        })
        self.assertEqual(response.status_code, 200)

        # Confirm cached overview state says group has 1 plants
        overview_state = cache.get(f'overview_state_{get_default_user().pk}')
        self.assertEqual(overview_state['groups'][str(group.uuid)]['plants'], 1)

        # Send bulk_remove_plants_from_group request
        response = JSONClient().post('/bulk_remove_plants_from_group', {
            'group_id': group.uuid,
            'plants': [plant.uuid]
        })
        self.assertEqual(response.status_code, 200)

        # Confirm cached overview state says group has 0 plants
        overview_state = cache.get(f'overview_state_{get_default_user().pk}')
        self.assertEqual(overview_state['groups'][str(group.uuid)]['plants'], 0)

    def test_overview_does_not_break_if_plants_have_photos(self):
        '''Issue: While optimizing postgres queries a bad annotation was written
        that saved the wrong attribute of most-recent photo. This was done while
        using a test fixture where no plants had photos, and unit tests did not
        catch it because they never request overview state with photos
        '''

        # Create plant, add photo with /add_plant_photos endpoint
        plant = Plant.objects.create(uuid=uuid4(), user=get_default_user())
        response = self.client.post(
            '/add_plant_photos',
            data={
                'plant_id': str(plant.uuid),
                'photo_0': create_mock_photo('2024:02:21 10:52:03', 'photo1.jpg')
            },
            content_type=MULTIPART_CONTENT
        )
        self.assertEqual(response.status_code, 200)
        photo = Photo.objects.all()[0]

        # Request overview page state, should not raise exception
        response = self.client.get('/get_overview_state')
        self.assertEqual(response.status_code, 200)

        # Confirm state contains plant details and correct thumbnail
        self.assertEqual(
            response.json(),
            {
                'plants': {
                    str(plant.uuid): {
                        'name': None,
                        'display_name': 'Unnamed plant 1',
                        'uuid': str(plant.uuid),
                        'archived': False,
                        'created': plant.created.isoformat(),
                        'species': None,
                        'description': None,
                        'pot_size': None,
                        'last_watered': None,
                        'last_fertilized': None,
                        'thumbnail': photo.thumbnail.url,
                        'group': None
                    }
                },
                'groups': {},
                'show_archive': False,
                'title': 'Plant Overview'
            }
        )

    def test_should_not_be_able_to_add_other_users_plants_to_group(self):
        '''Issue: The /bulk_add_plants_to_group endpoint checked group ownership
        (get_group_from_post_body decorator) but did not check plant ownership
        (uuids in payload, no automatic decorator check). This allowed a user to
        add other user's plants to their groups if the UUID was known.
        '''

        # Disable SINGLE_USER_MODE
        settings.SINGLE_USER_MODE = False

        # Create 2 test users + group owned by user1, plant owned by user2
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
        group = Group.objects.create(uuid=uuid4(), user=user1)
        plant = Plant.objects.create(uuid=uuid4(), user=user2)

        # Sign in as user1
        client = JSONClient()
        client.login(username='user1', password='123')

        # Attempt to add user2's plant to user1's group
        response = client.post('/bulk_add_plants_to_group', {
            'group_id': group.uuid,
            'plants': [plant.uuid]
        })
        self.assertEqual(response.status_code, 200)

        # Confirm failed to add plant to group
        self.assertEqual(response.json(), {'added': [], 'failed': [str(plant.uuid)]})
        plant.refresh_from_db()
        self.assertIsNone(plant.group)

    def test_should_not_be_able_to_remove_other_users_plants_from_groups(self):
        '''Issue: The /bulk_remove_plants_from_group endpoint checked group
        ownership (get_group_from_post_body decorator) but did not check plant
        ownership (uuids in payload, no automatic decorator check). This allowed
        a user to remove other user's plants from groups if the UUID was known.
        '''

        # Disable SINGLE_USER_MODE
        settings.SINGLE_USER_MODE = False

        # Create 2 test users with 1 group each
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
        user1_group = Group.objects.create(uuid=uuid4(), user=user1)
        user2_group = Group.objects.create(uuid=uuid4(), user=user2)

        # Create plant for user2 that is in group
        plant = Plant.objects.create(uuid=uuid4(), user=user2, group=user2_group)

        # Sign in as user1
        client = JSONClient()
        client.login(username='user1', password='123')

        # Attempt to remove user2's plant from group
        response = client.post('/bulk_remove_plants_from_group', {
            'group_id': user1_group.uuid,
            'plants': [plant.uuid]
        })
        self.assertEqual(response.status_code, 200)

        # Confirm failed to remove plant
        self.assertEqual(response.json(), {'removed': [], 'failed': [str(plant.uuid)]})
        plant.refresh_from_db()
        self.assertIsNotNone(plant.group)

    def test_division_in_progress_breaks_if_parent_uuid_changed(self):
        '''Issue: /divide_plant saves UUID of plant being divided in cache which
        is read by views.render_registration_page and used to look up plant. If
        UUID was changed after beginning division the cached would be outdated,
        no plant would be found, and requesting the registration page would
        result in an AttributeError. The /change_uuid endpoint now updates the
        cached UUID if it exists.
        '''

        # Create plant, start dividing
        plant = Plant.objects.create(uuid=uuid4(), user=get_default_user())
        response = JSONClient().post('/divide_plant', {
            'plant_id': plant.uuid,
            'timestamp': '2024-02-06T03:06:26.000Z'
        })
        self.assertEqual(response.status_code, 200)

        # Confirm plant UUID was cached
        dividing = cache.get(f'division_in_progress_{get_default_user().pk}')
        self.assertEqual(dividing['divided_from_plant_uuid'], str(plant.uuid))

        # Simulate user changing plant's uuid
        cache.set(f'old_uuid_{get_default_user().pk}', str(plant.uuid), 900)
        new_uuid = uuid4()
        response = JSONClient().post('/change_uuid', {
            'uuid': str(plant.uuid),
            'new_id': str(new_uuid)
        })
        self.assertEqual(response.status_code, 200)

        # Confirm cached uuid was updated
        dividing = cache.get(f'division_in_progress_{get_default_user().pk}')
        self.assertEqual(dividing['divided_from_plant_uuid'], str(new_uuid))

        # Confirm loading registration page does not return 500 error
        response = self.client.get(f'/manage/{uuid4()}')
        self.assertEqual(response.status_code, 200)

    def test_division_in_progress_breaks_if_parent_deleted(self):
        '''Issue: views.render_registration_page queried Plant with UUID from
        cache set by /divide_plant then blindly called methods on the returned
        instance. If plant had been deleted query would return None, resulting
        in AttributeError when methods were called on None and a 500 response to
        client. The render_registration_page function now checks if plant found.
        '''

        # Create plant, start dividing
        plant = Plant.objects.create(uuid=uuid4(), user=get_default_user())
        response = JSONClient().post('/divide_plant', {
            'plant_id': plant.uuid,
            'timestamp': '2024-02-06T03:06:26.000Z'
        })
        self.assertEqual(response.status_code, 200)

        # Confirm plant UUID was cached
        dividing = cache.get(f'division_in_progress_{get_default_user().pk}')
        self.assertEqual(dividing['divided_from_plant_uuid'], str(plant.uuid))

        # Delete plant
        plant.delete()

        # Request registration page, confirm does not return 500 error
        response = self.client.get(f'/manage/{uuid4()}')
        self.assertEqual(response.status_code, 200)


class CachedStateRegressionTests(TestCase):
    def setUp(self):
        # Clear entire cache before each test
        cache.clear()

    def tearDown(self):
        # Revert back to SINGLE_USER_MODE
        settings.SINGLE_USER_MODE = True

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

        # Request manage_plant state for second plant
        response = self.client.get(
            f'/get_manage_state/{plant2.uuid}',
            HTTP_ACCEPT='application/json'
        )
        state = response.json()['state']

        # Confirm display_name in context is "Unnamed plant 2"
        self.assertEqual(state['plant_details']['display_name'], 'Unnamed plant 2')

        # Give first plant a name
        plant1.name = 'My plant'
        plant1.save()

        # Request manage_plant state for second plant again
        response = self.client.get(
            f'/get_manage_state/{plant2.uuid}',
            HTTP_ACCEPT='application/json'
        )

        # Confirm display_name in context updated to "Unnamed plant 1"
        self.assertEqual(
            response.json()['state']['plant_details']['display_name'],
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

        # Request manage_plant state, confirm group name is "Unnamed group 1"
        response = self.client.get(
            f'/get_manage_state/{plant.uuid}',
            HTTP_ACCEPT='application/json'
        )
        state = response.json()['state']
        self.assertEqual(state['plant_details']['group']['name'], 'Unnamed group 1')

        # Give group a name
        group.name = 'Living room'
        group.save()

        # Request manage_plant state again, confirm group name was updated
        response = self.client.get(
            f'/get_manage_state/{plant.uuid}',
            HTTP_ACCEPT='application/json'
        )
        state = response.json()['state']
        self.assertEqual(state['plant_details']['group']['name'], 'Living room')

    def test_archived_plants_added_to_main_overview_state_when_saved(self):
        '''Issue: tasks.update_instance_details_in_cached_overview_state_hook
        added/updated plant details to cached overview state whenever a plant
        was saved, without checking if it was archived (should not appear on
        main overview). This caused archived plants to be immediately added
        back to the overview state.
        '''

        # Create test plant, confirm added to cached overview state
        plant = Plant.objects.create(uuid=uuid4(), user=get_default_user())
        overview_state = build_overview_state(get_default_user())
        self.assertIn(str(plant.uuid), overview_state['plants'])

        # Simulate user archiving plant
        response = JSONClient().post('/bulk_archive_plants_and_groups', {
            'uuids': [str(plant.uuid),],
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

        # Create test plant
        plant = Plant.objects.create(uuid=uuid4(), user=get_default_user())

        # Request state, confirm state has no default_photo
        response = self.client.get(
            f'/get_manage_state/{plant.uuid}',
            HTTP_ACCEPT='application/json'
        )
        self.assertIsNone(response.json()['state']['plant_details']['thumbnail'])
        self.assertEqual(
            response.json()['state']['default_photo'],
            {
                'set': False,
                'timestamp': None,
                'photo': None,
                'thumbnail': None,
                'preview': None,
                'key': None
            }
        )

        # Create photo with /add_plant_photos endpoint
        response = JSONClient().post(
            '/add_plant_photos',
            data={
                'plant_id': str(plant.uuid),
                'photo_0': create_mock_photo('2024:02:21 10:52:03', 'photo1.jpg')
            },
            content_type=MULTIPART_CONTENT
        )
        self.assertEqual(response.status_code, 200)
        photo = Photo.objects.all()[0]

        # Request state again, confirm default_photo updated
        response = self.client.get(
            f'/get_manage_state/{plant.uuid}',
            HTTP_ACCEPT='application/json'
        )
        self.assertEqual(
            response.json()['state']['plant_details']['thumbnail'],
            '/media/user_1/thumbnails/photo1_thumb.webp'
        )
        self.assertEqual(
            response.json()['state']['default_photo'],
            {
                'set': False,
                'timestamp': '2024-02-21T10:52:03+00:00',
                'photo': '/media/user_1/images/photo1.jpg',
                'thumbnail': '/media/user_1/thumbnails/photo1_thumb.webp',
                'preview': '/media/user_1/previews/photo1_preview.webp',
                'key': photo.pk
            }
        )

        # Delete photo with /delete_plant_photos endpoint
        response = JSONClient().post('/delete_plant_photos', {
            'plant_id': str(plant.uuid),
            'delete_photos': [
                photo.pk
            ]
        })

        # Request state again, confirm default_photo updated
        response = self.client.get(
            f'/get_manage_state/{plant.uuid}',
            HTTP_ACCEPT='application/json'
        )
        self.assertIsNone(response.json()['state']['plant_details']['thumbnail'])
        self.assertEqual(
            response.json()['state']['default_photo'],
            {
                'set': False,
                'timestamp': None,
                'photo': None,
                'thumbnail': None,
                'preview': None,
                'key': None
            }
        )

    def test_watering_plant_removes_group_key_from_cached_state(self):
        '''Issue: the manage_plant state `plant_details` key (dict returned by
        Plant.get_details) had an extra key `group` (added after building dict).
        When get_manage_plant_state loaded state from cache the `name` key under
        `group` was overwritten (name may have changed). When plant was watered
        or fertilized tasks.update_last_event_times_in_cached_states_hook
        replaced the entire `plant_details` dict with Plant.get_details without
        replacing the group key. This caused a KeyError the next time state was
        loaded (looking for ['plant_details']['group']['name']).

        The dict returned by Plant.get_details now contains full group details
        (ensure consistent keys everywhere the dict is used).
        '''

        # Create plant that is in group
        default_user = get_default_user()
        group = Group.objects.create(uuid=uuid4(), user=default_user)
        plant = Plant.objects.create(uuid=uuid4(), group=group, user=default_user)

        # Request manage plant state, confirm context contains group details
        response = self.client.get(
            f'/get_manage_state/{plant.uuid}',
            HTTP_ACCEPT='application/json'
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json()['state']['plant_details']['group'],
            plant.get_group_details()
        )

        # Water plant to trigger signal that broke cached state
        response = JSONClient().post('/add_plant_event', {
            'plant_id': plant.uuid,
            'event_type': 'water',
            'timestamp': '2024-02-06T03:06:26.000Z'
        })
        self.assertEqual(response.status_code, 200)

        # Request manage plant state again, confirm group details not removed
        response = self.client.get(
            f'/get_manage_state/{plant.uuid}',
            HTTP_ACCEPT='application/json'
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json()['state']['plant_details']['group'],
            plant.get_group_details()
        )

    def test_group_uuid_does_not_update_in_cached_manage_plant_state(self):
        '''Issue: the manage_plant state contained the name and uuid of plant's
        group under ['plant_details']['group']. When get_manage_plant_state
        loaded state from cache it overwrote the cached group name (may have
        changed) but did not overwrite the uuid. This caused the group link to
        break on all manage_plant pages when the group QR code was changed.

        The get_manage_plant_state function now overwrites entire group key
        (name and uuid) and does not keep any cached group details.
        '''

        # Create plant that is in group
        default_user = get_default_user()
        group = Group.objects.create(uuid=uuid4(), user=default_user)
        plant = Plant.objects.create(uuid=uuid4(), group=group, user=default_user)

        # Request manage plant state, confirm context contains correct group uuid
        response = self.client.get(
            f'/get_manage_state/{plant.uuid}',
            HTTP_ACCEPT='application/json'
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json()['state']['plant_details']['group']['uuid'],
            str(group.uuid)
        )

        # Change group uuid
        new_uuid = uuid4()
        response = JSONClient().post('/change_uuid', {
            'uuid': str(group.uuid),
            'new_id': str(new_uuid)
        })
        self.assertEqual(
            response.json(),
            {"new_uuid": str(new_uuid)}
        )
        self.assertEqual(response.status_code, 200)

        # Request manage plant state again, confirm group uuid updated
        response = self.client.get(
            f'/get_manage_state/{plant.uuid}',
            HTTP_ACCEPT='application/json'
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json()['state']['plant_details']['group']['uuid'],
            str(new_uuid)
        )

    def test_changing_uuid_creates_duplicate_in_cached_overview_state(self):
        '''Issue: the Plant and Group post_save signals added new plant/group
        uuid key to cached overview state, but did not remove the old entry.
        These hooks assume they will overwrite outdated details of the same
        plant/group - but since keys are uuids they just create a duplicate
        entry when the uuid is changed (can't target old uuid).

        The /change_uuid endpoint now deletes the existing uuid from the cached
        state before changing (hooks then re-add with the new uuid).
        '''

        # Create plant and group, confirm both exist in cached overview state
        default_user = get_default_user()
        group = Group.objects.create(uuid=uuid4(), user=default_user)
        plant = Plant.objects.create(uuid=uuid4(), user=default_user)
        overview_state = build_overview_state(default_user)
        self.assertIn(str(plant.uuid), overview_state['plants'])
        self.assertIn(str(group.uuid), overview_state['groups'])
        self.assertEqual(len(overview_state['plants']), 1)
        self.assertEqual(len(overview_state['groups']), 1)

        # Change both uuids
        response = JSONClient().post('/change_uuid', {
            'uuid': str(plant.uuid),
            'new_id': str(uuid4())
        })
        self.assertEqual(response.status_code, 200)
        response = JSONClient().post('/change_uuid', {
            'uuid': str(group.uuid),
            'new_id': str(uuid4())
        })
        self.assertEqual(response.status_code, 200)

        # Confirm old UUIDs were removed from cached state (replaced with new)
        plant.refresh_from_db()
        group.refresh_from_db()
        overview_state = cache.get(f'overview_state_{default_user.pk}')
        self.assertIn(str(plant.uuid), overview_state['plants'])
        self.assertIn(str(group.uuid), overview_state['groups'])
        self.assertEqual(len(overview_state['plants']), 1)
        self.assertEqual(len(overview_state['groups']), 1)

    def test_group_number_of_plants_outdated_in_cache_if_plant_deleted(self):
        '''Issue: group details (including number of plants) was updated in
        cached overview state and group_options when plants were added/removed
        to/from group, but not when plants in group were deleted.
        '''

        # Create group with 1 plant
        user = get_default_user()
        group = Group.objects.create(uuid=uuid4(), user=user)
        plant = Plant.objects.create(uuid=uuid4(), group=group, user=user)

        # Confirm overview state says 1 plant in group
        self.assertEqual(
            build_overview_state(user)['groups'][str(group.uuid)]['plants'],
            1
        )

        # Delete plant, confirm both cached states now say 0 plants in group
        JSONClient().post('/bulk_delete_plants_and_groups', {
            'uuids': [str(plant.uuid)]
        })
        self.assertEqual(
            cache.get(f'overview_state_{user.pk}')['groups'][str(group.uuid)]['plants'],
            0
        )

    def test_new_plant_events_are_sorted_chronologically_in_cached_state(self):
        '''Issue: tasks.add_new_event_to_cached_manage_plant_state_hook appended
        new events to the correct events list in manage_plant state, but did not
        sort the list (unlike Plant._get_all_timestamps used when generating new
        state). The frontend depends on these lists to be in chronological order
        (gets last_watered/fertilized by grabbing first item, history modal does
        not sort, etc).
        '''

        # Create plant with 2 water events
        plant = Plant.objects.create(uuid=uuid4(), user=get_default_user())
        WaterEvent.objects.create(
            plant=plant,
            timestamp=datetime.fromisoformat('2024-03-06T03:06:26.000Z')
        )
        WaterEvent.objects.create(
            plant=plant,
            timestamp=datetime.fromisoformat('2024-01-06T03:06:26.000Z')
        )

        # Request manage plant state, confirm water events are sorted chronologically
        response = self.client.get(
            f'/get_manage_state/{plant.uuid}',
            HTTP_ACCEPT='application/json'
        )
        self.assertEqual(
            response.json()['state']['events']['water'],
            [
                '2024-03-06T03:06:26+00:00',
                '2024-01-06T03:06:26+00:00'
            ]
        )

        # Create new WaterEvent with timestamp in between existing 2
        WaterEvent.objects.create(
            plant=plant,
            timestamp=datetime.fromisoformat('2024-02-06T03:06:26.000Z')
        )

        # Request manage plant state, confirm new event is sorted chronologically
        response = self.client.get(
            f'/get_manage_state/{plant.uuid}',
            HTTP_ACCEPT='application/json'
        )
        self.assertEqual(
            response.json()['state']['events']['water'],
            [
                '2024-03-06T03:06:26+00:00',
                '2024-02-06T03:06:26+00:00',
                '2024-01-06T03:06:26+00:00'
            ]
        )

    def test_cached_last_fertilized_time_does_not_update_when_water_also_deleted(self):
        '''Issue: /bulk_delete_plant_events used if elif to check if water and
        fertilize respectively were deleted (instead of 2 ifs). If both were
        deleted only the last_watered time would be updated, instead of both.
        '''

        # Create plant with water and fertilize events
        user = get_default_user()
        plant = Plant.objects.create(uuid=uuid4(), user=user)
        WaterEvent.objects.create(
            plant=plant,
            timestamp=datetime.fromisoformat('2024-03-06T03:06:26.000Z')
        )
        FertilizeEvent.objects.create(
            plant=plant,
            timestamp=datetime.fromisoformat('2024-01-06T03:06:26.000Z')
        )

        # Confirm overview state has last_watered and last_fertilized times
        overview_state = build_overview_state(user)
        self.assertIsNotNone(overview_state['plants'][str(plant.uuid)]['last_watered'])
        self.assertIsNotNone(overview_state['plants'][str(plant.uuid)]['last_fertilized'])

        # Delete both events in a single request
        JSONClient().post('/bulk_delete_plant_events', {
            'plant_id': plant.uuid,
            'events': {
                'water': ['2024-03-06T03:06:26.000Z'],
                'fertilize': ['2024-01-06T03:06:26.000Z'],
                'prune': [],
                'repot': [],
            }
        })

        # Confirm overview state cleared last_watered AND last_fertilized
        self.assertIsNone(
            cache.get(f'overview_state_{user.pk}')['plants'][str(plant.uuid)]['last_watered'],
        )
        self.assertIsNone(
            cache.get(f'overview_state_{user.pk}')['plants'][str(plant.uuid)]['last_fertilized'],
        )

    def test_cached_overview_state_show_archive_bool_does_not_update_when_plant_archived(self):
        '''Issue: The show_archive bool that controls whether dropdown contains
        link to archive overview did not update in cached overview state when a
        plant/group was archived/unarchived. Once something was archived it was
        inaccessible until the state was rebuilt. If the last archived item was
        unarchived the dropdown would still show the link to archive overview.
        '''

        # Create plant and group
        user = get_default_user()
        plant = Plant.objects.create(uuid=uuid4(), user=user)
        group = Group.objects.create(uuid=uuid4(), user=user)

        # Confirm show_archive is False in cached overview state
        self.assertFalse(get_overview_state(user)['show_archive'])

        # Archive plant, confirm show_archive is True in cached overview state
        JSONClient().post('/bulk_archive_plants_and_groups', {
            'uuids': [str(plant.uuid)],
            'archived': True
        })
        self.assertTrue(get_overview_state(user)['show_archive'])

        # Unarchive plant, confirm show_archive is False in cached overview state
        JSONClient().post('/bulk_archive_plants_and_groups', {
            'uuids': [str(plant.uuid)],
            'archived': False
        })
        self.assertFalse(get_overview_state(user)['show_archive'])

        # Archive group, confirm show_archive is True in cached overview state
        JSONClient().post('/bulk_archive_plants_and_groups', {
            'uuids': [str(group.uuid)],
            'archived': True
        })
        self.assertTrue(get_overview_state(user)['show_archive'])

        # Unarchive group, confirm show_archive is False in cached overview state
        JSONClient().post('/bulk_archive_plants_and_groups', {
            'uuids': [str(group.uuid)],
            'archived': False
        })
        self.assertFalse(get_overview_state(user)['show_archive'])

    def test_cached_overview_state_show_archive_bool_does_not_update_when_plant_deleted(self):
        '''Issue: The show_archive bool that controls whether dropdown contains
        link to archive overview did not update in cached overview state when a
        plant/group was deleted. If the last archived item was deleted the link
        to archive overview would still appear in overview dropdown.
        '''

        # Create archived plant
        user = get_default_user()
        plant = Plant.objects.create(uuid=uuid4(), user=user, archived=True)

        # Confirm show_archive is True in cached overview state
        self.assertTrue(get_overview_state(user)['show_archive'])

        # Delete plant, confirm show_archive is False in cached overview state
        JSONClient().post('/bulk_delete_plants_and_groups', {
            'uuids': [str(plant.uuid)]
        })
        self.assertFalse(get_overview_state(user)['show_archive'])

        # Create archived group, delete cached state (does not update when
        # archived entry created with arg, not possible in production)
        group = Group.objects.create(uuid=uuid4(), user=user, archived=True)
        cache.delete(f'overview_state_{user.pk}')

        # Rebuild cached overview state, confirm show_archive is True
        self.assertTrue(get_overview_state(user)['show_archive'])

        # Delete group, confirm show_archive is False in cached overview state
        JSONClient().post('/bulk_delete_plants_and_groups', {
            'uuids': [str(group.uuid)]
        })
        self.assertFalse(get_overview_state(user)['show_archive'])

    def test_plant_name_does_not_update_on_overview_page_when_details_edited(self):
        '''Issue: The /edit_plant_details endpoint incorrectly set the name key
        to plant.get_display_name() and did not update the display_name key. The
        frontend only reads the display_name key, so the name did not update on
        the overview page. Writing display_name to name is also incorrect (can
        be different, ie if name is null display_name is "Unnamed plant X").
        '''

        # Create unnamed plant
        user = get_default_user()
        plant = Plant.objects.create(uuid=uuid4(), user=user)

        # Confirm name is unset, display_name is "Unnamed plant 1" in overview state
        self.assertIsNone(get_overview_state(user)['plants'][str(plant.uuid)]['name'])
        self.assertEqual(
            get_overview_state(user)['plants'][str(plant.uuid)]['display_name'],
            'Unnamed plant 1'
        )

        # Send edit_plant_details request with new name
        JSONClient().post('/edit_plant_details', {
            'plant_id': str(plant.uuid),
            'name': 'new plant name',
            'species': '',
            'description': '',
            'pot_size': ''
        })

        # Confirm both name and display_name keys were updated in overview state
        self.assertEqual(
            get_overview_state(user)['plants'][str(plant.uuid)]['name'],
            'new plant name'
        )
        self.assertEqual(
            get_overview_state(user)['plants'][str(plant.uuid)]['display_name'],
            'new plant name'
        )

    def test_group_name_does_not_update_on_overview_page_when_details_edited(self):
        '''Issue: The /edit_group_details endpoint incorrectly set the name key
        to group.get_display_name() and did not update the display_name key. The
        frontend only reads the display_name key, so the name did not update on
        the overview page. Writing display_name to name is also incorrect (can
        be different, ie if name is null display_name is "Unnamed group X").
        '''

        # Create unnamed group
        user = get_default_user()
        group = Group.objects.create(uuid=uuid4(), user=user)

        # Confirm name is unset, display_name is "Unnamed group 1" in overview state
        self.assertIsNone(get_overview_state(user)['groups'][str(group.uuid)]['name'])
        self.assertEqual(
            get_overview_state(user)['groups'][str(group.uuid)]['display_name'],
            'Unnamed group 1'
        )

        # Send edit_group_details request with new name
        JSONClient().post('/edit_group_details', {
            'group_id': str(group.uuid),
            'name': 'new group name',
            'location': '',
            'description': ''
        })

        # Confirm both name and display_name keys were updated in overview state
        self.assertEqual(
            get_overview_state(user)['groups'][str(group.uuid)]['name'],
            'new group name'
        )
        self.assertEqual(
            get_overview_state(user)['groups'][str(group.uuid)]['display_name'],
            'new group name'
        )

    def test_overview_title_does_not_update_when_user_details_changed(self):
        '''Issue: Since the SPA refactor the cached overview state contains the
        title used for the page and navbar. If the user's name is set the title
        changes to "<Name>'s Plants, but the /edit_user_details endpoint did not
        update the title in the cached overview state.
        '''

        # Disable SINGLE_USER_MODE (overview always uses generic title)
        settings.SINGLE_USER_MODE = False

        # Create user with no first name
        user = get_user_model().objects.create_user(
            username='unittest',
            password='12345',
            first_name='',
            last_name='',
            email='carlosdanger@hotmail.com'
        )

        # Confirm cached overview state has generic title (user has no name)
        self.assertEqual(get_overview_state(user)['title'], 'Plant Overview')

        # Send edit_user_details request to update default user's name
        self.client.login(username='unittest', password='12345')
        response = self.client.post(
            '/accounts/edit_user_details/',
            {
                'email': 'carlosdanger@hotmail.com',
                'first_name': 'Carlos',
                'last_name': 'Danger'
            },
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)

        # Confirm title updated in cached overview state
        self.assertEqual(get_overview_state(user)['title'], "Carlos's Plants")


class ViewDecoratorRegressionTests(TestCase):
    def setUp(self):
        # Clear entire cache before each test
        cache.clear()

        self.plant = Plant.objects.create(uuid=uuid4(), user=get_default_user())
        self.group = Group.objects.create(uuid=uuid4(), user=get_default_user())

    def test_get_plant_from_post_body_traps_wrapped_function_exceptions(self):
        '''Issue: get_plant_from_post_body called the wrapped function inside a
        try/except block used to handle request payload errors. If an uncaught
        exception occurred in the wrapped function it would be caught by the
        wrapper, resulting in a JsonResponse with misleading error.
        '''

        # Create test functions that raise errors caught by decorator
        @get_plant_from_post_body()
        def test_key_error(plant, **kwargs):
            raise KeyError("wrapped function error")

        @get_plant_from_post_body()
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
        @get_group_from_post_body()
        def test_key_error(group, **kwargs):
            raise KeyError("wrapped function error")

        @get_group_from_post_body()
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
    def setUp(self):
        # Clear entire cache before each test
        cache.clear()

        # Recreate default user (deleted by TransactionTestCase)
        self.user, _ = get_user_model().objects.get_or_create(
            username=settings.DEFAULT_USERNAME
        )

        # Clear cached user instance
        get_default_user.cache_clear()

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
