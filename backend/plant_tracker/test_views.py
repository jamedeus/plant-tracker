import os
import json
import base64
import shutil
from uuid import uuid4
from datetime import datetime

from django.conf import settings
from django.utils import timezone
from django.test import TestCase
from django.test import override_settings
from django.test.client import MULTIPART_CONTENT

from .models import (
    Tray,
    Plant,
    WaterEvent,
    FertilizeEvent,
    PruneEvent,
    RepotEvent,
    Photo
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

        # Confirm correct state object (no plants or trays in database)
        self.assertEqual(
            response.context['state'],
            {'plants': [], 'trays': []}
        )

    def test_overview_page_with_database_entries(self):
        # Create test tray and 2 test plants
        tray = Tray.objects.create(uuid=uuid4())
        plant1 = Plant.objects.create(uuid=uuid4(), name='Test plant')
        plant2 = Plant.objects.create(uuid=uuid4(), species='fittonia', tray=tray)

        # Request overview, confirm uses correct JS bundle and title
        response = self.client.get('/')
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'plant_tracker/index.html')
        self.assertEqual(response.context['js_bundle'], 'plant_tracker/overview.js')
        self.assertEqual(response.context['title'], 'Overview')

        # Confirm state object has details of all plants and trays
        state = response.context['state']
        self.assertEqual(
            state['plants'],
            [
                {
                    'uuid': str(plant1.uuid),
                    'name': 'Test plant',
                    'species': None,
                    'description': None,
                    'pot_size': None,
                    'last_watered': None,
                    'last_fertilized': None
                },
                {
                    'uuid': str(plant2.uuid),
                    'name': 'Unnamed fittonia',
                    'species': 'fittonia',
                    'description': None,
                    'pot_size': None,
                    'last_watered': None,
                    'last_fertilized': None
                }
            ]
        )
        self.assertEqual(
            state['trays'],
            [
                {
                    'uuid': str(tray.uuid),
                    'name': 'Unnamed tray 1',
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

    def test_delete_tray(self):
        # Create test tray, confirm exists in database
        test_id = uuid4()
        Tray.objects.create(uuid=test_id, name='test tray')
        self.assertEqual(len(Tray.objects.all()), 1)

        # Call delete endpoint, confirm response, confirm removed from database
        response = self.client.post('/delete_tray', {'tray_id': str(test_id)})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'deleted': str(test_id)})
        self.assertEqual(len(Tray.objects.all()), 0)

        # Attempt to delete non-existing tray, confirm error
        response = self.client.post('/delete_tray', {'tray_id': str(test_id)})
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json(), {'error': 'tray not found'})


