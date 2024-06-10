# pylint: disable=missing-docstring,line-too-long,R0801

import shutil
from uuid import uuid4
from unittest.mock import patch, MagicMock

from django.conf import settings
from django.test import TestCase
from django.utils import timezone
from django.core.cache import cache
from django.test.client import MULTIPART_CONTENT

from .models import (
    Group,
    Plant,
    WaterEvent,
    FertilizeEvent,
    PruneEvent,
    RepotEvent,
    Photo,
    NoteEvent
)
from .tasks import (
    revoke_queued_task,
    schedule_cached_state_update,
    update_cached_overview_state,
    schedule_cached_overview_state_update,
    update_cached_manage_plant_state,
    schedule_cached_manage_plant_state_update,
    update_all_cached_states
)
from .unit_test_helpers import (
    JSONClient,
    create_mock_photo,
    clear_cache
)


def tearDownModule():
    # Delete mock photo directory after tests
    print("\nDeleting mock photos...\n")
    shutil.rmtree(settings.TEST_DIR, ignore_errors=True)


class HelperFunctionTests(TestCase):
    '''Test helper functions that are used by multiple tasks'''

    def setUp(self):
        # Clear entire cache before each test
        clear_cache()

    def test_revoke_queued_task(self):
        with patch('plant_tracker.tasks.cache.get') as mock_cache_get, \
             patch('plant_tracker.tasks.app.control.revoke') as mock_revoke:
            # Simulate existing cached task ID
            mock_cache_get.return_value = 'mock_task_id'

            # Call function to revoke scheduled task
            revoke_queued_task('rebuild_overview_state_task_id')

            # Confirm correct cache key was looked up
            mock_cache_get.assert_called_once_with('rebuild_overview_state_task_id')

            # Confirm mock task ID was revoked
            mock_revoke.assert_called_once_with('mock_task_id', terminate=True)

    def test_revoke_queued_task_not_found(self):
        with patch('plant_tracker.tasks.cache.get') as mock_cache_get, \
             patch('plant_tracker.tasks.app.control.revoke') as mock_revoke:
            # Simulate no existing cached task
            mock_cache_get.return_value = None

            # Call function to revoke scheduled task
            revoke_queued_task('rebuild_overview_state_task_id')

            # Confirm correct cache key was looked up, revoke was not called
            mock_cache_get.assert_called_once_with('rebuild_overview_state_task_id')
            mock_revoke.assert_not_called()

    def test_schedule_cached_state_update(self):
        # Get test UUID, mock cached manage_plant state
        uuid = uuid4()
        cache.set(f'{uuid}_state', 'mock_manage_plant_state')

        # Mock methods called by schedule_cached_state_update
        with patch('plant_tracker.tasks.cache.get') as mock_cache_get, \
             patch('plant_tracker.tasks.cache.set') as mock_cache_set, \
             patch('plant_tracker.tasks.revoke_queued_task') as mock_revoke_queued_task, \
             patch('plant_tracker.tasks.update_cached_manage_plant_state.apply_async') as mock_apply_async:

            # Mock cache.get to return None (simulate no duplicate task in queue)
            mock_cache_get.return_value = None

            # Mock apply_async to return object with id param (scheduled task ID)
            mock_result = MagicMock()
            mock_result.id = "mock_task_id"
            mock_apply_async.return_value = mock_result

            # Call function to schedule cached state update
            schedule_cached_state_update(
                cache_name=f'{uuid}_state',
                callback_task=update_cached_manage_plant_state,
                callback_kwargs={'uuid': uuid},
                delay=30
            )

            # Confirm existing cache was deleted
            self.assertIsNone(cache.get(f'{uuid}_state'))

            # Confirm revoke_queued_task was called with cache key containing
            # ID of duplicate task (revokes duplicate if present)
            mock_revoke_queued_task.assert_called_once_with(f'rebuild_{uuid}_state_task_id')

            # Confirm apply_async was called with correct args
            mock_apply_async.assert_called_once_with(kwargs={'uuid': uuid}, countdown=30)

            # Confirm ID of newly queued task was cached so it can be canceled if needed
            mock_cache_set.assert_called_once_with(f'rebuild_{uuid}_state_task_id', 'mock_task_id')

    def test_update_all_cached_states(self):
        # Create 5 Plant entries
        for i in range(0, 5):
            Plant.objects.create(uuid=uuid4())

        # Clear entire cache, confirm no cached states
        cache.clear()
        self.assertIsNone(cache.get('overview_state'))
        for i in range(0, 5):
            self.assertIsNone(cache.get(f'{Plant.objects.all()[i].uuid}_state'))

        # Call method, confirm all states were cached
        update_all_cached_states()
        self.assertTrue(isinstance(cache.get('overview_state'), dict))
        for i in range(0, 5):
            self.assertTrue(
                isinstance(cache.get(f'{Plant.objects.all()[i].uuid}_state'), dict)
            )


