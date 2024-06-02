import os
import json
import base64
import shutil
from uuid import uuid4

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
from .view_decorators import (
    get_plant_from_post_body,
    get_group_from_post_body,
    get_qr_instance_from_post_body,
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


class OverviewTests(TestCase):
    def setUp(self):
        # Set default content_type for post requests (avoid long lines)
        self.client = JSONClient()

    def test_overview_page_no_database_entries(self):
        # Request overview, confirm uses correct JS bundle and title
        response = self.client.get('/')
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'plant_tracker/index.html')
        self.assertEqual(response.context['js_bundle'], 'plant_tracker/overview.js')
        self.assertEqual(response.context['title'], 'Overview')

        # Confirm correct state object (no plants or groups in database)
        self.assertEqual(
            response.context['state'],
            {'plants': [], 'groups': []}
        )

    def test_overview_page_with_database_entries(self):
        # Create test group and 2 test plants
        group = Group.objects.create(uuid=uuid4())
        plant1 = Plant.objects.create(uuid=uuid4(), name='Test plant')
        plant2 = Plant.objects.create(uuid=uuid4(), species='fittonia', group=group)

        # Request overview, confirm uses correct JS bundle and title
        response = self.client.get('/')
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'plant_tracker/index.html')
        self.assertEqual(response.context['js_bundle'], 'plant_tracker/overview.js')
        self.assertEqual(response.context['title'], 'Overview')

        # Confirm state object has details of all plants and groups
        state = response.context['state']
        self.assertEqual(
            state['plants'],
            [
                {
                    'uuid': str(plant1.uuid),
                    'name': 'Test plant',
                    'display_name': 'Test plant',
                    'species': None,
                    'thumbnail': None,
                    'description': None,
                    'pot_size': None,
                    'last_watered': None,
                    'last_fertilized': None
                },
                {
                    'uuid': str(plant2.uuid),
                    'name': None,
                    'display_name': 'Unnamed fittonia',
                    'species': 'fittonia',
                    'thumbnail': None,
                    'description': None,
                    'pot_size': None,
                    'last_watered': None,
                    'last_fertilized': None
                }
            ]
        )
        self.assertEqual(
            state['groups'],
            [
                {
                    'uuid': str(group.uuid),
                    'name': None,
                    'display_name': 'Unnamed group 1',
                    'location': None,
                    'description': None,
                    'plants': 1
                }
            ]
        )

    def test_get_qr_codes(self):
        # Mock URL_PREFIX env var
        settings.URL_PREFIX = 'mysite.com'
        # Send request, confirm response contains base64 string
        response = self.client.post('/get_qr_codes', {'qr_per_row': 8})
        self.assertEqual(response.status_code, 200)
        try:
            base64.b64decode(response.json()['qr_codes'], validate=True)
        except:
            self.assertTrue(False)

    def test_get_qr_codes_with_long_URL(self):
        # Mock URL_PREFIX env var with a very long URL
        settings.URL_PREFIX = 'planttracker.several.more.subdomains.mysite.com'
        # Send request, confirm response contains base64 string
        response = self.client.post('/get_qr_codes', {'qr_per_row': 8})
        self.assertEqual(response.status_code, 200)
        try:
            base64.b64decode(response.json()['qr_codes'], validate=True)
        except:
            self.assertTrue(False)

    def test_delete_plant(self):
        # Create test plant, confirm exists in database
        test_id = uuid4()
        Plant.objects.create(uuid=test_id, name='test plant')
        self.assertEqual(len(Plant.objects.all()), 1)

        # Call delete endpoint, confirm response, confirm removed from database
        response = self.client.post('/delete_plant', {'plant_id': str(test_id)})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'deleted': str(test_id)})
        self.assertEqual(len(Plant.objects.all()), 0)

        # Attempt to delete non-existing plant, confirm error
        response = self.client.post('/delete_plant', {'plant_id': str(test_id)})
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json(), {'error': 'plant not found'})

    def test_delete_group(self):
        # Create test group, confirm exists in database
        test_id = uuid4()
        Group.objects.create(uuid=test_id, name='test group')
        self.assertEqual(len(Group.objects.all()), 1)

        # Call delete endpoint, confirm response, confirm removed from database
        response = self.client.post('/delete_group', {'group_id': str(test_id)})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'deleted': str(test_id)})
        self.assertEqual(len(Group.objects.all()), 0)

        # Attempt to delete non-existing group, confirm error
        response = self.client.post('/delete_group', {'group_id': str(test_id)})
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json(), {'error': 'group not found'})