class ManagePageTests(TestCase):
    @override_settings(MEDIA_ROOT=os.path.join(TEST_DIR, 'data', 'images'))
    def setUp(self):
        # Set default content_type for post requests (avoid long lines)
        self.client = JSONClient()

        # Create test plants and trays
        self.plant1 = Plant.objects.create(uuid=uuid4())
        self.plant2 = Plant.objects.create(uuid=uuid4())
        self.tray1 = Tray.objects.create(uuid=uuid4())

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
        for i in os.listdir(os.path.join(TEST_DIR, 'data', 'images', 'images')):
            os.remove(os.path.join(TEST_DIR, 'data', 'images', 'images', i))
        for i in os.listdir(os.path.join(TEST_DIR, 'data', 'images', 'thumbnails')):
            os.remove(os.path.join(TEST_DIR, 'data', 'images', 'thumbnails', i))

    def _refresh_test_models(self):
        self.plant1.refresh_from_db()
        self.plant2.refresh_from_db()
        self.tray1.refresh_from_db()

    def test_registration_plant(self):
        # Confirm no plants or trays in database (except test entries)
        self.assertEqual(len(Plant.objects.all()), 2)
        self.assertEqual(len(Tray.objects.all()), 1)

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
        # Confirm no extra tray created
        self.assertEqual(len(Tray.objects.all()), 1)

    def test_registration_tray(self):
        # Confirm no plants or trays in database (except test entries)
        self.assertEqual(len(Plant.objects.all()), 2)
        self.assertEqual(len(Tray.objects.all()), 1)

        # Send plant registration request with extra spaces on some params
        test_id = uuid4()
        payload = {
            'uuid': test_id,
            'name': '    test tray',
            'location': 'top shelf    ',
            'description': 'This tray is used for propagation'
        }
        response = self.client.post('/register_tray', payload)

        # Confirm response redirects to management page for new tray
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.url, f'/manage/{test_id}')

        # Confirm exists in database
        self.assertEqual(len(Tray.objects.all()), 2)
        # Confirm tray has corrrect params, confirm extra spaces were removed
        tray = Tray.objects.get(uuid=test_id)
        self.assertEqual(tray.name, 'test tray')
        self.assertEqual(tray.location, 'top shelf')
        self.assertEqual(tray.description, 'This tray is used for propagation')
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
        self.assertEqual(state['plant'], {
            'uuid': str(self.plant1.uuid),
            'name': None,
            'display_name': 'Unnamed plant 1',
            'species': None,
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
            'tray': None,
        })

        # Confirm species_options list is empty (test plants have no species)
        self.assertEqual(response.context['state']['species_options'], [])

        # Confirm photo_urls contains list of dicts with timestamp keys, URL values
        photo_urls = response.context['state']['photo_urls']
        self.assertEqual(
            photo_urls,
            [
                {
                    'created': '2024:03:22 10:52:03',
                    'image': '/media/images/photo2.jpg',
                    'thumbnail': '/media/thumbnails/photo2_thumb.jpg',
                    'key': 2
                },
                {
                    'created': '2024:03:21 10:52:03',
                    'image': '/media/images/photo1.jpg',
                    'thumbnail': '/media/thumbnails/photo1_thumb.jpg',
                    'key': 1
                },
            ]
        )

        # Add test plant to tray, request page again
        self.plant1.tray = self.tray1
        self.plant1.save()
        response = self.client.get(f'/manage/{self.plant1.uuid}')

        # Confirm state object contains tray details
        self.assertEqual(
            response.context['state']['plant']['tray'],
            {
                'name': self.tray1.get_display_name(),
                'uuid': str(self.tray1.uuid)
            }
        )

    def test_manage_existing_tray(self):
        # Add test plant to tray
        self.plant1.tray = self.tray1
        self.plant1.save()

        # Request management page for test tray, confirm status
        response = self.client.get(f'/manage/{self.tray1.uuid}')
        self.assertEqual(response.status_code, 200)

        # Confirm used manage_tray bundle and correct title
        self.assertTemplateUsed(response, 'plant_tracker/index.html')
        self.assertEqual(response.context['js_bundle'], 'plant_tracker/manage_tray.js')
        self.assertEqual(response.context['title'], 'Manage Tray')

        # Confirm expected state objects
        state = response.context['state']
        self.assertEqual(
            state['tray'],
            {
                'uuid': str(self.tray1.uuid),
                'name': self.tray1.name,
                'location': None,
                'description': None,
                'display_name': self.tray1.get_display_name()
            }
        )

        # Confirm details state contains params for plant in tray
        self.assertEqual(
            state['details'],
            [{
                'name': 'Unnamed plant 1',
                'uuid': str(self.plant1.uuid),
                'species': None,
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
                    'name': self.plant1.get_display_name(),
                    'uuid': str(self.plant1.uuid)
                },
                {
                    'name': self.plant2.get_display_name(),
                    'uuid': str(self.plant2.uuid)
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

    def test_edit_tray_details(self):
        # Confirm test tray has no name
        self.assertIsNone(self.tray1.name)

        # Send edit details request
        # Note trailing spaces on name, leading spaces on location
        payload = {
            'tray_id': self.tray1.uuid,
            'name': 'test tray    ',
            'location': '    middle shelf',
            'description': 'This tray is used for propagation'
        }
        response = self.client.post('/edit_tray', payload)

        # Confirm response contains correct details with extra spaces removed
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {
                'name': 'test tray',
                'display_name': 'test tray',
                'location': 'middle shelf',
                'description': 'This tray is used for propagation'
            }
        )

        # Confirm no additional tray created
        self.assertEqual(len(Tray.objects.all()), 1)
        # Confirm details now match, leading/trailing spaces were removed
        self._refresh_test_models()
        self.assertEqual(self.tray1.name, 'test tray')
        self.assertEqual(self.tray1.location, 'middle shelf')
        self.assertEqual(self.tray1.description, 'This tray is used for propagation')

    def test_add_plant_to_tray(self):
        # Confirm test plant and tray have no database relation
        self.assertIsNone(self.plant1.tray)
        self.assertEqual(len(self.tray1.plant_set.all()), 0)

        # Send add_plant_to_tray request, confirm response
        payload = {'plant_id': self.plant1.uuid, 'tray_id': self.tray1.uuid}
        response = self.client.post('/add_plant_to_tray', payload)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {
                "action": "add_plant_to_tray",
                "plant": str(self.plant1.uuid),
                "tray_name": self.tray1.get_display_name(),
                "tray_uuid": str(self.tray1.uuid)
            }
        )

        # Confirm database relation created
        self._refresh_test_models()
        self.assertEqual(self.plant1.tray, self.tray1)
        self.assertEqual(len(self.tray1.plant_set.all()), 1)

    def test_remove_plant_from_tray(self):
        # Add test plant to tray, confirm relation
        self.plant1.tray = self.tray1
        self.plant1.save()
        self.assertEqual(self.plant1.tray, self.tray1)
        self.assertEqual(len(self.tray1.plant_set.all()), 1)

        # Send add_plant_to_tray request, confirm response + relation removed
        response = self.client.post('/remove_plant_from_tray', {'plant_id': self.plant1.uuid})
        self.assertEqual(response.status_code, 200)
        self._refresh_test_models()
        self.assertIsNone(self.plant1.tray)
        self.assertEqual(len(self.tray1.plant_set.all()), 0)

    def test_bulk_add_plants_to_tray(self):
        # Confirm test plants are not in test tray
        self.assertIsNone(self.plant1.tray)
        self.assertIsNone(self.plant2.tray)
        self.assertEqual(len(self.tray1.plant_set.all()), 0)

        # Send bulk_add_plants_to_tray request with both IDs + 1 fake ID
        payload = {
            'tray_id': self.tray1.uuid,
            'plants': [
                self.plant1.uuid,
                self.plant2.uuid,
                self.fake_id
            ]
        }
        response = self.client.post('/bulk_add_plants_to_tray', payload)

        # Confirm plant UUIDs were added, fake ID failed
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {
                "added": [self.plant1.get_details(), self.plant2.get_details()],
                "failed": [str(self.fake_id)]
            }
        )

        # Confirm plants both have relation to tray
        self._refresh_test_models()
        self.assertEqual(self.plant1.tray, self.tray1)
        self.assertEqual(self.plant2.tray, self.tray1)
        self.assertEqual(len(self.tray1.plant_set.all()), 2)

    def test_bulk_remove_plants_from_tray(self):
        # Add 2 test plants to test tray, confirm relation exists
        self.plant1.tray = self.tray1
        self.plant2.tray = self.tray1
        self.plant1.save()
        self.plant2.save()
        self.assertEqual(self.plant1.tray, self.tray1)
        self.assertEqual(self.plant2.tray, self.tray1)
        self.assertEqual(len(self.tray1.plant_set.all()), 2)

        # Send bulk_add_plants_to_tray request with both IDs + 1 fake ID
        payload = {
            'tray_id': self.tray1.uuid,
            'plants': [
                self.plant1.uuid,
                self.plant2.uuid,
                self.fake_id
            ]
        }
        response = self.client.post('/bulk_remove_plants_from_tray', payload)

        # Confirm plant UUIDs were removed, fake ID failed
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {
                "removed": [str(self.plant1.uuid), str(self.plant2.uuid)],
                "failed": [str(self.fake_id)]
            }
        )

        # Confirm plants no longer have relation to tray
        self._refresh_test_models()
        self.assertIsNone(self.plant1.tray)
        self.assertIsNone(self.plant2.tray)
        self.assertEqual(len(self.tray1.plant_set.all()), 0)

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


