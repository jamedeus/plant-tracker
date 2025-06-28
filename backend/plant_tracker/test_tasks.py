# pylint: disable=missing-docstring,line-too-long,R0801,too-many-lines

import shutil
from uuid import uuid4

from django.conf import settings
from django.test import TestCase
from django.utils import timezone
from django.core.cache import cache

from .view_decorators import get_default_user
from .models import (
    Group,
    Plant,
    WaterEvent,
    FertilizeEvent,
    PruneEvent,
    RepotEvent,
    DivisionEvent,
    Photo,
    NoteEvent
)
from .build_states import build_manage_plant_state
from .tasks import update_cached_overview_state, update_all_cached_states
from .unit_test_helpers import JSONClient, create_mock_photo


def tearDownModule():
    # Delete mock photo directory after tests
    print("\nDeleting mock photos...\n")
    shutil.rmtree(settings.TEST_DIR, ignore_errors=True)


class HelperFunctionTests(TestCase):
    '''Test helper functions that are used by multiple tasks'''

    def setUp(self):
        # Clear entire cache before each test
        cache.clear()

    def test_update_all_cached_states(self):
        # Create 5 Plant entries, cache dummy string for each
        default_user = get_default_user()
        for _ in range(0, 5):
            plant = Plant.objects.create(uuid=uuid4(), user=default_user)
            cache.set(f'{plant.uuid}_state', 'foo')

        # Replace all cache keys with dummy strings
        cache.set(f'overview_state_{default_user.pk}', 'foo')

        # Call update_all_cached_states method
        update_all_cached_states()

        # Confirm all cached states were rebuilt (no longer dummy strings)
        self.assertIsInstance(cache.get(f'overview_state_{default_user.pk}'), dict)

        # Confirm all cached plant states were deleted
        for plant in Plant.objects.filter(user=default_user):
            self.assertIsNone(cache.get(f'{plant.uuid}_state'))


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