class ManagePageTests(TestCase):
    def setUp(self):
        # Set default content_type for post requests (avoid long lines)
        self.client = JSONClient()

        # Create test plants and groups
        self.plant1 = Plant.objects.create(uuid=uuid4())
        self.plant2 = Plant.objects.create(uuid=uuid4())
        self.group1 = Group.objects.create(uuid=uuid4())

        # Create fake UUID that doesn't exist in database
        self.fake_id = uuid4()

        # Create mock photos for plant1
        Photo.objects.create(
            photo=create_mock_photo('2024:03:21 10:52:03', 'photo1.jpg'),
            plant=self.plant1
        )
        Photo.objects.create(
            photo=create_mock_photo('2024:03:22 10:52:03', 'photo2.jpg'),
            plant=self.plant1
        )

    def tearDown(self):
        # Delete mock photos between tests to prevent duplicate names (django
        # appends random string to keep unique, which makes testing difficult)
        for i in os.listdir(os.path.join(settings.TEST_DIR, 'data', 'images', 'images')):
            os.remove(os.path.join(settings.TEST_DIR, 'data', 'images', 'images', i))
        for i in os.listdir(os.path.join(settings.TEST_DIR, 'data', 'images', 'thumbnails')):
            os.remove(os.path.join(settings.TEST_DIR, 'data', 'images', 'thumbnails', i))

    def _refresh_test_models(self):
        self.plant1.refresh_from_db()
        self.plant2.refresh_from_db()
        self.group1.refresh_from_db()

    def test_registration_plant(self):
        # Confirm no plants or groups in database (except test entries)
        self.assertEqual(len(Plant.objects.all()), 2)
        self.assertEqual(len(Group.objects.all()), 1)

        # Send plant registration request with extra spaces on some params
        test_id = uuid4()
        payload = {
            'uuid': test_id,
            'name': '     test plant',
            'species': 'Giant Sequoia    ',
            'description': '300 feet and a few thousand years old',
            'pot_size': '4'
        }
        response = self.client.post('/register_plant', payload)

        # Confirm response redirects to management page for new plant
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.url, f'/manage/{test_id}')

        # Confirm exists in database
        self.assertEqual(len(Plant.objects.all()), 3)
        # Confirm plant has corrrect params, confirm extra spaces were removed
        plant = Plant.objects.get(uuid=test_id)
        self.assertEqual(plant.name, 'test plant')
        self.assertEqual(plant.species, 'Giant Sequoia')
        self.assertEqual(plant.description, '300 feet and a few thousand years old')
        self.assertEqual(plant.pot_size, 4)
        # Confirm no extra group created
        self.assertEqual(len(Group.objects.all()), 1)

    def test_registration_group(self):
        # Confirm no plants or groups in database (except test entries)
        self.assertEqual(len(Plant.objects.all()), 2)
        self.assertEqual(len(Group.objects.all()), 1)

        # Send plant registration request with extra spaces on some params
        test_id = uuid4()
        payload = {
            'uuid': test_id,
            'name': '    test group',
            'location': 'top shelf    ',
            'description': 'This group is used for propagation'
        }
        response = self.client.post('/register_group', payload)

        # Confirm response redirects to management page for new group
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.url, f'/manage/{test_id}')

        # Confirm exists in database
        self.assertEqual(len(Group.objects.all()), 2)
        # Confirm group has corrrect params, confirm extra spaces were removed
        group = Group.objects.get(uuid=test_id)
        self.assertEqual(group.name, 'test group')
        self.assertEqual(group.location, 'top shelf')
        self.assertEqual(group.description, 'This group is used for propagation')
        # Confirm no extra plant created
        self.assertEqual(len(Plant.objects.all()), 2)

    def test_manage_new_plant(self):
        # Add species to test plants
        self.plant1.species = "Fittonia"
        self.plant2.species = "Calathea"
        self.plant1.save()
        self.plant2.save()

        # Request management page for new plant, confirm status
        response = self.client.get(f'/manage/{uuid4()}')
        self.assertEqual(response.status_code, 200)

        # Confirm used register bundle and correct title
        self.assertTemplateUsed(response, 'plant_tracker/index.html')
        self.assertEqual(response.context['js_bundle'], 'plant_tracker/register.js')
        self.assertEqual(response.context['title'], 'Register New Plant')

        # Confirm react state contains list of existing plant species options
        self.assertIn('Calathea', response.context['state']['species_options'])
        self.assertIn('Fittonia', response.context['state']['species_options'])
        self.assertEqual(len(response.context['state']['species_options']), 2)

    def test_manage_existing_plant(self):
        # Request management page for test plant, confirm status
        response = self.client.get(f'/manage/{self.plant1.uuid}')
        self.assertEqual(response.status_code, 200)

        # Confirm used manage_plant bundle and correct title
        self.assertTemplateUsed(response, 'plant_tracker/index.html')
        self.assertEqual(response.context['js_bundle'], 'plant_tracker/manage_plant.js')
        self.assertEqual(response.context['title'], 'Manage Plant')

        # Confirm expected state object
        state = response.context['state']
        self.assertEqual(
            state['plant'],
            {
                'uuid': str(self.plant1.uuid),
                'name': None,
                'display_name': 'Unnamed plant 1',
                'species': None,
                'thumbnail': '/media/thumbnails/photo2_thumb.jpg',
                'pot_size': None,
                'description': None,
                'last_watered': None,
                'last_fertilized': None,
                'events': {
                    'water': [],
                    'fertilize': [],
                    'prune': [],
                    'repot': []
                },
                'group': None,
            }
        )

        # Confirm notes state is empty
        self.assertEqual(state['notes'], [])

        # Confirm groups contains details of all existing groups
        self.assertEqual(
            state['groups'],
            [
                {
                    'name': None,
                    'display_name': 'Unnamed group 1',
                    'uuid': str(self.group1.uuid),
                    'location': None,
                    'description': None,
                    'plants': 0
                }
            ]
        )

        # Confirm species_options list is empty (test plants have no species)
        self.assertEqual(state['species_options'], [])

        # Confirm photo_urls contains list of dicts with timestamp keys, URL values
        photo_urls = state['photo_urls']
        self.assertEqual(
            photo_urls,
            [
                {
                    'created': '2024-03-22T10:52:03+00:00',
                    'image': '/media/images/photo2.jpg',
                    'thumbnail': '/media/thumbnails/photo2_thumb.jpg',
                    'key': 2
                },
                {
                    'created': '2024-03-21T10:52:03+00:00',
                    'image': '/media/images/photo1.jpg',
                    'thumbnail': '/media/thumbnails/photo1_thumb.jpg',
                    'key': 1
                },
            ]
        )

        # Add test plant to group, request page again
        self.plant1.group = self.group1
        self.plant1.save()
        response = self.client.get(f'/manage/{self.plant1.uuid}')

        # Confirm state object contains group details
        self.assertEqual(
            response.context['state']['plant']['group'],
            {
                'name': self.group1.get_display_name(),
                'uuid': str(self.group1.uuid)
            }
        )

    def test_manage_existing_group(self):
        # Add test plant to group
        self.plant1.group = self.group1
        self.plant1.save()

        # Request management page for test group, confirm status
        response = self.client.get(f'/manage/{self.group1.uuid}')
        self.assertEqual(response.status_code, 200)

        # Confirm used manage_group bundle and correct title
        self.assertTemplateUsed(response, 'plant_tracker/index.html')
        self.assertEqual(response.context['js_bundle'], 'plant_tracker/manage_group.js')
        self.assertEqual(response.context['title'], 'Manage Group')

        # Confirm expected state objects
        state = response.context['state']
        self.assertEqual(
            state['group'],
            {
                'uuid': str(self.group1.uuid),
                'name': self.group1.name,
                'location': None,
                'description': None,
                'display_name': self.group1.get_display_name(),
                'plants': 1
            }
        )

        # Confirm details state contains params for plant in group
        self.assertEqual(
            state['details'],
            [{
                'name': None,
                'display_name': 'Unnamed plant 1',
                'uuid': str(self.plant1.uuid),
                'species': None,
                'thumbnail': '/media/thumbnails/photo2_thumb.jpg',
                'description': None,
                'pot_size': None,
                'last_watered': None,
                'last_fertilized': None
            }]
        )

        # Confirm options state contains params for all plants
        self.assertEqual(
            state['options'],
            [
                {
                    'name': self.plant1.name,
                    'display_name': self.plant1.get_display_name(),
                    'uuid': str(self.plant1.uuid),
                    'species': None,
                    'pot_size': None,
                    'description': None,
                    'last_watered': None,
                    'last_fertilized': None,
                    'thumbnail': '/media/thumbnails/photo2_thumb.jpg'
                },
                {
                    'name': self.plant2.name,
                    'display_name': self.plant2.get_display_name(),
                    'uuid': str(self.plant2.uuid),
                    'species': None,
                    'pot_size': None,
                    'description': None,
                    'last_watered': None,
                    'last_fertilized': None,
                    'thumbnail': None
                }
            ]
        )

    def test_edit_plant_details(self):
        # Confirm test plant has no name or species
        self.assertIsNone(self.plant1.name)
        self.assertIsNone(self.plant1.species)

        # Send edit details request
        # Note trailing spaces on name, leading spaces on species
        payload = {
            'plant_id': self.plant1.uuid,
            'name': 'test plant    ',
            'species': '   Giant Sequoia',
            'description': '300 feet and a few thousand years old',
            'pot_size': '4'
        }
        response = self.client.post('/edit_plant', payload)

        # Confirm response contains correct details with extra spaces removed
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {
                'name': 'test plant',
                'display_name': 'test plant',
                'species': 'Giant Sequoia',
                'description': '300 feet and a few thousand years old',
                'pot_size': 4
            }
        )

        # Confirm no additional plant created
        self.assertEqual(len(Plant.objects.all()), 2)
        # Confirm details now match, leading/trailing spaces were removed
        self._refresh_test_models()
        self.assertEqual(self.plant1.name, 'test plant')
        self.assertEqual(self.plant1.species, 'Giant Sequoia')

    def test_edit_group_details(self):
        # Confirm test group has no name
        self.assertIsNone(self.group1.name)

        # Send edit details request
        # Note trailing spaces on name, leading spaces on location
        payload = {
            'group_id': self.group1.uuid,
            'name': 'test group    ',
            'location': '    middle shelf',
            'description': 'This group is used for propagation'
        }
        response = self.client.post('/edit_group', payload)

        # Confirm response contains correct details with extra spaces removed
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {
                'name': 'test group',
                'display_name': 'test group',
                'location': 'middle shelf',
                'description': 'This group is used for propagation'
            }
        )

        # Confirm no additional group created
        self.assertEqual(len(Group.objects.all()), 1)
        # Confirm details now match, leading/trailing spaces were removed
        self._refresh_test_models()
        self.assertEqual(self.group1.name, 'test group')
        self.assertEqual(self.group1.location, 'middle shelf')
        self.assertEqual(self.group1.description, 'This group is used for propagation')

    def test_add_plant_to_group(self):
        # Confirm test plant and group have no database relation
        self.assertIsNone(self.plant1.group)
        self.assertEqual(len(self.group1.plant_set.all()), 0)

        # Send add_plant_to_group request, confirm response
        payload = {'plant_id': self.plant1.uuid, 'group_id': self.group1.uuid}
        response = self.client.post('/add_plant_to_group', payload)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {
                "action": "add_plant_to_group",
                "plant": str(self.plant1.uuid),
                "group_name": self.group1.get_display_name(),
                "group_uuid": str(self.group1.uuid)
            }
        )

        # Confirm database relation created
        self._refresh_test_models()
        self.assertEqual(self.plant1.group, self.group1)
        self.assertEqual(len(self.group1.plant_set.all()), 1)

    def test_remove_plant_from_group(self):
        # Add test plant to group, confirm relation
        self.plant1.group = self.group1
        self.plant1.save()
        self.assertEqual(self.plant1.group, self.group1)
        self.assertEqual(len(self.group1.plant_set.all()), 1)

        # Send add_plant_to_group request, confirm response + relation removed
        response = self.client.post('/remove_plant_from_group', {'plant_id': self.plant1.uuid})
        self.assertEqual(response.status_code, 200)
        self._refresh_test_models()
        self.assertIsNone(self.plant1.group)
        self.assertEqual(len(self.group1.plant_set.all()), 0)

    def test_bulk_add_plants_to_group(self):
        # Confirm test plants are not in test group
        self.assertIsNone(self.plant1.group)
        self.assertIsNone(self.plant2.group)
        self.assertEqual(len(self.group1.plant_set.all()), 0)

        # Send bulk_add_plants_to_group request with both IDs + 1 fake ID
        payload = {
            'group_id': self.group1.uuid,
            'plants': [
                self.plant1.uuid,
                self.plant2.uuid,
                self.fake_id
            ]
        }
        response = self.client.post('/bulk_add_plants_to_group', payload)

        # Confirm plant UUIDs were added, fake ID failed
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {
                "added": [self.plant1.get_details(), self.plant2.get_details()],
                "failed": [str(self.fake_id)]
            }
        )

        # Confirm plants both have relation to group
        self._refresh_test_models()
        self.assertEqual(self.plant1.group, self.group1)
        self.assertEqual(self.plant2.group, self.group1)
        self.assertEqual(len(self.group1.plant_set.all()), 2)

    def test_bulk_remove_plants_from_group(self):
        # Add 2 test plants to test group, confirm relation exists
        self.plant1.group = self.group1
        self.plant2.group = self.group1
        self.plant1.save()
        self.plant2.save()
        self.assertEqual(self.plant1.group, self.group1)
        self.assertEqual(self.plant2.group, self.group1)
        self.assertEqual(len(self.group1.plant_set.all()), 2)

        # Send bulk_add_plants_to_group request with both IDs + 1 fake ID
        payload = {
            'group_id': self.group1.uuid,
            'plants': [
                self.plant1.uuid,
                self.plant2.uuid,
                self.fake_id
            ]
        }
        response = self.client.post('/bulk_remove_plants_from_group', payload)

        # Confirm plant UUIDs were removed, fake ID failed
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {
                "removed": [str(self.plant1.uuid), str(self.plant2.uuid)],
                "failed": [str(self.fake_id)]
            }
        )

        # Confirm plants no longer have relation to group
        self._refresh_test_models()
        self.assertIsNone(self.plant1.group)
        self.assertIsNone(self.plant2.group)
        self.assertEqual(len(self.group1.plant_set.all()), 0)

    def test_repot_plant(self):
        # Set starting pot_size
        self.plant1.pot_size = 4
        self.plant1.save()

        # Confirm plant has no RepotEvents
        self.assertEqual(len(self.plant1.repotevent_set.all()), 0)

        # Send repot_plant request
        payload = {
            'plant_id': self.plant1.uuid,
            'timestamp': '2024-02-06T03:06:26.000Z',
            'new_pot_size': 6
        }
        response = self.client.post('/repot_plant', payload)

        # Confirm response, confirm RepotEvent created
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {"action": "repot", "plant": str(self.plant1.uuid)}
        )
        self._refresh_test_models()
        self.assertEqual(len(self.plant1.repotevent_set.all()), 1)

        # Confirm correct pot_size attributes on plant and event entries
        self.assertEqual(self.plant1.pot_size, 6)
        self.assertEqual(self.plant1.repotevent_set.all()[0].old_pot_size, 4)
        self.assertEqual(self.plant1.repotevent_set.all()[0].new_pot_size, 6)