class TaskTests(TestCase):
    '''Test task functions'''

    def setUp(self):
        # Clear entire cache before each test
        clear_cache()

    def test_update_cached_overview_state(self):
        # Confirm overview_state cache is not set
        self.assertIsNone(cache.get('overview_state'))

        # Run task immediately
        update_cached_overview_state.delay()

        # Confirm overview state was generated and cached
        self.assertTrue(isinstance(cache.get('overview_state'), dict))

    def test_schedule_cached_overview_state_update(self):
        # Mock existing cached overview state (should be replaced)
        cache.set('overview_state', 'mock_state')

        # Call function to schedule rebuild task (runs immediately in tests)
        schedule_cached_overview_state_update()

        # Confirm ID of rebuild task was cached
        self.assertIsNotNone(cache.get('rebuild_overview_state_task_id'))

        # Confirm existing cached state was replaced (not just cleared)
        self.assertIsNotNone(cache.get('overview_state'))
        self.assertTrue(isinstance(cache.get('overview_state'), dict))

    def test_update_cached_manage_plant_state(self):
        # Create test Plant, confirm state is automatically generated + cached
        plant = Plant.objects.create(uuid=uuid4())
        self.assertIsNotNone(cache.get(f'{plant.uuid}_state'))
        self.assertTrue(isinstance(cache.get(f'{plant.uuid}_state'), dict))

        # Clear automatically-generated state
        cache.delete(f'{plant.uuid}_state')
        self.assertIsNone(cache.get(f'{plant.uuid}_state'))

        # Run task immediately
        update_cached_manage_plant_state.delay(plant.uuid)

        # Confirm manage_plant cache was generated and cached
        self.assertIsNotNone(cache.get(f'{plant.uuid}_state'))
        self.assertTrue(isinstance(cache.get(f'{plant.uuid}_state'), dict))

    def test_schedule_cached_manage_plant_state_update(self):
        # Create test plant, replace autogenerated state with mock string
        plant = Plant.objects.create(uuid=uuid4())
        cache.set(f'{plant.uuid}_state', 'mock_state')

        # Call function to schedule rebuild task (runs immediately in tests)
        schedule_cached_manage_plant_state_update(plant.uuid)

        # Confirm ID of rebuild task was cached
        self.assertIsNotNone(cache.get(f'rebuild_{plant.uuid}_state_task_id'))

        # Confirm existing cached state was replaced (not just cleared)
        self.assertIsNotNone(cache.get('overview_state'))
        self.assertTrue(isinstance(cache.get('overview_state'), dict))


