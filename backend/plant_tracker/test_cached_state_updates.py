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
from .build_states import build_overview_state, build_manage_plant_state
from .tasks import update_cached_overview_state, update_all_cached_states
from .unit_test_helpers import JSONClient, create_mock_photo


def tearDownModule():
    # Delete mock photo directory after tests
    print("\nDeleting mock photos...\n")
    shutil.rmtree(settings.TEST_DIR, ignore_errors=True)


class EndpointStateUpdateTests(TestCase):
    '''Tests that confirm each endpoint updates cached states correctly.'''

    def setUp(self):
        # Set default content_type for post requests (avoid long lines)
        self.client = JSONClient()

        # Create test model entries
        self.user = get_default_user()
        self.plant1 = Plant.objects.create(user=self.user, uuid=uuid4())
        self.plant2 = Plant.objects.create(user=self.user, uuid=uuid4())
        self.group1 = Group.objects.create(user=self.user, uuid=uuid4())
        self.group2 = Group.objects.create(user=self.user, uuid=uuid4())

        # Clear entire cache before each test
        cache.clear()

        # Generate cache overview and manage_plant states
        build_overview_state(self.user)
        build_manage_plant_state(
            Plant.objects.get_with_manage_plant_annotation(self.plant1.uuid)
        )
        build_manage_plant_state(
            Plant.objects.get_with_manage_plant_annotation(self.plant2.uuid)
        )

    def load_cached_overview_state(self):
        return cache.get(f'overview_state_{self.user.pk}')

    def load_cached_plant1_state(self):
        return cache.get(f'{self.plant1.uuid}_state')

    def load_cached_plant2_state(self):
        return cache.get(f'{self.plant2.uuid}_state')

    def test_new_plant_registered(self):
        '''The overview state should update when a new plant is registered, but
        a state should NOT be cached for the new plant.
        '''

        # Confirm overview state contains 2 plants
        initial_overview_state = self.load_cached_overview_state()
        self.assertEqual(len(initial_overview_state['plants']), 2)

        # Create new plant with /register_plant endpoint, confirm successful
        new_plant_uuid = str(uuid4())
        response = self.client.post('/register_plant', {
            'uuid': new_plant_uuid,
            'name': 'new plant',
            'species': 'Giant Sequoia',
            'description': '300 feet and a few thousand years old',
            'pot_size': '4'
        })
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.url, f'/manage/{new_plant_uuid}')

        # Confirm new plant was added to cached overview state
        updated_overview_state = self.load_cached_overview_state()
        self.assertEqual(len(updated_overview_state['plants']), 3)
        self.assertEqual(
            updated_overview_state['plants'][new_plant_uuid],
            {
                "name": "new plant",
                "display_name": "new plant",
                "uuid": str(new_plant_uuid),
                "archived": False,
                "created": Plant.objects.get(uuid=new_plant_uuid).created.isoformat(),
                "species": "Giant Sequoia",
                "description": "300 feet and a few thousand years old",
                "pot_size": 4,
                "last_watered": None,
                "last_fertilized": None,
                "thumbnail": None,
                "group": None
            }
        )

        # Confirm no state was generated for the new plant
        self.assertIsNone(cache.get(f'{new_plant_uuid}_state'))

    def test_new_plant_registered_after_dividing_existing_plant(self):
        '''The overview and parent plant states should update when a new child
        plant is registered, but a state should NOT be cached for the new plant.
        '''

        # Confirm overview state contains 2 plants
        initial_overview_state = self.load_cached_overview_state()
        self.assertEqual(len(initial_overview_state['plants']), 2)
        # Confirm the parent plant has no DivisionEvents
        initial_parent_plant_state = self.load_cached_plant1_state()
        self.assertEqual(initial_parent_plant_state['division_events'], {})

        # Simulate division in progress (user hit /divide_plant endpoint)
        division_event = DivisionEvent.objects.create(
            plant=self.plant1,
            timestamp=timezone.now()
        )
        cache.set(f'division_in_progress_{self.user.pk}', {
            'divided_from_plant_uuid': str(self.plant1.uuid),
            'division_event_key': str(division_event.pk)
        }, 900)

        # Create new child plant with /register_plant endpoint, confirm successful
        new_plant_uuid = str(uuid4())
        response = self.client.post('/register_plant', {
            'uuid': new_plant_uuid,
            'name': 'Unnamed plant 1 prop',
            'species': '',
            'description': 'Divided from Unnamed plant 1',
            'pot_size': '',
            'divided_from_id': str(self.plant1.pk),
            'divided_from_event_id': str(division_event.pk)
        })
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.url, f'/manage/{new_plant_uuid}')

        # Confirm new plant was added to cached overview state
        updated_overview_state = self.load_cached_overview_state()
        self.assertEqual(len(updated_overview_state['plants']), 3)
        self.assertEqual(
            updated_overview_state['plants'][new_plant_uuid],
            {
                "name": "Unnamed plant 1 prop",
                "display_name": "Unnamed plant 1 prop",
                "uuid": str(new_plant_uuid),
                "archived": False,
                "created": Plant.objects.get(uuid=new_plant_uuid).created.isoformat(),
                "species": None,
                "description": 'Divided from Unnamed plant 1',
                "pot_size": None,
                "last_watered": None,
                "last_fertilized": None,
                "thumbnail": None,
                "group": None
            }
        )

        # Confirm new plant was added to cached plant1 state division_events
        updated_parent_plant_state = self.load_cached_plant1_state()
        self.assertEqual(
            updated_parent_plant_state['division_events'],
            {
                division_event.timestamp.isoformat(): [
                    {'name': 'Unnamed plant 1 prop', 'uuid': str(new_plant_uuid)}
                ]
            }
        )

    def test_new_group_registered(self):
        '''The overview state should update when a new group is registered, but
        a state should NOT be cached for the new group.
        '''

        # Confirm overview state contains 2 groups
        initial_overview_state = self.load_cached_overview_state()
        self.assertEqual(len(initial_overview_state['groups']), 2)

        # Create new group with /register_group endpoint, confirm successful
        new_group_uuid = str(uuid4())
        response = self.client.post('/register_group', {
            'uuid': new_group_uuid,
            'name': 'new group',
            'location': 'outside',
            'description': ''
        })
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.url, f'/manage/{new_group_uuid}')

        # Confirm new group was added to cached overview state
        updated_overview_state = self.load_cached_overview_state()
        self.assertEqual(len(updated_overview_state['groups']), 3)
        self.assertEqual(
            updated_overview_state['groups'][new_group_uuid],
            {
                "name": "new group",
                "display_name": "new group",
                "uuid": str(new_group_uuid),
                "archived": False,
                "created": Group.objects.get(uuid=new_group_uuid).created.isoformat(),
                "location": "outside",
                "description": None,
                "plants": 0
            }
        )

        # Confirm no state was generated for the new group
        self.assertIsNone(cache.get(f'{new_group_uuid}_state'))

    def test_plant_uuid_changed(self):
        '''The overview state and cached manage_plant state should update when a
        plant's uuid is changed.
        '''

        # Save initial plant uuid, create new uuid
        initial_plant_uuid = str(self.plant1.uuid)
        new_plant_uuid = str(uuid4())

        # Confirm overview state contains 2 plants, manage_plant state exists
        initial_overview_state = self.load_cached_overview_state()
        self.assertEqual(len(initial_overview_state['plants']), 2)
        self.assertIsInstance(cache.get(f'{initial_plant_uuid}_state'), dict)

        # Change plant UUID with /change_uuid endpoint
        cache.set(f'old_uuid_{self.user.pk}', initial_plant_uuid, 900)
        response = self.client.post('/change_uuid', {
            'uuid': initial_plant_uuid,
            'new_id': new_plant_uuid
        })
        self.assertEqual(response.status_code, 200)

        # Confirm original uuid was removed from overview state, new was added
        updated_overview_state = self.load_cached_overview_state()
        self.assertFalse(initial_plant_uuid in updated_overview_state['plants'])
        self.assertTrue(new_plant_uuid in updated_overview_state['plants'])

        # Confirm original cached plant state was deleted, no new state cached
        self.assertIsNone(cache.get(f'{initial_plant_uuid}_state'))
        self.assertIsNone(cache.get(f'{new_plant_uuid}_state'))

    def test_group_uuid_changed(self):
        '''The cached overview state should update when a group's uuid is changed.'''

        # Save initial group uuid, create new uuid
        initial_group_uuid = str(self.group1.uuid)
        new_group_uuid = str(uuid4())

        # Confirm overview state contains 2 groups
        initial_overview_state = self.load_cached_overview_state()
        self.assertEqual(len(initial_overview_state['groups']), 2)

        # Change group UUID with /change_uuid endpoint
        cache.set(f'old_uuid_{self.user.pk}', initial_group_uuid, 900)
        response = self.client.post('/change_uuid', {
            'uuid': initial_group_uuid,
            'new_id': new_group_uuid
        })
        self.assertEqual(response.status_code, 200)

        # Confirm original uuid was removed from overview state, new was added
        updated_overview_state = self.load_cached_overview_state()
        self.assertFalse(initial_group_uuid in updated_overview_state['groups'])
        self.assertTrue(new_group_uuid in updated_overview_state['groups'])

    def test_edit_plant_details(self):
        '''The cached overview and plant states should update when a plant's
        details are edited.
        '''

        # Confirm no details in cached states
        initial_overview_state = self.load_cached_overview_state()
        self.assertIsNone(initial_overview_state['plants'][str(self.plant1.uuid)]['name'])
        self.assertIsNone(initial_overview_state['plants'][str(self.plant1.uuid)]['species'])
        self.assertIsNone(initial_overview_state['plants'][str(self.plant1.uuid)]['description'])
        self.assertIsNone(initial_overview_state['plants'][str(self.plant1.uuid)]['pot_size'])
        initial_plant_state = self.load_cached_plant1_state()
        self.assertIsNone(initial_plant_state['plant_details']['name'])
        self.assertIsNone(initial_plant_state['plant_details']['species'])
        self.assertIsNone(initial_plant_state['plant_details']['description'])
        self.assertIsNone(initial_plant_state['plant_details']['pot_size'])

        # Edit plant details with /edit_plant endpoint
        response = self.client.post('/edit_plant', {
            'plant_id': self.plant1.uuid,
            'name': 'plant name',
            'species': 'Giant Sequoia',
            'description': '300 feet tall',
            'pot_size': '4'
        })
        self.assertEqual(response.status_code, 200)

        # Confirm details updated in both cached states
        updated_overview_state = self.load_cached_overview_state()
        self.assertEqual(updated_overview_state['plants'][str(self.plant1.uuid)]['name'], 'plant name')
        self.assertEqual(updated_overview_state['plants'][str(self.plant1.uuid)]['species'], 'Giant Sequoia')
        self.assertEqual(updated_overview_state['plants'][str(self.plant1.uuid)]['description'], '300 feet tall')
        self.assertEqual(updated_overview_state['plants'][str(self.plant1.uuid)]['pot_size'], 4)
        updated_plant_state = self.load_cached_plant1_state()
        self.assertEqual(updated_plant_state['plant_details']['name'], 'plant name')
        self.assertEqual(updated_plant_state['plant_details']['species'], 'Giant Sequoia')
        self.assertEqual(updated_plant_state['plant_details']['description'], '300 feet tall')
        self.assertEqual(updated_plant_state['plant_details']['pot_size'], 4)

    def test_edit_group_details(self):
        '''The cached overview state should update when a groups's details are edited.'''

        # Confirm no details in cached overview state
        initial_overview_state = self.load_cached_overview_state()
        self.assertIsNone(initial_overview_state['groups'][str(self.group1.uuid)]['name'])
        self.assertIsNone(initial_overview_state['groups'][str(self.group1.uuid)]['location'])
        self.assertIsNone(initial_overview_state['groups'][str(self.group1.uuid)]['description'])

        # Edit group details with /edit_group endpoint
        response = self.client.post('/edit_group', {
            'group_id': self.group1.uuid,
            'name': 'group name',
            'location': 'Outside',
            'description': 'Back yard',
            'pot_size': '4'
        })
        self.assertEqual(response.status_code, 200)

        # Confirm details updated in both cached states
        updated_overview_state = self.load_cached_overview_state()
        self.assertEqual(updated_overview_state['groups'][str(self.group1.uuid)]['name'], 'group name')
        self.assertEqual(updated_overview_state['groups'][str(self.group1.uuid)]['location'], 'Outside')
        self.assertEqual(updated_overview_state['groups'][str(self.group1.uuid)]['description'], 'Back yard')

    def test_delete_plant(self):
        '''The cached overview state should update and the cached plant state
        should be deleted when a plant is deleted.
        '''

        # Confirm plant is in cached overview state, has own cached state
        plant_uuid = str(self.plant1.uuid)
        self.assertTrue(plant_uuid in self.load_cached_overview_state()['plants'])
        self.assertIsNotNone(cache.get(f'{plant_uuid}_state'))

        # Delete plant with /delete_plant endpoint
        response = self.client.post('/delete_plant', {
            'plant_id': plant_uuid
        })
        self.assertEqual(response.status_code, 200)

        # Confirm plant was removed from overview state, own state was deleted
        updated_overview_state = self.load_cached_overview_state()
        self.assertFalse(plant_uuid in updated_overview_state['plants'])
        self.assertEqual(len(updated_overview_state['plants']), 1)
        self.assertIsNone(cache.get(f'{plant_uuid}_state'))

    def test_archive_plant(self):
        '''The cached overview and plant states should update when a plant is archived.'''

        # Confirm plant is in cached overview state, has own cached state
        plant_uuid = str(self.plant1.uuid)
        self.assertTrue(plant_uuid in self.load_cached_overview_state()['plants'])
        initial_plant_state = cache.get(f'{plant_uuid}_state')
        self.assertFalse(initial_plant_state['plant_details']['archived'])

        # Archive plant with /archive_plant endpoint
        response = self.client.post('/archive_plant', {
            'plant_id': plant_uuid,
            'archived': True
        })
        self.assertEqual(response.status_code, 200)

        # Confirm plant was removed from overview state, own state was updated
        updated_overview_state = self.load_cached_overview_state()
        self.assertFalse(plant_uuid in updated_overview_state)
        self.assertEqual(len(updated_overview_state['plants']), 1)
        updated_plant_state = cache.get(f'{plant_uuid}_state')
        self.assertTrue(updated_plant_state['plant_details']['archived'])

    def test_bulk_delete_plant(self):
        '''The cached overview state should update and the cached plant state
        should be deleted when a plant is deleted.
        '''

        # Confirm plants are in cached overview state, have own cached states
        plant1_uuid = str(self.plant1.uuid)
        plant2_uuid = str(self.plant2.uuid)
        self.assertTrue(plant1_uuid in self.load_cached_overview_state()['plants'])
        self.assertTrue(plant2_uuid in self.load_cached_overview_state()['plants'])
        self.assertIsNotNone(cache.get(f'{plant1_uuid}_state'))
        self.assertIsNotNone(cache.get(f'{plant2_uuid}_state'))

        # Delete plants with /bulk_delete_plants_and_groups endpoint
        response = self.client.post('/bulk_delete_plants_and_groups', {
            'uuids': [
                plant1_uuid,
                plant2_uuid
            ]
        })
        self.assertEqual(response.status_code, 200)

        # Confirm plants were removed from overview state, own states were deleted
        updated_overview_state = self.load_cached_overview_state()
        self.assertFalse(plant1_uuid in self.load_cached_overview_state()['plants'])
        self.assertFalse(plant2_uuid in self.load_cached_overview_state()['plants'])
        self.assertEqual(len(updated_overview_state['plants']), 0)
        self.assertIsNone(cache.get(f'{plant1_uuid}_state'))
        self.assertIsNone(cache.get(f'{plant2_uuid}_state'))

    def test_bulk_archive_plant(self):
        '''The cached overview state should update and the cached plant state
        should be deleted when a plant is deleted.
        '''

        # Confirm plants are in cached overview state, have own cached states
        plant1_uuid = str(self.plant1.uuid)
        plant2_uuid = str(self.plant2.uuid)
        self.assertTrue(plant1_uuid in self.load_cached_overview_state()['plants'])
        self.assertTrue(plant2_uuid in self.load_cached_overview_state()['plants'])
        initial_plant1_state = cache.get(f'{plant1_uuid}_state')
        self.assertFalse(initial_plant1_state['plant_details']['archived'])
        initial_plant2_state = cache.get(f'{plant2_uuid}_state')
        self.assertFalse(initial_plant2_state['plant_details']['archived'])

        # Archive plants with /bulk_archive_plants_and_groups endpoint
        response = self.client.post('/bulk_archive_plants_and_groups', {
            'uuids': [
                plant1_uuid,
                plant2_uuid
            ],
            'archived': True
        })
        self.assertEqual(response.status_code, 200)

        # Confirm plants were removed from overview state, own states were updated
        updated_overview_state = self.load_cached_overview_state()
        self.assertFalse(plant1_uuid in self.load_cached_overview_state()['plants'])
        self.assertFalse(plant2_uuid in self.load_cached_overview_state()['plants'])
        self.assertEqual(len(updated_overview_state['plants']), 0)
        updated_plant1_state = cache.get(f'{plant1_uuid}_state')
        self.assertTrue(updated_plant1_state['plant_details']['archived'])
        updated_plant2_state = cache.get(f'{plant2_uuid}_state')
        self.assertTrue(updated_plant2_state['plant_details']['archived'])

    def test_delete_group(self):
        '''The cached overview state should update when a group is deleted.'''

        # Confirm plant is in cached overview state
        group_uuid = str(self.group1.uuid)
        self.assertTrue(group_uuid in self.load_cached_overview_state()['groups'])

        # Delete group with /delete_group endpoint
        response = self.client.post('/delete_group', {
            'group_id': group_uuid
        })
        self.assertEqual(response.status_code, 200)

        # Confirm group was removed from overview state
        updated_overview_state = self.load_cached_overview_state()
        self.assertFalse(group_uuid in updated_overview_state)
        self.assertEqual(len(updated_overview_state['groups']), 1)

    def test_archive_group(self):
        '''The cached overview state should update when a group is archived.'''

        # Confirm group is in cached overview state, has own cached state
        group_uuid = str(self.group1.uuid)
        self.assertTrue(group_uuid in self.load_cached_overview_state()['groups'])

        # Archive group with /archive_group endpoint
        response = self.client.post('/archive_group', {
            'group_id': group_uuid,
            'archived': True
        })
        self.assertEqual(response.status_code, 200)

        # Confirm group was removed from overview state
        updated_overview_state = self.load_cached_overview_state()
        self.assertFalse(group_uuid in updated_overview_state)
        self.assertEqual(len(updated_overview_state['groups']), 1)

    def test_bulk_delete_group(self):
        '''The cached overview state should update and the cached group state
        should be deleted when a group is deleted.
        '''

        # Confirm groups are in cached overview state, have own cached states
        group1_uuid = str(self.group1.uuid)
        group2_uuid = str(self.group2.uuid)
        initial_overview_state = self.load_cached_overview_state()
        self.assertTrue(group1_uuid in initial_overview_state['groups'])
        self.assertTrue(group2_uuid in initial_overview_state['groups'])

        # Delete groups with /bulk_delete_plants_and_groups endpoint
        response = self.client.post('/bulk_delete_plants_and_groups', {
            'uuids': [
                group1_uuid,
                group2_uuid
            ],
            'archived': True
        })
        self.assertEqual(response.status_code, 200)

        # Confirm groups were removed from overview state, own states were deleted
        updated_overview_state = self.load_cached_overview_state()
        self.assertFalse(group1_uuid in updated_overview_state['groups'])
        self.assertFalse(group2_uuid in updated_overview_state['groups'])
        self.assertEqual(len(updated_overview_state['groups']), 0)
        self.assertIsNone(cache.get(f'{group1_uuid}_state'))
        self.assertIsNone(cache.get(f'{group2_uuid}_state'))

    def test_bulk_archive_group(self):
        '''The cached overview state should update and the cached group state
        should be deleted when a group is deleted.
        '''

        # Confirm groups are in cached overview state
        group1_uuid = str(self.group1.uuid)
        group2_uuid = str(self.group2.uuid)
        initial_overview_state = self.load_cached_overview_state()
        self.assertTrue(group1_uuid in initial_overview_state['groups'])
        self.assertTrue(group2_uuid in initial_overview_state['groups'])

        # Archive groups with /bulk_archive_plants_and_groups endpoint
        response = self.client.post('/bulk_archive_plants_and_groups', {
            'uuids': [
                group1_uuid,
                group2_uuid
            ],
            'archived': True
        })
        self.assertEqual(response.status_code, 200)

        # Confirm groups were removed from overview state
        updated_overview_state = self.load_cached_overview_state()
        self.assertFalse(group1_uuid in updated_overview_state['groups'])
        self.assertFalse(group2_uuid in updated_overview_state['groups'])
        self.assertEqual(len(updated_overview_state['groups']), 0)