class ChangeQrCodeTests(TestCase):
    '''Separate test case to prevent leftover cache breaking other tests'''

    def setUp(self):
        # Set default content_type for post requests (avoid long lines)
        self.client = JSONClient()

        # Create test plants and groups
        self.plant1 = Plant.objects.create(uuid=uuid4())
        self.plant2 = Plant.objects.create(uuid=uuid4())
        self.group1 = Group.objects.create(uuid=uuid4())

        # Create fake UUID that doesn't exist in database
        self.fake_id = uuid4()

    def tearDown(self):
        # Clear cache after each test
        cache.delete('old_uuid')

    def _refresh_test_models(self):
        self.plant1.refresh_from_db()
        self.plant2.refresh_from_db()
        self.group1.refresh_from_db()

    def test_change_qr_code_endpoint(self):
        # Confirm cache key is empty
        self.assertIsNone(cache.get('old_uuid'))

        # Post UUID to change_qr_code endpoint, confirm response
        response = self.client.post(
            '/change_qr_code',
            {'uuid': str(self.plant1.uuid)}
        )
        self.assertEqual(
            response.json(),
            {"success": "scan new QR code within 15 minutes to confirm"}
        )
        self.assertEqual(response.status_code, 200)

        # Confirm cache key contains UUID
        self.assertEqual(cache.get('old_uuid'), str(self.plant1.uuid))

    def test_change_uuid_endpoint_plant(self):
        # Simulate cached UUID from change_qr_code request
        cache.set('old_uuid', str(self.plant1.uuid))
        self.assertEqual(cache.get('old_uuid'), str(self.plant1.uuid))

        # Post new UUID to change_uuid endpoint, confirm response
        response = self.client.post(
            '/change_uuid',
            {'uuid': str(self.plant1.uuid), 'new_id': str(self.fake_id)}
        )
        self.assertEqual(
            response.json(),
            {"new_uuid": str(self.fake_id)}
        )
        self.assertEqual(response.status_code, 200)

        # Confirm plant UUID changed + cache cleared
        self._refresh_test_models()
        self.assertEqual(str(self.plant1.uuid), str(self.fake_id))
        self.assertIsNone(cache.get('old_uuid'))

    def test_change_uuid_endpoint_group(self):
        # Simulate cached UUID from change_qr_code request
        cache.set('old_uuid', str(self.group1.uuid))
        self.assertEqual(cache.get('old_uuid'), str(self.group1.uuid))

        # Post new UUID to change_uuid endpoint, confirm response
        response = self.client.post(
            '/change_uuid',
            {'uuid': str(self.group1.uuid), 'new_id': str(self.fake_id)}
        )
        self.assertEqual(
            response.json(),
            {"new_uuid": str(self.fake_id)}
        )
        self.assertEqual(response.status_code, 200)

        # Confirm plant UUID changed + cache cleared
        self._refresh_test_models()
        self.assertEqual(str(self.group1.uuid), str(self.fake_id))
        self.assertIsNone(cache.get('old_uuid'))

    def test_confirmation_page_plant(self):
        # Simulate cached UUID from change_qr_code request
        cache.set('old_uuid', str(self.plant1.uuid))
        self.assertEqual(cache.get('old_uuid'), str(self.plant1.uuid))

        # Request management page with new UUID (simulate user scanning new QR)
        response = self.client.get(f'/manage/{self.fake_id}')

        # Confirm status code, correct bundle and title
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'plant_tracker/index.html')
        self.assertEqual(
            response.context['js_bundle'],
            'plant_tracker/confirm_new_qr_code.js'
        )
        self.assertEqual(response.context['title'], 'Confirm new QR code')

        # Confirm state contains plant details and new UUID
        self.assertEqual(
            response.context['state'],
            {
                'type': 'plant',
                'plant': {
                    'uuid': str(self.plant1.uuid),
                    'name': None,
                    'display_name': 'Unnamed plant 1',
                    'species': None,
                    'thumbnail': None,
                    'pot_size': None,
                    'description': None,
                    'last_watered': None,
                    'last_fertilized': None
                },
                'new_uuid': str(self.fake_id)
            }
        )

    def test_confirmation_page_group(self):
        # Simulate cached UUID from change_qr_code request
        cache.set('old_uuid', str(self.group1.uuid))
        self.assertEqual(cache.get('old_uuid'), str(self.group1.uuid))

        # Request management page with new UUID (simulate user scanning new QR)
        response = self.client.get(f'/manage/{self.fake_id}')

        # Confirm status code, correct bundle and title
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'plant_tracker/index.html')
        self.assertEqual(
            response.context['js_bundle'],
            'plant_tracker/confirm_new_qr_code.js'
        )
        self.assertEqual(response.context['title'], 'Confirm new QR code')

        # Confirm state contains plant details and new UUID
        self.assertEqual(
            response.context['state'],
            {
                'type': 'group',
                'group': {
                    'uuid': str(self.group1.uuid),
                    'name': None,
                    'display_name': 'Unnamed group 1',
                    'location': None,
                    'description': None
                },
                'new_uuid': str(self.fake_id)
            }
        )

    def test_manage_page_while_waiting_for_new_qr_code(self):
        '''The /manage endpoint should only return the confirmation page if a
        new QR code is scanned. If the QR code of an existing plant or group is
        scanned it should return the manage page for the plant or group.
        '''

        # Simulate cached UUID from change_qr_code request
        cache.set('old_uuid', str(self.plant1.uuid))
        self.assertEqual(cache.get('old_uuid'), str(self.plant1.uuid))

        # Request management page with new UUID (should return confirmation page)
        response = self.client.get(f'/manage/{self.fake_id}')
        self.assertEqual(
            response.context['js_bundle'],
            'plant_tracker/confirm_new_qr_code.js'
        )

        # Request management page with existing plant UUID (should return manage_plant)
        response = self.client.get(f'/manage/{self.plant2.uuid}')
        self.assertEqual(
            response.context['js_bundle'],
            'plant_tracker/manage_plant.js'
        )

        # Request management page with existing group UUID (should return manage_group)
        response = self.client.get(f'/manage/{self.group1.uuid}')
        self.assertEqual(
            response.context['js_bundle'],
            'plant_tracker/manage_group.js'
        )

        # Request management page with UUID of plant waiting for new QR code,
        # should return manage_plant page like normal
        response = self.client.get(f'/manage/{self.plant1.uuid}')
        self.assertEqual(
            response.context['js_bundle'],
            'plant_tracker/manage_plant.js'
        )


