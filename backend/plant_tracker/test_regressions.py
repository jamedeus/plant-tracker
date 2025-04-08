# pylint: disable=missing-docstring,R0801

import shutil
from uuid import uuid4
from types import NoneType
from datetime import datetime

from django.conf import settings
from django.test import TestCase
from django.utils import timezone
from django.core.cache import cache
from django.db import IntegrityError
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
    get_default_user,
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

    def test_photos_with_no_exif_data_should_set_created_time_to_upload_time(self):
        '''Issue: The created field is populated in the save method using a
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

        # Photo.created should be a datetime object, not NoneType
        self.assertNotEqual(type(photo.created), NoneType)
        self.assertEqual(type(photo.created), datetime)

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
        plant1 = Plant.objects.create(uuid=uuid4(), user=get_default_user())
        plant2 = Plant.objects.create(uuid=uuid4(), user=get_default_user())
        plant3 = Plant.objects.create(uuid=uuid4(), user=get_default_user())
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
            photos[0]["created"],
            r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?\+\d{2}:\d{2}'
        )
        self.assertRegex(
            photos[1]["created"],
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
            response.context['js_bundle'],
            'plant_tracker/register.js'
        )

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
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.url, f'/manage/{test_id}')

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
        group = Group.objects.create(uuid=uuid4(), user=get_default_user())
        plant = Plant.objects.create(uuid=uuid4(), user=get_default_user())
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
            response.context['state']['options'][0]['thumbnail'],
            photo1.get_thumbnail_url()
        )

        # Confirm plant_options object is cached when manage_group loaded
        self.assertIsNotNone(cache.get(f'plant_options_{get_default_user().pk}'))

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
            response.context['state']['options'][0]['thumbnail'],
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
            response.context['state']['options'][0]['thumbnail'],
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
        group = Group.objects.create(uuid=uuid4(), user=get_default_user())
        plant1 = Plant.objects.create(uuid=uuid4(), group=group, user=get_default_user())
        plant2 = Plant.objects.create(uuid=uuid4(), user=get_default_user())
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