class PlantEventTests(TestCase):
    def setUp(self):
        # Set default content_type for post requests (avoid long lines)
        self.client = JSONClient()

        # Create test plants and trays
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

        # Send water request, confirm event created
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

        # Send water request, confirm event created
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

        # Send water request, confirm event created
        response = self.client.post('/add_plant_event', payload)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"action": "repot", "plant": str(self.plant1.uuid)})
        self.assertEqual(len(RepotEvent.objects.all()), 1)
        self.assertEqual(self.plant1.last_repotted(), '2024-02-06T03:06:26+00:00')

    def test_bulk_water_plants(self):
        # Confirm test plants have no WaterEvents
        self.assertEqual(len(self.plant1.waterevent_set.all()), 0)
        self.assertEqual(len(self.plant2.waterevent_set.all()), 0)

        # Send bulk_add_plants_to_tray request with both IDs
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

        # Send bulk_add_plants_to_tray request with both IDs
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

    @override_settings(MEDIA_ROOT=os.path.join(TEST_DIR, 'data', 'images'))
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
                    "created": "2024:03:22 10:52:03",
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

    @override_settings(MEDIA_ROOT=os.path.join(TEST_DIR, 'data', 'images'))
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


class InvalidRequestTests(TestCase):
    def setUp(self):
        # Create test models to use in tests
        self.test_plant = Plant.objects.create(uuid=uuid4())
        self.test_tray = Tray.objects.create(uuid=uuid4())

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

    def test_uuid_does_not_exist(self):
        # Send POST with UUID that does not exist in database, confirm error
        response = self.client.post('/delete_plant', {'plant_id': uuid4()})
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json(), {"error": "plant not found"})

    def test_missing_plant_id(self):
        # Send POST with no plant_id key in body, confirm error
        response = self.client.post('/delete_plant', {'timestamp': '2024-02-06T03:06:26.000Z'})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.json(),
            {"error": "POST body missing required keys", "keys": ['plant_id']}
        )

    def test_missing_tray_id(self):
        # Send POST with no tray_id key in body, confirm error
        response = self.client.post('/delete_tray')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.json(),
            {"error": "POST body missing required keys", "keys": ['tray_id']}
        )

    def test_invalid_plant_uuid(self):
        # Send POST with plant_id that is not a valid UUID, confirm error
        response = self.client.post('/delete_plant', {'plant_id': '31670857'})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"error": "plant_id key is not a valid UUID"})

    def test_invalid_tray_uuid(self):
        # Send POST with tray_id that is not a valid UUID, confirm error
        response = self.client.post('/delete_tray', {'tray_id': '31670857'})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"error": "tray_id key is not a valid UUID"})

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
        timestamp = datetime.now()
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

    def test_change_plant_uuid_invalid(self):
        # Call change_plant_uuid endpoint, confirm error
        payload = {
            'plant_id': self.test_plant.uuid,
            'new_id': '31670857'
        }
        response = self.client.post('/change_plant_uuid', payload)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"error": "new_id key is not a valid UUID"})

    def test_change_tray_uuid_invalid(self):
        # Call change_tray_uuid endpoint, confirm error
        payload = {
            'tray_id': self.test_tray.uuid,
            'new_id': '31670857'
        }
        response = self.client.post('/change_tray_uuid', payload)
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

    def test_get_tray_from_post_body_missing_tray_id(self):
        @get_tray_from_post_body
        def mock_view_function(data, **kwargs):
            pass

        # Call function with empty data dict, confirm correct error
        response = mock_view_function(data={})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            json.loads(response.content),
            {"error": "POST body missing required 'tray_id' key"}
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