class PlantEventTests(TestCase):
    def setUp(self):
        # Set default content_type for post requests (avoid long lines)
        self.client = JSONClient()

        # Create test plants and groups
        self.plant1 = Plant.objects.create(uuid=uuid4())
        self.plant2 = Plant.objects.create(uuid=uuid4())

        # Create fake UUID that doesn't exist in database
        self.fake_id = uuid4()

    def _refresh_test_models(self):
        self.plant1.refresh_from_db()
        self.plant2.refresh_from_db()

    def test_add_water_event(self):
        # Confirm test plant has no water events
        self.assertIsNone(self.plant1.last_watered())
        self.assertEqual(len(WaterEvent.objects.all()), 0)

        payload = {
            'plant_id': self.plant1.uuid,
            'event_type': 'water',
            'timestamp': '2024-02-06T03:06:26.000Z'
        }

        # Send water request, confirm event created
        response = self.client.post('/add_plant_event', payload)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"action": "water", "plant": str(self.plant1.uuid)})
        self.assertEqual(len(WaterEvent.objects.all()), 1)
        self.assertEqual(self.plant1.last_watered(), '2024-02-06T03:06:26+00:00')

    def test_add_fertilize_event(self):
        # Confirm test plant has no fertilize events
        self.assertIsNone(self.plant1.last_fertilized())
        self.assertEqual(len(FertilizeEvent.objects.all()), 0)

        payload = {
            'plant_id': self.plant1.uuid,
            'event_type': 'fertilize',
            'timestamp': '2024-02-06T03:06:26.000Z'
        }

        # Send fertilize request, confirm event created
        response = self.client.post('/add_plant_event', payload)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"action": "fertilize", "plant": str(self.plant1.uuid)})
        self.assertEqual(len(FertilizeEvent.objects.all()), 1)
        self.assertEqual(self.plant1.last_fertilized(), '2024-02-06T03:06:26+00:00')

    def test_add_prune_event(self):
        # Confirm test plant has no prune events
        self.assertIsNone(self.plant1.last_pruned())
        self.assertEqual(len(PruneEvent.objects.all()), 0)

        payload = {
            'plant_id': self.plant1.uuid,
            'event_type': 'prune',
            'timestamp': '2024-02-06T03:06:26.000Z'
        }

        # Send prune request, confirm event created
        response = self.client.post('/add_plant_event', payload)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"action": "prune", "plant": str(self.plant1.uuid)})
        self.assertEqual(len(PruneEvent.objects.all()), 1)
        self.assertEqual(self.plant1.last_pruned(), '2024-02-06T03:06:26+00:00')

    def test_add_repot_event(self):
        # Confirm test plant has no repot events
        self.assertIsNone(self.plant1.last_repotted())
        self.assertEqual(len(RepotEvent.objects.all()), 0)

        payload = {
            'plant_id': self.plant1.uuid,
            'event_type': 'repot',
            'timestamp': '2024-02-06T03:06:26.000Z'
        }

        # Send repot request, confirm event created
        response = self.client.post('/add_plant_event', payload)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"action": "repot", "plant": str(self.plant1.uuid)})
        self.assertEqual(len(RepotEvent.objects.all()), 1)
        self.assertEqual(self.plant1.last_repotted(), '2024-02-06T03:06:26+00:00')

    def test_add_note_event(self):
        # Confirm test plant has no note events
        self.assertEqual(len(self.plant1.noteevent_set.all()), 0)
        self.assertEqual(len(NoteEvent.objects.all()), 0)

        payload = {
            'plant_id': self.plant1.uuid,
            'timestamp': '2024-02-06T03:06:26.000Z',
            'note_text': 'plant is looking healthier than last week'
        }

        # Send add_note request, confirm event created
        response = self.client.post('/add_plant_note', payload)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"action": "add_note", "plant": str(self.plant1.uuid)})
        self.assertEqual(len(NoteEvent.objects.all()), 1)
        self.assertEqual(len(self.plant1.noteevent_set.all()), 1)

    def test_edit_note_event(self):
        # Create NoteEvent with no text, confirm exists
        timestamp = timezone.now()
        NoteEvent.objects.create(plant=self.plant1, timestamp=timestamp, text="")
        self.assertEqual(len(self.plant1.noteevent_set.all()), 1)

        # Call edit_plant_note endpoint, confirm response
        payload = {
            'plant_id': self.plant1.uuid,
            'timestamp': timestamp.isoformat(),
            'note_text': 'This is the text I forgot to add'
        }
        response = self.client.post('/edit_plant_note', payload)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {"action": "edit_note", "plant": str(self.plant1.uuid)}
        )

        # Confirm text of existing NoteEvent was updated
        self.assertEqual(len(self.plant1.noteevent_set.all()), 1)
        self.assertEqual(
            NoteEvent.objects.get(timestamp=timestamp).text,
            'This is the text I forgot to add'
        )

    def test_delete_note_event(self):
        # Create NoteEvent, confirm exists
        timestamp = timezone.now()
        NoteEvent.objects.create(plant=self.plant1, timestamp=timestamp, text="")
        self.assertEqual(len(self.plant1.noteevent_set.all()), 1)

        # Call delete_plant_note endpoint, confirm response + event deleted
        payload = {
            'plant_id': self.plant1.uuid,
            'timestamp': timestamp.isoformat()
        }
        response = self.client.post('/delete_plant_note', payload)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {"deleted": "note", "plant": str(self.plant1.uuid)}
        )
        self.assertEqual(len(self.plant1.noteevent_set.all()), 0)

    def test_bulk_water_plants(self):
        # Confirm test plants have no WaterEvents
        self.assertEqual(len(self.plant1.waterevent_set.all()), 0)
        self.assertEqual(len(self.plant2.waterevent_set.all()), 0)

        # Send bulk_add_plants_to_group request with both IDs
        payload = {
            'plants': [
                str(self.plant1.uuid),
                str(self.plant2.uuid),
                str(self.fake_id)
            ],
            'event_type': 'water',
            'timestamp': '2024-02-06T03:06:26.000Z'
        }
        response = self.client.post('/bulk_add_plant_events', payload)

        # Confirm response, confirm WaterEvent created for both plants
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {
                "action": "water",
                "plants": [str(self.plant1.uuid), str(self.plant2.uuid)],
                "failed": [str(self.fake_id)]
            }
        )
        self.assertEqual(len(self.plant1.waterevent_set.all()), 1)
        self.assertEqual(len(self.plant2.waterevent_set.all()), 1)

    def test_bulk_fertilize_plants(self):
        # Confirm test plants have no FertilizeEvents
        self.assertEqual(len(self.plant1.fertilizeevent_set.all()), 0)
        self.assertEqual(len(self.plant2.fertilizeevent_set.all()), 0)

        # Send bulk_add_plants_to_group request with both IDs
        payload = {
            'plants': [
                str(self.plant1.uuid),
                str(self.plant2.uuid),
                str(self.fake_id)
            ],
            'event_type': 'fertilize',
            'timestamp': '2024-02-06T03:06:26.000Z'
        }
        response = self.client.post('/bulk_add_plant_events', payload)

        # Confirm response, confirm WaterEvent created for both plants
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {
                "action": "fertilize",
                "plants": [str(self.plant1.uuid), str(self.plant2.uuid)],
                "failed": [str(self.fake_id)]
            }
        )
        self.assertEqual(len(self.plant1.fertilizeevent_set.all()), 1)
        self.assertEqual(len(self.plant2.fertilizeevent_set.all()), 1)

    def test_delete_plant_event(self):
        # Create WaterEvent, confirm exists
        timestamp = timezone.now()
        WaterEvent.objects.create(plant=self.plant1, timestamp=timestamp)
        self.assertEqual(len(self.plant1.waterevent_set.all()), 1)

        # Call delete_plant_event endpoint, confirm response + event deleted
        payload = {
            'plant_id': self.plant1.uuid,
            'event_type': 'water',
            'timestamp': timestamp.isoformat()
        }
        response = self.client.post('/delete_plant_event', payload)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {"deleted": "water", "plant": str(self.plant1.uuid)}
        )
        self.assertEqual(len(self.plant1.waterevent_set.all()), 0)

    def test_bulk_delete_plant_events(self):
        # Create multiple events with different types, confirm number in db
        timestamp = timezone.now()
        WaterEvent.objects.create(plant=self.plant1, timestamp=timestamp)
        FertilizeEvent.objects.create(plant=self.plant1, timestamp=timestamp)
        PruneEvent.objects.create(plant=self.plant1, timestamp=timestamp)
        RepotEvent.objects.create(plant=self.plant1, timestamp=timestamp)
        self.assertEqual(len(self.plant1.waterevent_set.all()), 1)
        self.assertEqual(len(self.plant1.fertilizeevent_set.all()), 1)
        self.assertEqual(len(self.plant1.pruneevent_set.all()), 1)
        self.assertEqual(len(self.plant1.repotevent_set.all()), 1)

        # Post timestamp and type of each event to bulk_delete_plant_events endpoint
        payload = {
            'plant_id': self.plant1.uuid,
            'events': [
                {'type': 'water', 'timestamp': timestamp.isoformat()},
                {'type': 'fertilize', 'timestamp': timestamp.isoformat()},
                {'type': 'prune', 'timestamp': timestamp.isoformat()},
                {'type': 'repot', 'timestamp': timestamp.isoformat()},
            ]
        }
        response = self.client.post('/bulk_delete_plant_events', payload)

        # Confirm correct response, confirm removed from database
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {
                "deleted": [
                    {'type': 'water', 'timestamp': timestamp.isoformat()},
                    {'type': 'fertilize', 'timestamp': timestamp.isoformat()},
                    {'type': 'prune', 'timestamp': timestamp.isoformat()},
                    {'type': 'repot', 'timestamp': timestamp.isoformat()},
                ],
                "failed": []
            }
        )
        self.assertEqual(len(self.plant1.waterevent_set.all()), 0)
        self.assertEqual(len(self.plant1.fertilizeevent_set.all()), 0)
        self.assertEqual(len(self.plant1.pruneevent_set.all()), 0)
        self.assertEqual(len(self.plant1.repotevent_set.all()), 0)

    def test_add_plant_photos(self):
        # Confirm no photos exist in database or plant reverse relation
        self.assertEqual(len(Photo.objects.all()), 0)
        self.assertEqual(len(self.plant1.photo_set.all()), 0)

        # Post mock photo to add_plant_photos endpoint
        data = {
            'plant_id': str(self.plant1.uuid),
            'photo_0': create_mock_photo('2024:03:22 10:52:03')
        }
        response = self.client.post(
            '/add_plant_photos',
            data=data,
            content_type=MULTIPART_CONTENT
        )

        # Confirm expected response
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()), 2)
        self.assertEqual(response.json()["uploaded"], "1 photo(s)")

        # Confirm response contains new photo creation timestamp, URL, primary key
        self.assertEqual(
            response.json()["urls"],
            [
                {
                    "created": "2024-03-22T10:52:03+00:00",
                    "image": "/media/images/mock_photo.jpg",
                    "thumbnail": "/media/thumbnails/mock_photo_thumb.jpg",
                    "key": 1
                }
            ]
        )

        # Confirm Photo was added to database, reverse relation was created
        self.assertEqual(len(Photo.objects.all()), 1)
        self.assertEqual(len(self.plant1.photo_set.all()), 1)

        # Confirm Photo.created was set from exif DateTimeOriginal param
        self.assertEqual(
            Photo.objects.all()[0].created.strftime('%Y:%m:%d %H:%M:%S'),
            '2024:03:22 10:52:03'
        )

    def test_delete_plant_photos(self):
        # Create 2 mock photos, add to database
        mock_photo1 = create_mock_photo('2024:03:21 10:52:03')
        mock_photo2 = create_mock_photo('2024:03:22 10:52:03')
        photo1 = Photo.objects.create(photo=mock_photo1, plant=self.plant1)
        photo2 = Photo.objects.create(photo=mock_photo2, plant=self.plant1)
        self.assertEqual(len(Photo.objects.all()), 2)

        # Post primary keys of both photos to delete_plant_photos endpoint
        # Add a non-existing primary key, should add to response failed section
        payload = {
            'plant_id': str(self.plant1.uuid),
            'delete_photos': [
                photo1.pk,
                photo2.pk,
                999
            ]
        }
        response = self.client.post('/delete_plant_photos', payload)

        # Confirm response, confirm both removed from database, confirm fake
        # primary key was added to failed section
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {
                "deleted": [photo1.pk, photo2.pk],
                "failed": [999]
            }
        )
        self.assertEqual(len(Photo.objects.all()), 0)

    def test_set_plant_default_photo(self):
        # Create mock photo, add to database
        mock_photo = create_mock_photo('2024:03:21 10:52:03')
        photo = Photo.objects.create(photo=mock_photo, plant=self.plant1)

        # Confirm plant has no default_photo
        self.assertIsNone(self.plant1.default_photo)

        # Post photo primary key to set_plant_default_photo endpoint
        payload = {
            'plant_id': str(self.plant1.uuid),
            'photo_key': photo.pk
        }
        response = self.client.post('/set_plant_default_photo', payload)

        # Confirm response, confirm plant now has default_photo
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {"default_photo": photo.get_thumbnail_url()}
        )
        self._refresh_test_models()
        self.assertEqual(self.plant1.default_photo, photo)