class HookTests(TestCase):
    '''Test that cached states are updated correctly when database changes'''

    def setUp(self):
        # Clear entire cache before each test
        clear_cache()

        # Set default content_type for post requests (avoid long lines)
        self.client = JSONClient()

        # Generate UUID to use in tests
        self.uuid = uuid4()

    def test_overview_state_updates_when_plant_created_changed_or_deleted(self):
        # Confirm no cached overview state
        self.assertIsNone(cache.get('overview_state'))

        # Save Plant model entry
        plant = Plant.objects.create(uuid=self.uuid)

        # Confirm overview_state was generated and cached
        self.assertEqual(
            cache.get('overview_state'),
            {
                "plants": [
                    {
                        "name": None,
                        "display_name": "Unnamed plant 1",
                        "uuid": str(self.uuid),
                        "species": None,
                        "description": None,
                        "pot_size": None,
                        "last_watered": None,
                        "last_fertilized": None,
                        "thumbnail": None
                    }
                ],
                "groups": []
            }
        )

        # Update Plant entry details, save
        plant.name = "Favorite Plant"
        plant.species = "Calathea"
        plant.pot_size = 10
        plant.save()

        # Confirm cached state was updated automatically
        self.assertEqual(
            cache.get('overview_state'),
            {
                "plants": [
                    {
                        "name": "Favorite Plant",
                        "display_name": "Favorite Plant",
                        "uuid": str(self.uuid),
                        "species": "Calathea",
                        "description": None,
                        "pot_size": 10,
                        "last_watered": None,
                        "last_fertilized": None,
                        "thumbnail": None
                    }
                ],
                "groups": []
            }
        )

        # Delete Plant entry, confirm cached state was updated
        plant.delete()
        self.assertEqual(
            cache.get('overview_state'),
            {
                "plants": [],
                "groups": []
            }
        )

    def test_overview_state_updates_when_group_created_changed_or_deleted(self):
        # Confirm no cached overview state
        self.assertIsNone(cache.get('overview_state'))

        # Save Group model entry
        group = Group.objects.create(uuid=self.uuid)

        # Confirm overview_state was generated and cached
        self.assertEqual(
            cache.get('overview_state'),
            {
                "plants": [],
                "groups": [
                    {
                        "name": None,
                        "display_name": "Unnamed group 1",
                        "uuid": str(self.uuid),
                        "location": None,
                        "description": None,
                        "plants": 0
                    }
                ]
            }
        )

        # Change group entry details, save
        group.name = "Living room plants"
        group.location = "Living room"
        group.save()

        # Confirm cached state was updated automatically
        self.assertEqual(
            cache.get('overview_state'),
            {
                "plants": [],
                "groups": [
                    {
                        "name": "Living room plants",
                        "display_name": "Living room plants",
                        "uuid": str(self.uuid),
                        "location": "Living room",
                        "description": None,
                        "plants": 0
                    }
                ]
            }
        )

        # Delete Group entry, confirm cached state was updated
        group.delete()
        self.assertEqual(
            cache.get('overview_state'),
            {
                "plants": [],
                "groups": []
            }
        )

    def test_overview_state_updates_when_plant_events_created_or_deleted(self):
        # Create Plant model entry
        plant = Plant.objects.create(uuid=self.uuid)

        # Confirm state was generated, confirm Plant has no water events
        cached_state = cache.get('overview_state')
        self.assertIsNotNone(cached_state)
        self.assertIsNone(cached_state["plants"][0]["last_watered"])

        # Create WaterEvent for plant entry with API call
        self.client.post('/add_plant_event', {
            'plant_id': plant.uuid,
            'event_type': 'water',
            'timestamp': '2024-02-06T03:06:26.000Z'
        })

        # Confirm last_watered in cached state matches timestamp
        cached_state = cache.get('overview_state')
        self.assertEqual(
            cached_state["plants"][0]["last_watered"],
            '2024-02-06T03:06:26+00:00'
        )

        # Delete water event with API call
        self.client.post('/delete_plant_event', {
            'plant_id': plant.uuid,
            'event_type': 'water',
            'timestamp': '2024-02-06T03:06:26.000Z'
        })

        # Confirm last_watered in cached state reverted to None
        cached_state = cache.get('overview_state')
        self.assertIsNone(cached_state["plants"][0]["last_watered"])

    def test_overview_state_updates_when_plant_events_bulk_created_or_bulk_deleted(self):
        # Create 1 Plant model entries
        plant1 = Plant.objects.create(uuid=self.uuid)
        plant2 = Plant.objects.create(uuid=uuid4())

        # Confirm state was generated, confirm Plants have no water events
        cached_state = cache.get('overview_state')
        self.assertIsNotNone(cached_state)
        self.assertIsNone(cached_state["plants"][0]["last_watered"])
        self.assertIsNone(cached_state["plants"][1]["last_watered"])

        # Create WaterEvent for both plants with API call
        self.client.post('/bulk_add_plant_events', {
            'plants': [
                str(plant1.uuid),
                str(plant2.uuid)
            ],
            'event_type': 'water',
            'timestamp': '2024-02-06T03:06:26.000Z'
        })

        # Confirm last_watered in cached state matches timestamp for both plants
        cached_state = cache.get('overview_state')
        self.assertEqual(
            cached_state["plants"][0]["last_watered"],
            '2024-02-06T03:06:26+00:00'
        )
        self.assertEqual(
            cached_state["plants"][1]["last_watered"],
            '2024-02-06T03:06:26+00:00'
        )

        # Delete WaterEvent for first plant with API call
        self.client.post('/bulk_delete_plant_events', {
            'plant_id': plant1.uuid,
            'events': [
                {'type': 'water', 'timestamp': '2024-02-06T03:06:26.000Z'}
            ]
        })

        # Confirm last_watered in cached state is None for first plant, but not second
        cached_state = cache.get('overview_state')
        self.assertIsNone(cached_state["plants"][0]["last_watered"])
        self.assertEqual(
            cached_state["plants"][1]["last_watered"],
            '2024-02-06T03:06:26+00:00'
        )

    def test_overview_state_updates_when_plant_photo_thumbnail_changes(self):
        # Create Plant model entry
        plant = Plant.objects.create(uuid=self.uuid)

        # Confirm state was generated, confirm Plant has no photo thumbnail
        cached_state = cache.get('overview_state')
        self.assertIsNotNone(cached_state)
        self.assertIsNone(cached_state["plants"][0]["thumbnail"])

        # Create mock photo associated with plant
        photo = Photo.objects.create(
            photo=create_mock_photo('2024:03:22 10:52:03'),
            plant=plant
        )

        # Confirm thumbnail in cached state now matches new photo
        cached_state = cache.get('overview_state')
        self.assertEqual(
            cached_state["plants"][0]["thumbnail"],
            f"/media/{photo.thumbnail.name}"
        )

        # Delete mock photo, confirm thumbnail in cached state reverted to None
        photo.delete()
        cached_state = cache.get('overview_state')
        self.assertIsNone(cached_state["plants"][0]["thumbnail"])

    def test_overview_state_updates_when_plant_default_photo_set(self):
        # Create Plant model entry
        plant = Plant.objects.create(uuid=self.uuid)

        # Confirm state was generated, confirm Plant has no photo thumbnail
        cached_state = cache.get('overview_state')
        self.assertIsNotNone(cached_state)
        self.assertIsNone(cached_state["plants"][0]["thumbnail"])

        # Create 2 mock photos, add to database
        mock_photo1 = create_mock_photo('2024:03:21 10:52:03')
        mock_photo2 = create_mock_photo('2024:03:22 10:52:03')
        Photo.objects.create(photo=mock_photo1, plant=plant)
        Photo.objects.create(photo=mock_photo2, plant=plant)

        # Set first photo as default with API call
        self.client.post('/set_plant_default_photo', {
            'plant_id': str(plant.uuid),
            'photo_key': Photo.objects.all()[0].pk
        })

        # Confirm thumbnail in cached state now matches first photo
        cached_state = cache.get('overview_state')
        self.assertEqual(
            cached_state["plants"][0]["thumbnail"],
            f"/media/{Photo.objects.all()[0].thumbnail.name}"
        )

    def test_overview_state_does_not_update_unless_new_photo_is_most_recent(self):
        '''Overview state should be updated by a hook when Plant is saved. This
        should happen when a new/deleted photo is the most recent (thumbnail_url
        field updates), but not when the new/deleted photo is not most recent.
        '''

        # Create Plant model entry
        plant = Plant.objects.create(uuid=self.uuid)

        # Confirm overview state IS updated when the first photo is added
        cache.delete('overview_state')
        response = self.client.post(
            '/add_plant_photos',
            data={
                'plant_id': str(plant.uuid),
                'photo_0': create_mock_photo('2024:03:22 10:52:03')
            },
            content_type=MULTIPART_CONTENT
        )
        self.assertIsNotNone(cache.get('overview_state'))

        # Save new photo primary key (used to delete later)
        photo1_pk = response.json()['urls'][0]['key']

        # Confirm overview state NOT updated when photo with older timestamp added
        cache.delete('overview_state')
        response = self.client.post(
            '/add_plant_photos',
            data={
                'plant_id': str(plant.uuid),
                'photo_0': create_mock_photo('2024:02:22 10:52:03')
            },
            content_type=MULTIPART_CONTENT
        )
        self.assertIsNone(cache.get('overview_state'))

        # Save new photo primary key (used to delete later)
        photo2_pk = response.json()['urls'][0]['key']

        # Confirm overview state NOT updated when photo with older timestamp deleted
        cache.delete('overview_state')
        self.client.post('/delete_plant_photos', {
            'plant_id': str(plant.uuid),
            'delete_photos': [photo2_pk]
        })
        self.assertIsNone(cache.get('overview_state'))

        # Confirm overview state IS updated when most recent photo is deleted
        cache.delete('overview_state')
        self.client.post('/delete_plant_photos', {
            'plant_id': str(plant.uuid),
            'delete_photos': [photo1_pk]
        })
        self.assertIsNotNone(cache.get('overview_state'))

    def test_manage_plant_state_updates_when_plant_saved(self):
        # Confirm no cached manage_plant state for plant UUID
        self.assertIsNone(cache.get(f'{self.uuid}_state'))

        # Create Plant model entry
        plant = Plant.objects.create(uuid=self.uuid)

        # Confirm manage_plant state was generated and cached
        self.assertEqual(
            cache.get(f'{self.uuid}_state'),
            {
                "plant": {
                    "name": None,
                    "uuid": str(self.uuid),
                    "species": None,
                    "description": None,
                    "pot_size": None,
                    "last_watered": None,
                    "last_fertilized": None,
                    "thumbnail": None,
                    "display_name": "Unnamed plant 1",
                    "events": {
                        "water": [],
                        "fertilize": [],
                        "prune": [],
                        "repot": []
                    },
                    "group": None
                },
                "photo_urls": [],
                "notes": []
            }
        )

        # Change Plant details, save
        plant.name = "Favorite Plant"
        plant.species = "Calathea"
        plant.save()

        # Confirm cached manage_plant state updated automatically
        self.assertEqual(
            cache.get(f'{self.uuid}_state')['plant'],
            {
                "name": "Favorite Plant",
                "uuid": str(self.uuid),
                "species": "Calathea",
                "description": None,
                "pot_size": None,
                "last_watered": None,
                "last_fertilized": None,
                "thumbnail": None,
                "display_name": "Favorite Plant",
                "events": {
                    "water": [],
                    "fertilize": [],
                    "prune": [],
                    "repot": []
                },
                "group": None
            }
        )

    def test_manage_plant_state_updates_when_events_created_or_deleted(self):
        # Create Plant model entry
        plant = Plant.objects.create(uuid=self.uuid)

        # Confirm autogenerated state has no events
        self.assertEqual(
            cache.get(f'{self.uuid}_state')['plant']['events'],
            {
                "water": [],
                "fertilize": [],
                "prune": [],
                "repot": []
            }
        )

        # Create WaterEvent, confirm state updated automatically
        timestamp = timezone.now()
        water = WaterEvent.objects.create(plant=plant, timestamp=timestamp)
        self.assertEqual(
            cache.get(f'{self.uuid}_state')['plant']['events']["water"],
            [timestamp.isoformat()]
        )

        # Create FertilizeEvent, confirm state updated automatically
        fertilize = FertilizeEvent.objects.create(plant=plant, timestamp=timestamp)
        self.assertEqual(
            cache.get(f'{self.uuid}_state')['plant']['events']["fertilize"],
            [timestamp.isoformat()]
        )

        # Create PruneEvent, confirm state updated automatically
        prune = PruneEvent.objects.create(plant=plant, timestamp=timestamp)
        self.assertEqual(
            cache.get(f'{self.uuid}_state')['plant']['events']["prune"],
            [timestamp.isoformat()]
        )

        # Create RepotEvent, confirm state updated automatically
        repot = RepotEvent.objects.create(plant=plant, timestamp=timestamp)
        self.assertEqual(
            cache.get(f'{self.uuid}_state')['plant']['events']["repot"],
            [timestamp.isoformat()]
        )

        # Delete water event, confirm state updated automatically
        water.delete()
        self.assertEqual(
            cache.get(f'{self.uuid}_state')['plant']['events'],
            {
                "water": [],
                "fertilize": [timestamp.isoformat()],
                "prune": [timestamp.isoformat()],
                "repot": [timestamp.isoformat()]
            }
        )

        # Delete all events, confirm state updated automatically
        fertilize.delete()
        prune.delete()
        repot.delete()
        self.assertEqual(
            cache.get(f'{self.uuid}_state')['plant']['events'],
            {
                "water": [],
                "fertilize": [],
                "prune": [],
                "repot": []
            }
        )

    def test_manage_plant_state_updates_when_notes_created_or_deleted(self):
        # Create Plant model entry
        plant = Plant.objects.create(uuid=self.uuid)

        # Confirm autogenerated state has no notes
        self.assertEqual(
            cache.get(f'{self.uuid}_state')['notes'],
            []
        )

        # Create NoteEvent
        timestamp = timezone.now()
        note = NoteEvent.objects.create(
            plant=plant,
            timestamp=timestamp,
            text="This is a note"
        )

        # Confirm cached state updated automatically
        self.assertEqual(
            cache.get(f'{self.uuid}_state')['notes'],
            [
                {
                    "timestamp": timestamp.isoformat(),
                    "text": "This is a note"
                }
            ]
        )

        # Change note text, confirm cached state updated automatically
        note.text = "Watered with 5 drops of fertilizer in 1/2 gallon"
        note.save()
        self.assertEqual(
            cache.get(f'{self.uuid}_state')['notes'],
            [
                {
                    "timestamp": timestamp.isoformat(),
                    "text": "Watered with 5 drops of fertilizer in 1/2 gallon"
                }
            ]
        )

        # Delete note, confirm cached state updated automatically
        note.delete()
        self.assertEqual(
            cache.get(f'{self.uuid}_state')['notes'],
            []
        )

    def test_manage_plant_state_updates_when_photo_created_or_deleted(self):
        # Create Plant model entry
        plant = Plant.objects.create(uuid=self.uuid)

        # Confirm autogenerated state has no photo_urls
        self.assertEqual(
            cache.get(f'{self.uuid}_state')['photo_urls'],
            []
        )

        # Create Photo
        mock_photo = create_mock_photo('2024:03:21 10:52:03')
        photo = Photo.objects.create(photo=mock_photo, plant=plant)

        # Confirm cached state updated automatically
        self.assertEqual(
            cache.get(f'{self.uuid}_state')['photo_urls'],
            [
                {
                    "created": "2024-03-21T10:52:03+00:00",
                    "image": f"/media/{photo.photo.name}",
                    "thumbnail": f"/media/{photo.thumbnail.name}",
                    "key": photo.pk
                }
            ]
        )

        # Delete Photo, confirm cached state updated automatically
        photo.delete()
        self.assertEqual(
            cache.get(f'{self.uuid}_state')['photo_urls'],
            []
        )

    def test_manage_plant_state_deleted_from_cache_when_plant_deleted(self):
        # Create Plant model entry
        plant = Plant.objects.create(uuid=self.uuid)

        # Confirm autogenerated state exists in cache
        self.assertIsNotNone(cache.get(f'{plant.uuid}_state'))

        # Delete plant, confirm cached state was deleted
        plant.delete()
        self.assertIsNone(cache.get(f'{plant.uuid}_state'))

    def test_plant_options_list_updates_when_plant_created_modified_or_deleted(self):
        # Confirm no cached plant_options list
        self.assertIsNone(cache.get('plant_options'))

        # Create Plant model entry
        plant = Plant.objects.create(uuid=uuid4())

        # Confirm plant_options was generated and cached
        self.assertIsNotNone(cache.get('plant_options'))

        # Clear cache, change plant details
        cache.delete('plant_options')
        plant.name = 'New Plant'
        plant.species = 'Cilantro'
        plant.save()

        # Confirm plant_options was generated and cached
        self.assertIsNotNone(cache.get('plant_options'))

        # Delete cache, delete plant model entry
        cache.delete('plant_options')
        plant.delete()

        # Confirm plant_options was generated and cached
        self.assertIsNotNone(cache.get('plant_options'))

    def test_group_options_list_updates_when_group_created_modified_or_deleted(self):
        # Confirm no cached group_options list
        self.assertIsNone(cache.get('group_options'))

        # Create Group model entry
        group = Group.objects.create(uuid=uuid4())

        # Confirm group_options was generated and cached
        self.assertIsNotNone(cache.get('group_options'))

        # Clear cache, change group details
        cache.delete('group_options')
        group.name = 'New Group'
        group.location = 'Roof'
        group.save()

        # Confirm group_options was generated and cached
        self.assertIsNotNone(cache.get('group_options'))

        # Delete cache, delete group model entry
        cache.delete('group_options')
        group.delete()

        # Confirm group_options was generated and cached
        self.assertIsNotNone(cache.get('group_options'))
