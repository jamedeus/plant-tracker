# pylint: disable=missing-docstring,line-too-long,R0801,too-many-lines,too-many-public-methods,global-statement

from uuid import uuid4

from django.test import TestCase
from django.utils import timezone
from django.core.cache import cache
from django.test.client import MULTIPART_CONTENT

from .view_decorators import get_default_user
from .get_state_views import build_overview_state
from .models import Group, Plant, DivisionEvent, Photo
from .unit_test_helpers import (
    JSONClient,
    create_mock_photo,
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


class EndpointStateUpdateTests(TestCase):
    '''Tests that confirm each endpoint updates cached overview state correctly.'''

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

        # Generate cached overview state
        build_overview_state(self.user)

    def load_cached_overview_state(self):
        return cache.get(f'overview_state_{self.user.pk}')

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
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {
            'success': 'plant registered',
            'name': 'new plant',
            'uuid': str(new_plant_uuid)
        })

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

    def test_new_plant_registered_after_dividing_existing_plant(self):
        '''The overview state should update when a new child plant is registered.'''

        # Confirm overview state contains 2 plants
        initial_overview_state = self.load_cached_overview_state()
        self.assertEqual(len(initial_overview_state['plants']), 2)

        # Simulate division in progress (user hit /divide_plant endpoint)
        division_event = DivisionEvent.objects.create(
            plant=self.plant1,
            timestamp=timezone.now()
        )

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
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {
            'success': 'plant registered',
            'name': 'Unnamed plant 1 prop',
            'uuid': str(new_plant_uuid)
        })

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
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'success': 'group registered'})

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

    def test_plant_uuid_changed(self):
        '''The overview state should update when a plant's uuid is changed.'''

        # Save initial plant uuid, create new uuid
        initial_plant_uuid = str(self.plant1.uuid)
        new_plant_uuid = str(uuid4())

        # Confirm overview state contains 2 plants
        initial_overview_state = self.load_cached_overview_state()
        self.assertEqual(len(initial_overview_state['plants']), 2)

        # Change plant UUID with /change_uuid endpoint
        response = self.client.post('/change_uuid', {
            'uuid': initial_plant_uuid,
            'new_id': new_plant_uuid
        })
        self.assertEqual(response.status_code, 200)

        # Confirm original uuid was removed from overview state, new was added
        updated_overview_state = self.load_cached_overview_state()
        self.assertFalse(initial_plant_uuid in updated_overview_state['plants'])
        self.assertTrue(new_plant_uuid in updated_overview_state['plants'])

    def test_group_uuid_changed(self):
        '''The cached overview state should update when a group's uuid is changed.'''

        # Save initial group uuid, create new uuid
        initial_group_uuid = str(self.group1.uuid)
        new_group_uuid = str(uuid4())

        # Confirm overview state contains 2 groups
        initial_overview_state = self.load_cached_overview_state()
        self.assertEqual(len(initial_overview_state['groups']), 2)

        # Change group UUID with /change_uuid endpoint
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
        '''The cached overview state should update when plant details are edited.'''

        # Confirm plant has no details in cached overview state
        initial_overview_state = self.load_cached_overview_state()
        self.assertIsNone(initial_overview_state['plants'][str(self.plant1.uuid)]['name'])
        self.assertIsNone(initial_overview_state['plants'][str(self.plant1.uuid)]['species'])
        self.assertIsNone(initial_overview_state['plants'][str(self.plant1.uuid)]['description'])
        self.assertIsNone(initial_overview_state['plants'][str(self.plant1.uuid)]['pot_size'])

        # Edit plant details with /edit_plant_details endpoint
        response = self.client.post('/edit_plant_details', {
            'plant_id': self.plant1.uuid,
            'name': 'plant name',
            'species': 'Giant Sequoia',
            'description': '300 feet tall',
            'pot_size': '4'
        })
        self.assertEqual(response.status_code, 200)

        # Confirm details updated in cached overview state
        updated_overview_state = self.load_cached_overview_state()
        self.assertEqual(updated_overview_state['plants'][str(self.plant1.uuid)]['name'], 'plant name')
        self.assertEqual(updated_overview_state['plants'][str(self.plant1.uuid)]['species'], 'Giant Sequoia')
        self.assertEqual(updated_overview_state['plants'][str(self.plant1.uuid)]['description'], '300 feet tall')
        self.assertEqual(updated_overview_state['plants'][str(self.plant1.uuid)]['pot_size'], 4)

    def test_edit_group_details(self):
        '''The cached overview state should update when group details are edited.'''

        # Confirm no details in cached overview state
        initial_overview_state = self.load_cached_overview_state()
        self.assertIsNone(initial_overview_state['groups'][str(self.group1.uuid)]['name'])
        self.assertIsNone(initial_overview_state['groups'][str(self.group1.uuid)]['location'])
        self.assertIsNone(initial_overview_state['groups'][str(self.group1.uuid)]['description'])

        # Edit group details with /edit_group_details endpoint
        response = self.client.post('/edit_group_details', {
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

    def test_bulk_delete_plants(self):
        '''The cached overview state should update when a plant is deleted.'''

        # Confirm plants are in cached overview state
        plant1_uuid = str(self.plant1.uuid)
        plant2_uuid = str(self.plant2.uuid)
        self.assertTrue(plant1_uuid in self.load_cached_overview_state()['plants'])
        self.assertTrue(plant2_uuid in self.load_cached_overview_state()['plants'])

        # Delete plants with /bulk_delete_plants_and_groups endpoint
        response = self.client.post('/bulk_delete_plants_and_groups', {
            'uuids': [
                plant1_uuid,
                plant2_uuid
            ]
        })
        self.assertEqual(response.status_code, 200)

        # Confirm plants were removed from overview state
        updated_overview_state = self.load_cached_overview_state()
        self.assertFalse(plant1_uuid in self.load_cached_overview_state()['plants'])
        self.assertFalse(plant2_uuid in self.load_cached_overview_state()['plants'])
        self.assertEqual(len(updated_overview_state['plants']), 0)

    def test_bulk_delete_plants_that_are_in_group(self):
        '''The cached overview state should update the number of plants in a
        group when one of the plants is deleted.
        '''

        # Add plant1 to group1 with /add_plant_to_group endpoint
        response = self.client.post('/add_plant_to_group', {
            'plant_id': self.plant1.uuid,
            'group_id': self.group1.uuid
        })
        self.assertEqual(response.status_code, 200)

        # Confirm cached overview state says group1 has 1 plant
        self.assertEqual(
            self.load_cached_overview_state()['groups'][str(self.group1.uuid)]['plants'],
            1
        )

        # Delete plant1 with /bulk_delete_plants_and_groups endpoint
        response = self.client.post('/bulk_delete_plants_and_groups', {
            'uuids': [
                self.plant1.uuid
            ]
        })
        self.assertEqual(response.status_code, 200)

        # Confirm cached overview state now says group1 has 0 plants
        self.assertEqual(
            self.load_cached_overview_state()['groups'][str(self.group1.uuid)]['plants'],
            0
        )

    def test_bulk_archive_plants(self):
        '''The cached overview state should update when a plant is deleted.'''

        # Confirm plants are in cached overview state
        plant1_uuid = str(self.plant1.uuid)
        plant2_uuid = str(self.plant2.uuid)
        self.assertTrue(plant1_uuid in self.load_cached_overview_state()['plants'])
        self.assertTrue(plant2_uuid in self.load_cached_overview_state()['plants'])

        # Archive plants with /bulk_archive_plants_and_groups endpoint
        response = self.client.post('/bulk_archive_plants_and_groups', {
            'uuids': [
                plant1_uuid,
                plant2_uuid
            ],
            'archived': True
        })
        self.assertEqual(response.status_code, 200)

        # Confirm plants were removed from overview state
        updated_overview_state = self.load_cached_overview_state()
        self.assertFalse(plant1_uuid in self.load_cached_overview_state()['plants'])
        self.assertFalse(plant2_uuid in self.load_cached_overview_state()['plants'])
        self.assertEqual(len(updated_overview_state['plants']), 0)

    def test_bulk_delete_groups(self):
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

        # Confirm groups were removed from overview state
        updated_overview_state = self.load_cached_overview_state()
        self.assertFalse(group1_uuid in updated_overview_state['groups'])
        self.assertFalse(group2_uuid in updated_overview_state['groups'])
        self.assertEqual(len(updated_overview_state['groups']), 0)

    def test_bulk_archive_groups(self):
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

    def test_add_plant_event_water(self):
        '''The cached overview states should update when a WaterEvent is created.'''

        # Confirm that plant has no last_watered time in cached overview state
        self.assertIsNone(self.load_cached_overview_state()['plants'][str(self.plant1.uuid)]['last_watered'])

        # Water plant with /add_plant_event endpoint
        response = self.client.post('/add_plant_event', {
            'plant_id': self.plant1.uuid,
            'event_type': 'water',
            'timestamp': '2024-02-06T03:06:26.000Z'
        })
        self.assertEqual(response.status_code, 200)

        # Confirm last_watered updated in cached overview state
        self.assertEqual(
            self.load_cached_overview_state()['plants'][str(self.plant1.uuid)]['last_watered'],
            '2024-02-06T03:06:26+00:00'
        )

    def test_add_plant_event_fertilize(self):
        '''The cached overview state should update when a FertilizeEvent is created.'''

        # Confirm that plant has no last_fertilized time in cached overview state
        self.assertIsNone(self.load_cached_overview_state()['plants'][str(self.plant1.uuid)]['last_fertilized'])

        # Fertilize plant with /add_plant_event endpoint
        response = self.client.post('/add_plant_event', {
            'plant_id': self.plant1.uuid,
            'event_type': 'fertilize',
            'timestamp': '2024-02-06T03:06:26.000Z'
        })
        self.assertEqual(response.status_code, 200)

        # Confirm last_fertilized updated in cached overview state
        self.assertEqual(
            self.load_cached_overview_state()['plants'][str(self.plant1.uuid)]['last_fertilized'],
            '2024-02-06T03:06:26+00:00'
        )

    def test_bulk_add_plant_events_water(self):
        '''The cached overview state should update when WaterEvents are bulk created.'''

        # Confirm that neither plant has last_watered time in cached overview state
        self.assertIsNone(self.load_cached_overview_state()['plants'][str(self.plant1.uuid)]['last_watered'])

        # Bulk water plants with /bulk_add_plant_events endpoint
        response = self.client.post('/bulk_add_plant_events', {
            'plants': [
                str(self.plant1.uuid),
                str(self.plant2.uuid),
            ],
            'event_type': 'water',
            'timestamp': '2024-02-06T03:06:26.000Z'
        })
        self.assertEqual(response.status_code, 200)

        # Confirm last_watered updated in cached overview state
        self.assertEqual(
            self.load_cached_overview_state()['plants'][str(self.plant1.uuid)]['last_watered'],
            '2024-02-06T03:06:26+00:00'
        )
        self.assertEqual(
            self.load_cached_overview_state()['plants'][str(self.plant2.uuid)]['last_watered'],
            '2024-02-06T03:06:26+00:00'
        )

    def test_bulk_add_plant_events_fertilize(self):
        '''The cached overview state should update when FertilizeEvents are bulk created.'''

        # Confirm that plant has no last_fertilized time in cached overview state
        self.assertIsNone(
            self.load_cached_overview_state()['plants'][str(self.plant1.uuid)]['last_fertilized']
        )

        # Bulk fertilize plants with /bulk_add_plant_events endpoint
        response = self.client.post('/bulk_add_plant_events', {
            'plants': [
                str(self.plant1.uuid),
                str(self.plant2.uuid),
            ],
            'event_type': 'fertilize',
            'timestamp': '2024-02-06T03:06:26.000Z'
        })
        self.assertEqual(response.status_code, 200)

        # Confirm last_fertilized updated in cached overview state
        self.assertEqual(
            self.load_cached_overview_state()['plants'][str(self.plant1.uuid)]['last_fertilized'],
            '2024-02-06T03:06:26+00:00'
        )
        self.assertEqual(
            self.load_cached_overview_state()['plants'][str(self.plant2.uuid)]['last_fertilized'],
            '2024-02-06T03:06:26+00:00'
        )

    def test_delete_plant_events_water(self):
        '''The cached overview state should update when WaterEvents are bulk deleted.'''

        # Create 2 water events for plant1
        self.client.post('/add_plant_event', {
            'plant_id': self.plant1.uuid,
            'event_type': 'water',
            'timestamp': '2024-02-06T03:06:26.000Z'
        })
        self.client.post('/add_plant_event', {
            'plant_id': self.plant1.uuid,
            'event_type': 'water',
            'timestamp': '2024-02-05T03:06:26.000Z'
        })

        # Confirm last_watered is set to most recent event in cached overview state
        self.assertEqual(
            self.load_cached_overview_state()['plants'][str(self.plant1.uuid)]['last_watered'],
            '2024-02-06T03:06:26+00:00'
        )

        # Delete water events with /delete_plant_events endpoint
        response = self.client.post('/delete_plant_events', {
            'plant_id': self.plant1.uuid,
            'events': {
                'water': [
                    '2024-02-06T03:06:26+00:00',
                    '2024-02-05T03:06:26+00:00'
                ],
                'fertilize': [],
                'prune': [],
                'repot': [],
            }
        })
        self.assertEqual(response.status_code, 200)

        # Confirm last_watered is was cleared in cached overview state
        self.assertIsNone(
            self.load_cached_overview_state()['plants'][str(self.plant1.uuid)]['last_watered']
        )

    def test_delete_plant_events_fertilize(self):
        '''The cached overview state should update when FertilizeEvents are bulk deleted.'''

        # Create 2 fertilize events for plant1
        self.client.post('/add_plant_event', {
            'plant_id': self.plant1.uuid,
            'event_type': 'fertilize',
            'timestamp': '2024-02-06T03:06:26.000Z'
        })
        self.client.post('/add_plant_event', {
            'plant_id': self.plant1.uuid,
            'event_type': 'fertilize',
            'timestamp': '2024-02-05T03:06:26.000Z'
        })

        # Confirm last_fertilized is set to most recent event in cached overview state
        self.assertEqual(
            self.load_cached_overview_state()['plants'][str(self.plant1.uuid)]['last_fertilized'],
            '2024-02-06T03:06:26+00:00'
        )

        # Delete fertilize events with /delete_plant_events endpoint
        response = self.client.post('/delete_plant_events', {
            'plant_id': self.plant1.uuid,
            'events': {
                'water': [],
                'fertilize': [
                    '2024-02-06T03:06:26+00:00',
                    '2024-02-05T03:06:26+00:00'
                ],
                'prune': [],
                'repot': [],
            }
        })
        self.assertEqual(response.status_code, 200)

        # Confirm last_fertilized is was cleared in cached overview state
        self.assertIsNone(
            self.load_cached_overview_state()['plants'][str(self.plant1.uuid)]['last_fertilized']
        )

    def test_add_plant_to_group(self):
        '''The cached overview state should update when a plant is added to a group.'''

        # Confirm cached overview state says plant1 is not in a group
        self.assertIsNone(
            self.load_cached_overview_state()['plants'][str(self.plant1.uuid)]['group']
        )
        # Confirm cached overview state says group1 has no plants
        self.assertEqual(
            self.load_cached_overview_state()['groups'][str(self.group1.uuid)]['plants'],
            0
        )

        # Add plant1 to group1 with /add_plant_to_group endpoint
        response = self.client.post('/add_plant_to_group', {
            'plant_id': self.plant1.uuid,
            'group_id': self.group1.uuid
        })
        self.assertEqual(response.status_code, 200)

        # Confirm cached overview state now says plant1 is in group1
        self.assertEqual(
            self.load_cached_overview_state()['plants'][str(self.plant1.uuid)]['group'],
            {"name": "Unnamed group 1", "uuid": str(self.group1.uuid)}
        )
        # Confirm cached overview state says group1 has 1 plant
        self.assertEqual(
            self.load_cached_overview_state()['groups'][str(self.group1.uuid)]['plants'],
            1
        )

    def test_remove_plant_from_group(self):
        '''The cached overview state should update when a plant is added to a group.'''

        # Add plant1 to group1 with /add_plant_to_group endpoint
        response = self.client.post('/add_plant_to_group', {
            'plant_id': self.plant1.uuid,
            'group_id': self.group1.uuid
        })
        self.assertEqual(response.status_code, 200)

        # Confirm cached overview state says plant1 is in group1
        self.assertEqual(
            self.load_cached_overview_state()['plants'][str(self.plant1.uuid)]['group'],
            {"name": "Unnamed group 1", "uuid": str(self.group1.uuid)}
        )
        # Confirm cached overview state says group1 has 1 plant
        self.assertEqual(
            self.load_cached_overview_state()['groups'][str(self.group1.uuid)]['plants'],
            1
        )

        # Remove plant1 to group1 with /remove_plant_from_group endpoint
        response = self.client.post('/remove_plant_from_group', {
            'plant_id': self.plant1.uuid
        })
        self.assertEqual(response.status_code, 200)

        # Confirm cached overview state now says plant1 is not in a group
        self.assertIsNone(
            self.load_cached_overview_state()['plants'][str(self.plant1.uuid)]['group']
        )
        # Confirm cached overview state now says group1 has no plants
        self.assertEqual(
            self.load_cached_overview_state()['groups'][str(self.group1.uuid)]['plants'],
            0
        )

    def test_bulk_add_plants_to_group(self):
        '''The cached overview state should update when plants are bulk added to a group.'''

        # Confirm cached overview state says plant1 is not in a group
        self.assertIsNone(
            self.load_cached_overview_state()['plants'][str(self.plant1.uuid)]['group']
        )
        # Confirm cached overview state says plant2 is not in a group
        self.assertIsNone(
            self.load_cached_overview_state()['plants'][str(self.plant2.uuid)]['group']
        )
        # Confirm cached overview state says group1 has no plants
        self.assertEqual(
            self.load_cached_overview_state()['groups'][str(self.group1.uuid)]['plants'],
            0
        )

        # Add plant1 and plant2 to group1 with /bulk_add_plants_to_group endpoint
        response = self.client.post('/bulk_add_plants_to_group', {
            'group_id': self.group1.uuid,
            'plants': [
                self.plant1.uuid,
                self.plant2.uuid
            ]
        })
        self.assertEqual(response.status_code, 200)

        # Confirm cached overview state now says plant1 is in group1
        self.assertEqual(
            self.load_cached_overview_state()['plants'][str(self.plant1.uuid)]['group'],
            {"name": "Unnamed group 1", "uuid": str(self.group1.uuid)}
        )
        # Confirm cached overview state now says plant2 is in group1
        self.assertEqual(
            self.load_cached_overview_state()['plants'][str(self.plant2.uuid)]['group'],
            {"name": "Unnamed group 1", "uuid": str(self.group1.uuid)}
        )
        # Confirm cached overview state says group1 has 2 plant
        self.assertEqual(
            self.load_cached_overview_state()['groups'][str(self.group1.uuid)]['plants'],
            2
        )

    def test_bulk_remove_plants_from_group(self):
        '''The cached overview state should update when plants are bulk removed from a group.'''

        # Add plant1 and plant2 to group1 with /bulk_add_plants_to_group endpoint
        response = self.client.post('/bulk_add_plants_to_group', {
            'group_id': self.group1.uuid,
            'plants': [
                self.plant1.uuid,
                self.plant2.uuid
            ]
        })
        self.assertEqual(response.status_code, 200)

        # Confirm cached overview state says plant1 is in group1
        self.assertEqual(
            self.load_cached_overview_state()['plants'][str(self.plant1.uuid)]['group'],
            {"name": "Unnamed group 1", "uuid": str(self.group1.uuid)}
        )
        # Confirm cached overview state says plant2 is in group1
        self.assertEqual(
            self.load_cached_overview_state()['plants'][str(self.plant2.uuid)]['group'],
            {"name": "Unnamed group 1", "uuid": str(self.group1.uuid)}
        )
        # Confirm cached overview state says group1 has 2 plant
        self.assertEqual(
            self.load_cached_overview_state()['groups'][str(self.group1.uuid)]['plants'],
            2
        )

        # Remove plant1 and plant2 from group1 with /bulk_remove_plants_from_group endpoint
        response = self.client.post('/bulk_remove_plants_from_group', {
            'group_id': self.group1.uuid,
            'plants': [
                self.plant1.uuid,
                self.plant2.uuid
            ]
        })
        self.assertEqual(response.status_code, 200)

        # Confirm cached overview state now says plant1 is not in a group
        self.assertIsNone(
            self.load_cached_overview_state()['plants'][str(self.plant1.uuid)]['group']
        )
        # Confirm cached overview state now says plant2 is not in a group
        self.assertIsNone(
            self.load_cached_overview_state()['plants'][str(self.plant2.uuid)]['group']
        )
        # Confirm cached overview state now says group1 has no plants
        self.assertEqual(
            self.load_cached_overview_state()['groups'][str(self.group1.uuid)]['plants'],
            0
        )

    def test_repot_plant(self):
        '''The cached overview state should update when a plant's pot size changes.'''

        # Confirm plant pot_size is not set in cached overview
        self.assertIsNone(
            self.load_cached_overview_state()['plants'][str(self.plant1.uuid)]['pot_size']
        )

        # Repot plant with /repot_plant endpoint
        response = self.client.post('/repot_plant', {
            'plant_id': self.plant1.uuid,
            'timestamp': '2024-02-06T03:06:26.000Z',
            'new_pot_size': 6
        })
        self.assertEqual(response.status_code, 200)

        # Confirm plant pot_size updated in cached overview
        self.assertEqual(
            self.load_cached_overview_state()['plants'][str(self.plant1.uuid)]['pot_size'],
            6
        )

    def test_add_plant_photos(self):
        '''The cached overview state should update when a plant's most-recent photo changes.'''

        # Confirm cached overview state has no thumbnail for plant1
        self.assertIsNone(
            self.load_cached_overview_state()['plants'][str(self.plant1.uuid)]['thumbnail']
        )

        # Add plant photo with /add_plant_photos endpoint
        data = {
            'plant_id': str(self.plant1.uuid),
            'photo_0': create_mock_photo('2024:03:22 10:52:03', 'new_photo.jpg')
        }
        response = self.client.post(
            '/add_plant_photos',
            data=data,
            content_type=MULTIPART_CONTENT
        )
        self.assertEqual(response.status_code, 200)

        # Confirm cached overview state now has new photo thumbnail for plant1
        self.assertEqual(
            self.load_cached_overview_state()['plants'][str(self.plant1.uuid)]['thumbnail'],
            '/media/user_1/thumbnails/new_photo_thumb.webp'
        )

    def test_delete_plant_photos(self):
        '''The cached overview state should update when a plant's most-recent photo changes.'''

        # Add plant photo with /add_plant_photos endpoint
        data = {
            'plant_id': str(self.plant1.uuid),
            'photo_0': create_mock_photo('2024:03:22 10:52:03', 'existing_photo.jpg')
        }
        response = self.client.post(
            '/add_plant_photos',
            data=data,
            content_type=MULTIPART_CONTENT
        )
        self.assertEqual(response.status_code, 200)

        # Confirm cached overview state has photo thumbnail for plant1
        self.assertEqual(
            self.load_cached_overview_state()['plants'][str(self.plant1.uuid)]['thumbnail'],
            '/media/user_1/thumbnails/existing_photo_thumb.webp'
        )

        # Delete photo with /delete_plant_photos endpoint
        response = self.client.post('/delete_plant_photos', {
            'plant_id': str(self.plant1.uuid),
            'photos': [
                Photo.objects.all()[0].pk
            ]
        })

        # Confirm cached overview state no longer has thumbnail for plant1
        self.assertIsNone(
            self.load_cached_overview_state()['plants'][str(self.plant1.uuid)]['thumbnail']
        )

    def test_set_plant_default_photo(self):
        '''The cached overview should update when the default photo is changed.'''

        # Add 2 plant photos with /add_plant_photos endpoint
        data = {
            'plant_id': str(self.plant1.uuid),
            'photo_0': create_mock_photo('2024:03:22 10:52:03', 'older_photo.jpg'),
            'photo_1': create_mock_photo('2024:03:23 10:52:03', 'newer_photo.jpg')
        }
        response = self.client.post(
            '/add_plant_photos',
            data=data,
            content_type=MULTIPART_CONTENT
        )
        self.assertEqual(response.status_code, 200)
        older_photo = Photo.objects.all()[0]

        # Confirm cached overview state used most-recent photo for thumbnail
        self.assertEqual(
            self.load_cached_overview_state()['plants'][str(self.plant1.uuid)]['thumbnail'],
            '/media/user_1/thumbnails/newer_photo_thumb.webp'
        )

        # Set older photo as default with /set_plant_default_photo endpoint
        response = self.client.post('/set_plant_default_photo', {
            'plant_id': str(self.plant1.uuid),
            'photo_key': older_photo.pk
        })
        self.assertEqual(response.status_code, 200)

        # Confirm cached overview state changed thumbnail to older photo
        self.assertEqual(
            self.load_cached_overview_state()['plants'][str(self.plant1.uuid)]['thumbnail'],
            '/media/user_1/thumbnails/older_photo_thumb.webp'
        )