class InvalidRequestTests(TestCase):
    def setUp(self):
        # Create test models to use in tests
        self.test_plant = Plant.objects.create(uuid=uuid4())
        self.test_group = Group.objects.create(uuid=uuid4())

        # Set default content_type for post requests (avoid long lines)
        self.client = JSONClient()

    def test_get_qr_codes_url_prefix_not_set(self):
        # Mock missing URL_PREFIX env var
        settings.URL_PREFIX = None
        # Send request, confirm correct error
        response = self.client.post('/get_qr_codes', {'qr_per_row': 8})
        self.assertEqual(response.status_code, 501)
        self.assertEqual(response.json(), {'error': 'URL_PREFIX not configured'})

    def test_get_qr_codes_invalid_qr_per_row(self):
        # Send request with string qr_per_row, confirm correct error
        response = self.client.post('/get_qr_codes', {'qr_per_row': 'five'})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.json(),
            {'error': 'qr_per_row must be an integer between 2 and 25'}
        )

        # Send request with qr_per_row less than 2, confirm correct error
        response = self.client.post('/get_qr_codes', {'qr_per_row': 1})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.json(),
            {'error': 'qr_per_row must be an integer between 2 and 25'}
        )

        # Send request with qr_per_row greater than 25, confirm correct error
        response = self.client.post('/get_qr_codes', {'qr_per_row': 26})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.json(),
            {'error': 'qr_per_row must be an integer between 2 and 25'}
        )

    def test_get_qr_codes_excessively_long_url_prefix(self):
        # Mock excessively long URL_PREFIX, will not be possible to generate QR
        # codes with width less than max_width
        settings.URL_PREFIX = 'https://excessive.number.of.extremely.long.repeating.subdomains.excessive.number.of.extremely.long.repeating.subdomains.excessive.number.of.extremely.long.repeating.subdomains.excessive.number.of.extremely.long.repeating.subdomains.longdomainname.com/'

        # Send request with qr_per_row = 25 (worst case), confirm correct error
        response = self.client.post('/get_qr_codes', {'qr_per_row': 25})
        self.assertEqual(response.status_code, 500)
        self.assertEqual(
            response.json(),
            {'error': 'failed to generate, try a shorter URL_PREFIX'}
        )

    def test_invalid_get_request(self):
        # Send GET request to endpoint that requires POST, confirm error
        response = self.client.get('/register_plant')
        self.assertEqual(response.status_code, 405)
        self.assertEqual(response.json(), {'error': 'must post data'})

        # Send GET request to endpoint that expects FormData (handles own error)
        response = self.client.get('/add_plant_photos')
        self.assertEqual(response.status_code, 405)
        self.assertEqual(response.json(), {'error': 'must post FormData'})

    def test_invalid_post_body(self):
        # Send POST with non-JSON body, confirm error
        response = self.client.post(
            '/register_plant',
            f'uuid={uuid4()}&name=test&species=test&description=None&pot_size=4&type=plant',
            content_type='text/plain',
        )
        self.assertEqual(response.status_code, 405)
        self.assertEqual(response.json(), {'error': 'request body must be JSON'})

    def test_plant_uuid_does_not_exist(self):
        # Send POST with UUID that does not exist in database, confirm error
        response = self.client.post('/delete_plant', {'plant_id': uuid4()})
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json(), {"error": "plant not found"})

    def test_qr_instance_uuid_does_not_exist(self):
        # Send POST with UUID that does not exist in database, confirm error
        response = self.client.post('/change_qr_code', {'uuid': uuid4()})
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json(), {"error": "uuid does not match any plant or group"})

    def test_missing_plant_id(self):
        # Send POST with no plant_id key in body, confirm error
        response = self.client.post('/delete_plant', {'timestamp': '2024-02-06T03:06:26.000Z'})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.json(),
            {"error": "POST body missing required keys", "keys": ['plant_id']}
        )

    def test_missing_group_id(self):
        # Send POST with no group_id key in body, confirm error
        response = self.client.post('/delete_group')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.json(),
            {"error": "POST body missing required keys", "keys": ['group_id']}
        )

    def test_invalid_plant_uuid(self):
        # Send POST with plant_id that is not a valid UUID, confirm error
        response = self.client.post('/delete_plant', {'plant_id': '31670857'})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"error": "plant_id key is not a valid UUID"})

    def test_invalid_group_uuid(self):
        # Send POST with group_id that is not a valid UUID, confirm error
        response = self.client.post('/delete_group', {'group_id': '31670857'})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"error": "group_id key is not a valid UUID"})

    def test_invalid_qr_instance_uuid(self):
        # Send POST with uuid that is not a valid UUID, confirm error
        response = self.client.post('/change_qr_code', {'uuid': '31670857'})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"error": "uuid key is not a valid UUID"})

    def test_missing_timestamp_key(self):
        # Send POST with no timestamp key in body, confirm error
        response = self.client.post(
            '/add_plant_event',
            {'plant_id': self.test_plant.uuid, 'event_type': 'water'}
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.json(),
            {"error": "POST body missing required keys", "keys": ['timestamp']}
        )

    def test_invalid_timestamp_format(self):
        # Send POST with invalid timestamp in body, confirm error
        response = self.client.post(
            '/add_plant_event',
            {'plant_id': self.test_plant.uuid, 'timestamp': '04:20', 'event_type': 'water'}
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"error": "timestamp format invalid"})

    def test_duplicate_event_timestamp(self):
        # Create WaterEvent manually, then attempt to create with API call
        timestamp = timezone.now()
        WaterEvent.objects.create(plant=self.test_plant, timestamp=timestamp)
        self.assertEqual(len(WaterEvent.objects.all()), 1)
        response = self.client.post(
            '/add_plant_event',
            {
                'plant_id': self.test_plant.uuid,
                'timestamp': timestamp.isoformat(),
                'event_type': 'water'
            }
        )
        # Confirm correct error, confirm no WaterEvent created
        self.assertEqual(response.status_code, 409)
        self.assertEqual(
            response.json(),
            {'error': 'event with same timestamp already exists'}
        )
        self.assertEqual(len(WaterEvent.objects.all()), 1)

    def test_duplicate_note_timestamp(self):
        # Create NoteEvent manually, then attempt to create with API call
        timestamp = timezone.now()
        NoteEvent.objects.create(plant=self.test_plant, timestamp=timestamp)
        self.assertEqual(len(NoteEvent.objects.all()), 1)
        response = self.client.post(
            '/add_plant_note',
            {
                'plant_id': self.test_plant.uuid,
                'timestamp': timestamp.isoformat(),
                'note_text': 'plant is looking healthier than last week'
            }
        )
        # Confirm correct error, confirm no NoteEvent created
        self.assertEqual(response.status_code, 409)
        self.assertEqual(
            response.json(),
            {'error': 'note with same timestamp already exists'}
        )
        self.assertEqual(len(NoteEvent.objects.all()), 1)

    def test_missing_event_type_key(self):
        # Send POST with with no event_type in body, confirm error
        response = self.client.post(
            '/add_plant_event',
            {'plant_id': self.test_plant.uuid, 'timestamp': '2024-02-06T03:06:26.000Z'}
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.json(),
            {"error": "POST body missing required keys", "keys": ['event_type']}
        )

    def test_invalid_event_type(self):
        # Send POST with invalid event_type in body, confirm error
        response = self.client.post(
            '/add_plant_event',
            {'plant_id': self.test_plant.uuid, 'timestamp': '2024-02-06T03:06:26.000Z', 'event_type': 'juice'}
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.json(),
            {"error": "invalid event_type, must be 'water', 'fertilize', 'prune', or 'repot'"}
        )

    def test_target_event_does_not_exist(self):
        # Call delete_plant_event endpoint with a timestamp that doesn't exist
        payload = {
            'plant_id': self.test_plant.uuid,
            'event_type': 'water',
            'timestamp': timezone.now().isoformat()
        }
        response = self.client.post('/delete_plant_event', payload)

        # Confirm correct error
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json(), {"error": "event not found"})

    def test_target_note_does_not_exist(self):
        # Call delete_plant_note endpoint with a timestamp that doesn't exist
        payload = {
            'plant_id': self.test_plant.uuid,
            'timestamp': timezone.now().isoformat()
        }
        response = self.client.post('/delete_plant_note', payload)

        # Confirm correct error
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json(), {"error": "note not found"})

        # Call edit_plant_event endpoint with a timestamp that doesn't exist
        payload = {
            'plant_id': self.test_plant.uuid,
            'timestamp': timezone.now().isoformat(),
            'note_text': 'forgot to add this to my note'
        }
        response = self.client.post('/edit_plant_note', payload)

        # Confirm correct error
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json(), {"error": "note not found"})

    def test_bulk_delete_plant_events_does_not_exist(self):
        # Post payload containing event that does not exist
        payload = {
            'plant_id': self.test_plant.uuid,
            'events': [
                {'type': 'water', 'timestamp': '2024-04-19T00:13:37+00:00'}
            ]
        }
        response = self.client.post('/bulk_delete_plant_events', payload)

        # Confirm event is in failed section
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {
                "deleted": [],
                "failed": [
                    {'type': 'water', 'timestamp': '2024-04-19T00:13:37+00:00'}
                ]
            }
        )

    def test_bulk_delete_plant_events_missing_params(self):
        # Create test event, confirm exists in database
        timestamp = timezone.now()
        WaterEvent.objects.create(plant=self.test_plant, timestamp=timestamp)
        self.assertEqual(len(self.test_plant.waterevent_set.all()), 1)

        # Post incomplete event dict to backend with missing timestamp key
        payload = {
            'plant_id': self.test_plant.uuid,
            'events': [
                {'type': 'water'}
            ]
        }
        response = self.client.post('/bulk_delete_plant_events', payload)

        # Confirm event is in failed section, confirm still in database
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {
                "deleted": [],
                "failed": [
                    {'type': 'water'}
                ]
            }
        )
        self.assertEqual(len(self.test_plant.waterevent_set.all()), 1)

    def test_change_uuid_invalid(self):
        # Call change_uuid endpoint, confirm error
        payload = {
            'uuid': self.test_plant.uuid,
            'new_id': '31670857'
        }
        response = self.client.post('/change_uuid', payload)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"error": "new_id key is not a valid UUID"})

    def test_add_plant_photos_missing_plant_id(self):
        # Send POST with no plant_id key in body, confirm error
        response = self.client.post('/add_plant_photos', {'photo_0': ''})
        self.assertEqual(response.status_code, 404)
        self.assertEqual(
            response.json(),
            {'error': 'unable to find plant'}
        )

    def test_add_plant_photos_missing_photos(self):
        # Post FormData with no files, confirm error
        response = self.client.post(
            '/add_plant_photos',
            data={'plant_id': str(self.test_plant.uuid)},
            content_type=MULTIPART_CONTENT
        )
        self.assertEqual(response.status_code, 404)
        self.assertEqual(
            response.json(),
            {'error': 'no photos were sent'}
        )

    def test_set_non_existing_default_photo(self):
        # Post fake primary key to set_plant_default_photo endpoint
        payload = {
            'plant_id': str(self.test_plant.uuid),
            'photo_key': 1337
        }
        response = self.client.post('/set_plant_default_photo', payload)

        # Confirm error, confirm plant does not have default_photo
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json(), {"error": "unable to find photo"})
        self.test_plant.refresh_from_db()
        self.assertIsNone(self.test_plant.default_photo)

    def test_set_photo_of_wrong_plant_as_default_photo(self):
        # Create second plant entry + photo associated with second plant
        wrong_plant = Plant.objects.create(uuid=uuid4())
        wrong_plant_photo = Photo.objects.create(
            photo=create_mock_photo('2024:02:21 10:52:03', 'IMG1.jpg'),
            plant=wrong_plant
        )
        wrong_plant_photo.save()

        # Post primary key of wrong photo to set_plant_default_photo endpoint
        payload = {
            'plant_id': str(self.test_plant.uuid),
            'photo_key': wrong_plant_photo.pk
        }
        response = self.client.post('/set_plant_default_photo', payload)

        # Confirm error, confirm plant does not have default_photo
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json(), {"error": "unable to find photo"})
        self.test_plant.refresh_from_db()
        self.assertIsNone(self.test_plant.default_photo)