class OverviewStateUpdateTests(TestCase):
    '''Test that cached overview states update correctly when database changes'''

    def setUp(self):
        # Clear entire cache before each test
        cache.clear()

        # Set default content_type for post requests (avoid long lines)
        self.client = JSONClient()

        # Generate UUID to use in tests
        self.uuid = uuid4()

    def test_overview_state_updates_when_plant_created_changed_or_deleted(self):
        # Confirm no cached overview state
        user_id = get_default_user().pk
        self.assertIsNone(cache.get(f'overview_state_{user_id}'))

        # Save Plant model entry
        plant = Plant.objects.create(uuid=self.uuid, user=get_default_user())

        # Confirm overview_state was generated and cached
        self.assertEqual(
            cache.get(f'overview_state_{user_id}'),
            {
                "plants": {
                    str(self.uuid): {
                        "name": None,
                        "display_name": "Unnamed plant 1",
                        "uuid": str(self.uuid),
                        "created": plant.created.isoformat(),
                        "archived": False,
                        "species": None,
                        "description": None,
                        "pot_size": None,
                        "last_watered": None,
                        "last_fertilized": None,
                        "thumbnail": None,
                        "group": None
                    }
                },
                "groups": {},
                "show_archive": False
            }
        )

        # Update Plant entry details, save
        plant.name = "Favorite Plant"
        plant.species = "Calathea"
        plant.pot_size = 10
        plant.save()

        # Confirm cached state was updated automatically
        self.assertEqual(
            cache.get(f'overview_state_{user_id}'),
            {
                "plants": {
                    str(self.uuid): {
                        "name": "Favorite Plant",
                        "display_name": "Favorite Plant",
                        "uuid": str(self.uuid),
                        "created": plant.created.isoformat(),
                        "archived": False,
                        "species": "Calathea",
                        "description": None,
                        "pot_size": 10,
                        "last_watered": None,
                        "last_fertilized": None,
                        "thumbnail": None,
                        "group": None
                    }
                },
                "groups": {},
                "show_archive": False
            }
        )

        # Delete Plant entry, confirm cached state was updated
        plant.delete()
        self.assertEqual(
            cache.get(f'overview_state_{user_id}'),
            {
                "plants": {},
                "groups": {},
                "show_archive": False
            }
        )

    def test_overview_state_updates_when_group_created_changed_or_deleted(self):
        # Confirm no cached overview state
        user_id = get_default_user().pk
        self.assertIsNone(cache.get(f'overview_state_{user_id}'))

        # Save Group model entry
        group = Group.objects.create(uuid=self.uuid, user=get_default_user())

        # Confirm overview_state was generated and cached
        self.assertEqual(
            cache.get(f'overview_state_{user_id}'),
            {
                "plants": {},
                "groups": {
                    str(self.uuid): {
                        "name": None,
                        "display_name": "Unnamed group 1",
                        "uuid": str(self.uuid),
                        "created": group.created.isoformat(),
                        "archived": False,
                        "location": None,
                        "description": None,
                        "plants": 0
                    }
                },
                "show_archive": False
            }
        )

        # Change group entry details, save
        group.name = "Living room plants"
        group.location = "Living room"
        group.save()

        # Confirm cached state was updated automatically
        self.assertEqual(
            cache.get(f'overview_state_{user_id}'),
            {
                "plants": {},
                "groups": {
                    str(self.uuid): {
                        "name": "Living room plants",
                        "display_name": "Living room plants",
                        "uuid": str(self.uuid),
                        "created": group.created.isoformat(),
                        "archived": False,
                        "location": "Living room",
                        "description": None,
                        "plants": 0
                    }
                },
                "show_archive": False
            }
        )

        # Delete Group entry, confirm cached state was updated
        group.delete()
        self.assertEqual(
            cache.get(f'overview_state_{user_id}'),
            {
                "plants": {},
                "groups": {},
                "show_archive": False
            }
        )

    def test_overview_state_updates_when_water_or_fertilize_events_created(self):
        # Create Plant model entry
        plant = Plant.objects.create(uuid=self.uuid, user=get_default_user())

        # Confirm overview state generated, confirm Plant never watered/fertilized
        user_id = get_default_user().pk
        cached_state = cache.get(f'overview_state_{user_id}')
        self.assertIsNotNone(cached_state)
        self.assertIsNone(cached_state["plants"][str(self.uuid)]["last_watered"])
        self.assertIsNone(cached_state["plants"][str(self.uuid)]["last_fertilized"])

        # Create WaterEvent
        water = WaterEvent.objects.create(plant=plant, timestamp=timezone.now())

        # Confirm last_watered in cached state matches timestamp
        cached_state = cache.get(f'overview_state_{user_id}')
        self.assertEqual(
            cached_state["plants"][str(self.uuid)]["last_watered"],
            water.timestamp.isoformat()
        )
        self.assertIsNone(cached_state["plants"][str(self.uuid)]["last_fertilized"])

        # Create FertilizeEvent
        fertilize = FertilizeEvent.objects.create(plant=plant, timestamp=timezone.now())

        # Confirm last_fertilized in cached state matches timestamp
        cached_state = cache.get(f'overview_state_{user_id}')
        self.assertEqual(
            cached_state["plants"][str(self.uuid)]["last_watered"],
            water.timestamp.isoformat()
        )
        self.assertEqual(
            cached_state["plants"][str(self.uuid)]["last_fertilized"],
            fertilize.timestamp.isoformat()
        )

        # Delete WaterEvent, confirm last_watered in cached state reverted to None
        water.delete()
        cached_state = cache.get(f'overview_state_{user_id}')
        self.assertIsNone(cached_state["plants"][str(self.uuid)]["last_watered"])
        self.assertEqual(
            cached_state["plants"][str(self.uuid)]["last_fertilized"],
            fertilize.timestamp.isoformat()
        )

        # Delete FertilizeEvent, confirm last_fertilized in cached state reverted to None
        fertilize.delete()
        cached_state = cache.get(f'overview_state_{user_id}')
        self.assertIsNone(cached_state["plants"][str(self.uuid)]["last_watered"])
        self.assertIsNone(cached_state["plants"][str(self.uuid)]["last_fertilized"])

    def test_overview_state_updates_when_events_created_or_deleted_with_endpoints(self):
        # Create Plant model entry
        plant = Plant.objects.create(uuid=self.uuid, user=get_default_user())

        # Confirm overview state generated, confirm Plant never watered/fertilized
        user_id = get_default_user().pk
        cached_state = cache.get(f'overview_state_{user_id}')
        self.assertIsNotNone(cached_state)
        self.assertIsNone(cached_state["plants"][str(self.uuid)]["last_watered"])
        self.assertIsNone(cached_state["plants"][str(self.uuid)]["last_fertilized"])

        # Create WaterEvent for plant entry with API call
        self.client.post('/add_plant_event', {
            'plant_id': plant.uuid,
            'event_type': 'water',
            'timestamp': '2024-02-06T03:06:26.000Z'
        })

        # Confirm last_watered in cached state matches timestamp
        cached_state = cache.get(f'overview_state_{user_id}')
        self.assertEqual(
            cached_state["plants"][str(self.uuid)]["last_watered"],
            '2024-02-06T03:06:26+00:00'
        )
        self.assertIsNone(cached_state["plants"][str(self.uuid)]["last_fertilized"])

        # Delete water event with API call
        self.client.post('/delete_plant_event', {
            'plant_id': plant.uuid,
            'event_type': 'water',
            'timestamp': '2024-02-06T03:06:26.000Z'
        })

        # Confirm last_watered in cached state reverted to None
        cached_state = cache.get(f'overview_state_{user_id}')
        self.assertIsNone(cached_state["plants"][str(self.uuid)]["last_watered"])
        self.assertIsNone(cached_state["plants"][str(self.uuid)]["last_fertilized"])

    def test_overview_state_updates_when_plant_events_bulk_created_or_bulk_deleted(self):
        # Create 1 Plant model entries
        plant1 = Plant.objects.create(uuid=self.uuid, user=get_default_user())
        plant2 = Plant.objects.create(uuid=uuid4(), user=get_default_user())

        # Confirm state was generated, confirm Plants have no water events
        user_id = get_default_user().pk
        cached_state = cache.get(f'overview_state_{user_id}')
        self.assertIsNotNone(cached_state)
        self.assertIsNone(cached_state["plants"][str(plant1.uuid)]["last_watered"])
        self.assertIsNone(cached_state["plants"][str(plant2.uuid)]["last_watered"])

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
        cached_state = cache.get(f'overview_state_{user_id}')
        self.assertEqual(
            cached_state["plants"][str(plant1.uuid)]["last_watered"],
            '2024-02-06T03:06:26+00:00'
        )
        self.assertEqual(
            cached_state["plants"][str(plant2.uuid)]["last_watered"],
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
        cached_state = cache.get(f'overview_state_{user_id}')
        self.assertIsNone(cached_state["plants"][str(plant1.uuid)]["last_watered"])
        self.assertEqual(
            cached_state["plants"][str(plant2.uuid)]["last_watered"],
            '2024-02-06T03:06:26+00:00'
        )

    def test_overview_state_updates_when_plant_default_photo_set(self):
        # Create Plant model entry
        plant = Plant.objects.create(uuid=self.uuid, user=get_default_user())

        # Confirm state was generated, confirm Plant has no photo thumbnail
        user_id = get_default_user().pk
        cached_state = cache.get(f'overview_state_{user_id}')
        self.assertIsNotNone(cached_state)
        self.assertIsNone(cached_state["plants"][str(plant.uuid)]["thumbnail"])

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
        cached_state = cache.get(f'overview_state_{user_id}')
        self.assertEqual(
            cached_state["plants"][str(plant.uuid)]["thumbnail"],
            f"/media/{Photo.objects.all()[0].thumbnail.name}"
        )

    def test_plants_and_groups_are_removed_from_overview_state_when_archived(self):
        # Create Plant and Group, confirm both are in cached overview state
        plant = Plant.objects.create(uuid=uuid4(), user=get_default_user())
        group = Group.objects.create(uuid=uuid4(), user=get_default_user())
        self.assertEqual(
            cache.get(f'overview_state_{get_default_user().pk}'),
            {
                "plants": {
                    str(plant.uuid): {
                        "name": None,
                        "display_name": "Unnamed plant 1",
                        "uuid": str(plant.uuid),
                        "created": plant.created.isoformat(),
                        "archived": False,
                        "species": None,
                        "description": None,
                        "pot_size": None,
                        "last_watered": None,
                        "last_fertilized": None,
                        "thumbnail": None,
                        "group": None
                    }
                },
                "groups": {
                    str(group.uuid): {
                        "name": None,
                        "display_name": "Unnamed group 1",
                        "uuid": str(group.uuid),
                        "created": group.created.isoformat(),
                        "archived": False,
                        "location": None,
                        "description": None,
                        "plants": 0
                    }
                },
                "show_archive": False
            }
        )

        # Archive plant, confirm removed from cached overview state
        plant.archived = True
        plant.save()
        self.assertEqual(
            cache.get(f'overview_state_{get_default_user().pk}'),
            {
                "plants": {},
                "groups": {
                    str(group.uuid): {
                        "name": None,
                        "display_name": "Unnamed group 1",
                        "uuid": str(group.uuid),
                        "created": group.created.isoformat(),
                        "archived": False,
                        "location": None,
                        "description": None,
                        "plants": 0
                    }
                },
                "show_archive": False
            }
        )

        # Archive group, confirm removed from cached overview state
        group.archived = True
        group.save()
        self.assertEqual(
            cache.get(f'overview_state_{get_default_user().pk}'),
            {
                "plants": {},
                "groups": {},
                "show_archive": False
            }
        )

    def overview_state_updates_when_number_of_plants_in_group_changes(self):
        # Create Plant and Group, confirm both are in cached overview state
        plant = Plant.objects.create(uuid=uuid4(), user=get_default_user())
        group = Group.objects.create(uuid=uuid4(), user=get_default_user())
        cached_state = cache.get(f'overview_state_{get_default_user().pk}')
        self.assertEqual(
            cached_state,
            {
                "plants": {
                    str(plant.uuid): plant.get_details()
                },
                "groups": {
                    str(group.uuid): group.get_details()
                },
                "show_archive": False
            }
        )
        # Confirm group has 0 plants in cached overview state
        self.assertEqual(
            cached_state['groups'][str(group.uuid)]['plants'],
            0
        )

        # Add plant to group
        plant.group = group
        plant.save()
        cached_state = cache.get(f'overview_state_{get_default_user().pk}')
        # Confirm group has 1 plant in cached overview state
        self.assertEqual(
            cached_state['groups'][str(group.uuid)]['plants'],
            1
        )

        # Remove plant from group, confirm number
        plant.group = None
        plant.save()
        cached_state = cache.get(f'overview_state_{get_default_user().pk}')
        # Confirm group has 0 plants in cached overview state
        self.assertEqual(
            cached_state['groups'][str(group.uuid)]['plants'],
            0
        )


class ManagePlantStateUpdateTests(TestCase):
    '''Test that cached manage_plant states update correctly when database changes'''

    def setUp(self):
        # Clear entire cache before each test
        cache.clear()

        # Set default content_type for post requests (avoid long lines)
        self.client = JSONClient()

        # Generate UUID to use in tests
        self.uuid = uuid4()

    def test_manage_plant_state_updates_when_plant_saved(self):
        # Create Plant model entry, generate cached state
        plant = Plant.objects.create(uuid=self.uuid, user=get_default_user())
        build_manage_plant_state(
            Plant.objects.get_with_manage_plant_annotation(self.uuid)
        )

        # Confirm cached manage_plant state has correct details
        self.assertEqual(
            cache.get(f'{self.uuid}_state'),
            {
                "plant_details": {
                    "name": None,
                    "uuid": str(self.uuid),
                    "created": plant.created.isoformat(),
                    "archived": False,
                    "species": None,
                    "description": None,
                    "pot_size": None,
                    "last_watered": None,
                    "last_fertilized": None,
                    "thumbnail": None,
                    "display_name": "Unnamed plant 1",
                    "group": None
                },
                "events": {
                    "water": [],
                    "fertilize": [],
                    "prune": [],
                    "repot": []
                },
                "photos": {},
                "default_photo": {
                    "set": False,
                    "timestamp": None,
                    "image": None,
                    "thumbnail": None,
                    "preview": None,
                    "key": None
                },
                "notes": {},
                "divided_from": None,
                "division_events": {}
            }
        )

        # Change Plant details, save
        plant.name = "Favorite Plant"
        plant.species = "Calathea"
        plant.save()

        # Confirm cached manage_plant state updated automatically
        self.assertEqual(
            cache.get(f'{self.uuid}_state')['plant_details'],
            {
                "name": "Favorite Plant",
                "uuid": str(self.uuid),
                "created": plant.created.isoformat(),
                "archived": False,
                "species": "Calathea",
                "description": None,
                "pot_size": None,
                "last_watered": None,
                "last_fertilized": None,
                "thumbnail": None,
                "display_name": "Favorite Plant",
                "group": None
            }
        )

    def test_manage_plant_state_updates_when_events_created_or_deleted(self):
        # Create Plant model entry, generate cached state
        plant = Plant.objects.create(uuid=self.uuid, user=get_default_user())
        build_manage_plant_state(
            Plant.objects.get_with_manage_plant_annotation(self.uuid)
        )

        # Confirm cached state has no events
        self.assertEqual(
            cache.get(f'{self.uuid}_state')['events'],
            {
                "water": [],
                "fertilize": [],
                "prune": [],
                "repot": []
            }
        )
        # Confirm last_watered and last_fertilized are not set
        self.assertIsNone(
            cache.get(f'{self.uuid}_state')['plant_details']['last_watered']
        )
        self.assertIsNone(
            cache.get(f'{self.uuid}_state')['plant_details']['last_fertilized']
        )
        self.assertEqual(cache.get(f'{self.uuid}_state')['division_events'], {})

        # Create WaterEvent, confirm state updated automatically
        timestamp = timezone.now()
        water = WaterEvent.objects.create(plant=plant, timestamp=timestamp)
        self.assertEqual(
            cache.get(f'{self.uuid}_state')['events']["water"],
            [timestamp.isoformat()]
        )
        # Confirm last_watered updated, but not last_fertilized
        self.assertEqual(
            cache.get(f'{self.uuid}_state')['plant_details']['last_watered'],
            timestamp.isoformat()
        )
        self.assertIsNone(
            cache.get(f'{self.uuid}_state')['plant_details']['last_fertilized']
        )

        # Create FertilizeEvent, confirm state updated automatically
        fertilize = FertilizeEvent.objects.create(plant=plant, timestamp=timestamp)
        self.assertEqual(
            cache.get(f'{self.uuid}_state')['events']["fertilize"],
            [timestamp.isoformat()]
        )
        # Confirm last_fertilized updated
        self.assertEqual(
            cache.get(f'{self.uuid}_state')['plant_details']['last_fertilized'],
            timestamp.isoformat()
        )

        # Create PruneEvent, confirm state updated automatically
        prune = PruneEvent.objects.create(plant=plant, timestamp=timestamp)
        self.assertEqual(
            cache.get(f'{self.uuid}_state')['events']["prune"],
            [timestamp.isoformat()]
        )

        # Create RepotEvent, confirm state updated automatically
        repot = RepotEvent.objects.create(plant=plant, timestamp=timestamp)
        self.assertEqual(
            cache.get(f'{self.uuid}_state')['events']["repot"],
            [timestamp.isoformat()]
        )

        # Create DivisionEvent, confirm state updated automatically
        divide = DivisionEvent.objects.create(plant=plant, timestamp=timestamp)
        self.assertEqual(cache.get(f'{self.uuid}_state')['division_events'], {
            timestamp.isoformat(): []
        })

        # Delete water event, confirm state updated automatically
        water.delete()
        self.assertEqual(
            cache.get(f'{self.uuid}_state')['events'],
            {
                "water": [],
                "fertilize": [timestamp.isoformat()],
                "prune": [timestamp.isoformat()],
                "repot": [timestamp.isoformat()]
            }
        )
        # Confirm last_watered updated, but not last_fertilized
        self.assertIsNone(
            cache.get(f'{self.uuid}_state')['plant_details']['last_watered']
        )
        self.assertEqual(
            cache.get(f'{self.uuid}_state')['plant_details']['last_fertilized'],
            timestamp.isoformat()
        )

        # Delete all events, confirm state updated automatically
        fertilize.delete()
        prune.delete()
        repot.delete()
        self.assertEqual(
            cache.get(f'{self.uuid}_state')['events'],
            {
                "water": [],
                "fertilize": [],
                "prune": [],
                "repot": []
            }
        )
        # Confirm last_fertilized updated
        self.assertIsNone(
            cache.get(f'{self.uuid}_state')['plant_details']['last_fertilized']
        )

        # Delete DivisionEvent, confirm state updated automatically
        divide.delete()
        self.assertEqual(cache.get(f'{self.uuid}_state')['division_events'], {})

    def test_manage_plant_state_updates_when_notes_created_or_deleted(self):
        # Create Plant model entry, generate cached state
        plant = Plant.objects.create(uuid=self.uuid, user=get_default_user())
        build_manage_plant_state(
            Plant.objects.get_with_manage_plant_annotation(self.uuid)
        )

        # Confirm cached state has no notes
        self.assertEqual(
            cache.get(f'{self.uuid}_state')['notes'],
            {}
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
            {timestamp.isoformat(): "This is a note"}
        )

        # Change note text, confirm cached state updated automatically
        note.text = "Watered with 5 drops of fertilizer in 1/2 gallon"
        note.save()
        self.assertEqual(
            cache.get(f'{self.uuid}_state')['notes'],
            {timestamp.isoformat(): "Watered with 5 drops of fertilizer in 1/2 gallon"}
        )

        # Delete note, confirm cached state updated automatically
        note.delete()
        self.assertEqual(
            cache.get(f'{self.uuid}_state')['notes'],
            {}
        )

    def test_manage_plant_state_updates_when_parent_plant_saved_or_deleted(self):
        # Create parent and child Plant model entries
        parent = Plant.objects.create(uuid=uuid4(), user=get_default_user())
        divide = DivisionEvent.objects.create(plant=parent, timestamp=timezone.now())
        Plant.objects.create(
            uuid=self.uuid,
            user=get_default_user(),
            divided_from=parent,
            divided_from_event=divide
        )
        # Generate child plant cached state
        build_manage_plant_state(
            Plant.objects.get_with_manage_plant_annotation(self.uuid)
        )

        # Confirm child's cached state has correct parent name
        self.assertEqual(
            cache.get(f'{self.uuid}_state')['divided_from']['name'],
            'Unnamed plant 1'
        )

        # Change parent plant name
        parent.name = 'Parent'
        parent.save()

        # Confirm cached state updated automatically
        self.assertEqual(
            cache.get(f'{self.uuid}_state')['divided_from']['name'],
            'Parent'
        )

        # Delete parent plant, confirm child cached state was deleted
        parent.delete()
        self.assertIsNone(cache.get(f'{self.uuid}_state'))

    def test_manage_plant_state_updates_when_child_plant_saved_or_deleted(self):
        # Create parent and child Plant model entries
        parent = Plant.objects.create(uuid=self.uuid, user=get_default_user())
        divide = DivisionEvent.objects.create(plant=parent, timestamp=timezone.now())
        child = Plant.objects.create(
            uuid=uuid4(),
            user=get_default_user(),
            divided_from=parent,
            divided_from_event=divide
        )
        # Generate parent plant cached state
        build_manage_plant_state(
            Plant.objects.get_with_manage_plant_annotation(self.uuid)
        )

        # Confirm parent's cached state has correct child name
        self.assertEqual(
            cache.get(f'{self.uuid}_state')['division_events'], {
            divide.timestamp.isoformat(): [
                {'name': 'Unnamed plant 2', 'uuid': str(child.uuid)}
            ]
        })

        # Change child plant name
        child.name = 'Child'
        child.save()

        # Confirm cached state updated automatically
        self.assertEqual(
            cache.get(f'{self.uuid}_state')['division_events'], {
            divide.timestamp.isoformat(): [
                {'name': 'Child', 'uuid': str(child.uuid)}
            ]
        })

        # Delete child plant, confirm parent cached state was deleted
        child.delete()
        self.assertIsNone(cache.get(f'{self.uuid}_state'))

    def test_manage_plant_state_deleted_from_cache_when_plant_deleted(self):
        # Create Plant model entry, generate cached state
        plant = Plant.objects.create(uuid=self.uuid, user=get_default_user())
        build_manage_plant_state(
            Plant.objects.get_with_manage_plant_annotation(self.uuid)
        )

        # Confirm cached state exists
        self.assertIsNotNone(cache.get(f'{plant.uuid}_state'))

        # Delete plant, confirm cached state was deleted
        plant.delete()
        self.assertIsNone(cache.get(f'{plant.uuid}_state'))


class CachedOptionsUpdateTests(TestCase):
    '''Test that cached options lists/dicts update correctly when database changes'''

    def setUp(self):
        # Clear entire cache before each test
        cache.clear()

        # Set default content_type for post requests (avoid long lines)
        self.client = JSONClient()

        # Generate UUID to use in tests
        self.uuid = uuid4()

        self.user = get_default_user()