class ViewDecoratorTests(TestCase):
    '''These error handling lines are redundant if required_keys arg is passed
    to requires_json_post, as it currently is for all views. However, they are
    kept for an extra layer of safety in case args are omitted from the list.
    '''

    def test_get_plant_from_post_body_missing_plant_id(self):
        @get_plant_from_post_body
        def mock_view_function(data, **kwargs):
            pass

        # Call function with empty data dict, confirm correct error
        response = mock_view_function(data={})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            json.loads(response.content),
            {"error": "POST body missing required 'plant_id' key"}
        )

    def test_get_group_from_post_body_missing_group_id(self):
        @get_group_from_post_body
        def mock_view_function(data, **kwargs):
            pass

        # Call function with empty data dict, confirm correct error
        response = mock_view_function(data={})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            json.loads(response.content),
            {"error": "POST body missing required 'group_id' key"}
        )

    def test_get_qr_instance_from_post_body_missing_uuid(self):
        @get_qr_instance_from_post_body
        def mock_view_function(data, **kwargs):
            pass

        # Call function with empty data dict, confirm correct error
        response = mock_view_function(data={})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            json.loads(response.content),
            {"error": "POST body missing required 'uuid' key"}
        )

    def test_get_timestamp_from_post_body_missing_timestamp(self):
        @get_timestamp_from_post_body
        def mock_view_function(data, **kwargs):
            pass

        # Call function with empty data dict, confirm correct error
        response = mock_view_function(data={})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            json.loads(response.content),
            {"error": "POST body missing required 'timestamp' key"}
        )

    def test_get_event_type_from_post_body_missing_event_type(self):
        @get_event_type_from_post_body
        def mock_view_function(data, **kwargs):
            pass

        # Call function with empty data dict, confirm correct error
        response = mock_view_function(data={})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            json.loads(response.content),
            {"error": "POST body missing required 'event_type' key"}
        )
