import json
import base64
from uuid import uuid4
from datetime import datetime, timedelta

from django.conf import settings
from django.utils import timezone
from django.test import TestCase
from django.test.client import MULTIPART_CONTENT
from django.core.exceptions import ValidationError

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
            'pot_size': '4',
            'type': 'plant'
        }
        response = self.client.post('/register', payload)

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
            'description': 'This tray is used for propagation',
            'type': 'tray'
        }
        response = self.client.post('/register', payload)

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
        self.assertEqual(len(photo_urls), 2)
        self.assertEqual(photo_urls[0]['created'], '2024:03:21 10:52:03')
        self.assertEqual(photo_urls[1]['created'], '2024:03:22 10:52:03')
        self.assertTrue(photo_urls[0]['url'].startswith('/media/images/photo1'))
        self.assertTrue(photo_urls[1]['url'].startswith('/media/images/photo2'))

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
        self.assertEqual(response.json(), {"uploaded": "1 photo(s)"})

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
        Photo.objects.create(photo=mock_photo1, plant=self.plant1)
        Photo.objects.create(photo=mock_photo2, plant=self.plant1)
        self.assertEqual(len(Photo.objects.all()), 2)

        # Post creation timestamps to delete_plant_photos endpoint
        # Add a non-existing timestamp, should add to response failed section
        payload = {
            'plant_id': str(self.plant1.uuid),
            'delete_photos': [
                '2024:03:21 10:52:03',
                '2024:03:22 10:52:03',
                '2044:03:22 10:52:03'
            ]
        }
        response = self.client.post('/delete_plant_photos', payload)

        # Confirm response, confirm both removed from database
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {
                "deleted": ['2024:03:21 10:52:03', '2024:03:22 10:52:03'],
                "failed": ['2044:03:22 10:52:03']
            }
        )
        self.assertEqual(len(Photo.objects.all()), 0)


class PlantModelTests(TestCase):
    def setUp(self):
        # Create blank test model to use in tests
        self.plant = Plant.objects.create(uuid=uuid4())
        # Create test datetime object for creating events
        self.timestamp = timezone.now()

        # Set default content_type for post requests (avoid long lines)
        self.client = JSONClient()

    def test_last_event_methods(self):
        # Confirm all methods return None when no events exist
        self.assertIsNone(self.plant.last_watered())
        self.assertIsNone(self.plant.last_fertilized())
        self.assertIsNone(self.plant.last_pruned())
        self.assertIsNone(self.plant.last_repotted())

        # Create one event of each type
        WaterEvent.objects.create(plant=self.plant, timestamp=self.timestamp)
        FertilizeEvent.objects.create(plant=self.plant, timestamp=self.timestamp)
        PruneEvent.objects.create(plant=self.plant, timestamp=self.timestamp)
        RepotEvent.objects.create(plant=self.plant, timestamp=self.timestamp)

        # Confirm all methods return expected timestamp
        self.assertEqual(self.plant.last_watered(), self.timestamp.isoformat())
        self.assertEqual(self.plant.last_fertilized(), self.timestamp.isoformat())
        self.assertEqual(self.plant.last_pruned(), self.timestamp.isoformat())
        self.assertEqual(self.plant.last_repotted(), self.timestamp.isoformat())

    def test_get_water_timestamps(self):
        # Create 3 WaterEvents for the plant, 1 day apart, non-chronological order in database
        WaterEvent.objects.create(plant=self.plant, timestamp=self.timestamp - timedelta(days=2))
        WaterEvent.objects.create(plant=self.plant, timestamp=self.timestamp)
        WaterEvent.objects.create(plant=self.plant, timestamp=self.timestamp - timedelta(days=1))

        # Confirm method returns correct list sorted most to least recent
        self.assertEqual(
            self.plant.get_water_timestamps(),
            [
                self.timestamp.isoformat(),
                (self.timestamp - timedelta(days=1)).isoformat(),
                (self.timestamp - timedelta(days=2)).isoformat()
            ]
        )

    def test_get_fertilize_timestamps(self):
        # Create 3 FertilizeEvent for the plant, 1 day apart, non-chronological order in database
        FertilizeEvent.objects.create(plant=self.plant, timestamp=self.timestamp - timedelta(days=2))
        FertilizeEvent.objects.create(plant=self.plant, timestamp=self.timestamp)
        FertilizeEvent.objects.create(plant=self.plant, timestamp=self.timestamp - timedelta(days=1))

        # Confirm method returns correct list sorted most to least recent
        self.assertEqual(
            self.plant.get_fertilize_timestamps(),
            [
                self.timestamp.isoformat(),
                (self.timestamp - timedelta(days=1)).isoformat(),
                (self.timestamp - timedelta(days=2)).isoformat()
            ]
        )

    def test_get_prune_timestamps(self):
        # Create 3 PruneEvent for the plant, 1 day apart, non-chronological order in database
        PruneEvent.objects.create(plant=self.plant, timestamp=self.timestamp - timedelta(days=2))
        PruneEvent.objects.create(plant=self.plant, timestamp=self.timestamp)
        PruneEvent.objects.create(plant=self.plant, timestamp=self.timestamp - timedelta(days=1))

        # Confirm method returns correct list sorted most to least recent
        self.assertEqual(
            self.plant.get_prune_timestamps(),
            [
                self.timestamp.isoformat(),
                (self.timestamp - timedelta(days=1)).isoformat(),
                (self.timestamp - timedelta(days=2)).isoformat()
            ]
        )

    def test_get_repot_timestamps(self):
        # Create 3 RepotEvent for the plant, 1 day apart, non-chronological order in database
        RepotEvent.objects.create(plant=self.plant, timestamp=self.timestamp - timedelta(days=2))
        RepotEvent.objects.create(plant=self.plant, timestamp=self.timestamp)
        RepotEvent.objects.create(plant=self.plant, timestamp=self.timestamp - timedelta(days=1))

        # Confirm method returns correct list sorted most to least recent
        self.assertEqual(
            self.plant.get_repot_timestamps(),
            [
                self.timestamp.isoformat(),
                (self.timestamp - timedelta(days=1)).isoformat(),
                (self.timestamp - timedelta(days=2)).isoformat()
            ]
        )

    def test_change_plant_uuid(self):
        # Call change_plant_uuid endpoint, confirm response + uuid changed
        payload = {
            'plant_id': self.plant.uuid,
            'new_id': str(uuid4())
        }
        response = self.client.post('/change_plant_uuid', payload)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'new_uuid': payload['new_id']})
        self.plant.refresh_from_db()
        self.assertEqual(str(self.plant.uuid), payload['new_id'])

    def test_get_display_name(self):
        # Confirm name and species are null, display_name should be unnamed index
        self.assertIsNone(self.plant.name)
        self.assertIsNone(self.plant.species)
        self.assertEqual(self.plant.get_display_name(), 'Unnamed plant 1')

        # Add species, display_name should be "Unnamed <species>"
        self.plant.species = 'Calathea'
        self.plant.save()
        self.assertEqual(self.plant.get_display_name(), 'Unnamed Calathea')

        # Add name, display_name should be name attribute
        self.plant.name = 'Real name'
        self.plant.save()
        self.assertEqual(self.plant.get_display_name(), 'Real name')

        # Create 3 unnamed plants
        unnamed = []
        for i in range(0, 3):
            unnamed.append(Plant.objects.create(uuid=uuid4()))

        # Confirm Unnamed plants have correct sequential display_names
        self.assertEqual(unnamed[0].get_display_name(), 'Unnamed plant 1')
        self.assertEqual(unnamed[1].get_display_name(), 'Unnamed plant 2')
        self.assertEqual(unnamed[2].get_display_name(), 'Unnamed plant 3')


class TrayModelTests(TestCase):
    def setUp(self):
        # Create test tray
        self.test_tray = Tray.objects.create(uuid=uuid4())

        # Create 2 plants with relations to Tray and 1 without
        self.plant1 = Plant.objects.create(uuid=uuid4(), name="plant1", tray=self.test_tray)
        self.plant2 = Plant.objects.create(uuid=uuid4(), name="plant2", tray=self.test_tray)
        self.plant3 = Plant.objects.create(uuid=uuid4(), name="plant3")

        # Set default content_type for post requests (avoid long lines)
        self.client = JSONClient()

    def test_water_all(self):
        # Confirm plants have no water events
        self.assertEqual(len(self.plant1.waterevent_set.all()), 0)
        self.assertEqual(len(self.plant2.waterevent_set.all()), 0)
        self.assertEqual(len(self.plant3.waterevent_set.all()), 0)

        # Call water_all, plants in tray should have water event, other plant should not
        self.test_tray.water_all(datetime.fromisoformat('2024-02-06T03:06:26+00:00'))
        self.assertEqual(len(self.plant1.waterevent_set.all()), 1)
        self.assertEqual(len(self.plant2.waterevent_set.all()), 1)
        self.assertEqual(len(self.plant3.waterevent_set.all()), 0)

    def test_fertilize_all(self):
        # Confirm plants have no fertilize events
        self.assertEqual(len(self.plant1.fertilizeevent_set.all()), 0)
        self.assertEqual(len(self.plant2.fertilizeevent_set.all()), 0)
        self.assertEqual(len(self.plant3.fertilizeevent_set.all()), 0)

        # Call water_all, plants in tray should have fertilize event, other plant should not
        self.test_tray.fertilize_all(datetime.fromisoformat('2024-02-06T03:06:26+00:00'))
        self.assertEqual(len(self.plant1.fertilizeevent_set.all()), 1)
        self.assertEqual(len(self.plant2.fertilizeevent_set.all()), 1)
        self.assertEqual(len(self.plant3.fertilizeevent_set.all()), 0)

    def test_change_tray_uuid(self):
        # Call change_tray_uuid endpoint, confirm response + uuid changed
        payload = {
            'tray_id': self.test_tray.uuid,
            'new_id': str(uuid4())
        }
        response = self.client.post('/change_tray_uuid', payload)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'new_uuid': payload['new_id']})
        self.test_tray.refresh_from_db()
        self.assertEqual(str(self.test_tray.uuid), payload['new_id'])

    def test_get_display_name(self):
        # Confirm name and location are null, display_name should be unnamed index
        self.assertIsNone(self.test_tray.name)
        self.assertIsNone(self.test_tray.location)
        self.assertEqual(self.test_tray.get_display_name(), 'Unnamed tray 1')

        # Add location, display_name should be "<location> tray"
        self.test_tray.location = 'Middle shelf'
        self.test_tray.save()
        self.assertEqual(self.test_tray.get_display_name(), 'Middle shelf tray')

        # Add name, display_name should be name attribute
        self.test_tray.name = 'Real name'
        self.test_tray.save()
        self.assertEqual(self.test_tray.get_display_name(), 'Real name')

        # Create 3 unnamed trays
        unnamed = []
        for i in range(0, 3):
            unnamed.append(Tray.objects.create(uuid=uuid4()))

        # Confirm Unnamed trays have correct sequential display_names
        self.assertEqual(unnamed[0].get_display_name(), 'Unnamed tray 1')
        self.assertEqual(unnamed[1].get_display_name(), 'Unnamed tray 2')
        self.assertEqual(unnamed[2].get_display_name(), 'Unnamed tray 3')


class EventModelTests(TestCase):
    def setUp(self):
        self.plant = Plant.objects.create(uuid=uuid4())
        self.timestamp = datetime.now()

    def test_duplicate_water_event(self):
        # Create WaterEvent, confirm 1 entry exists
        WaterEvent.objects.create(plant=self.plant, timestamp=self.timestamp)
        self.assertEqual(len(WaterEvent.objects.all()), 1)

        # Attempt to create duplicate with same timestamp, should raise error
        with self.assertRaises(ValidationError):
            WaterEvent.objects.create(plant=self.plant, timestamp=self.timestamp)

        # Confirm second event was not created
        self.assertEqual(len(WaterEvent.objects.all()), 1)

    def test_duplicate_fertilize_event(self):
        # Create FertilizeEvent, confirm 1 entry exists
        FertilizeEvent.objects.create(plant=self.plant, timestamp=self.timestamp)
        self.assertEqual(len(FertilizeEvent.objects.all()), 1)

        # Attempt to create duplicate with same timestamp, should raise error
        with self.assertRaises(ValidationError):
            FertilizeEvent.objects.create(plant=self.plant, timestamp=self.timestamp)

        # Confirm second event was not created
        self.assertEqual(len(FertilizeEvent.objects.all()), 1)

    def test_duplicate_prune_event(self):
        # Create PruneEvent, confirm 1 entry exists
        PruneEvent.objects.create(plant=self.plant, timestamp=self.timestamp)
        self.assertEqual(len(PruneEvent.objects.all()), 1)

        # Attempt to create duplicate with same timestamp, should raise error
        with self.assertRaises(ValidationError):
            PruneEvent.objects.create(plant=self.plant, timestamp=self.timestamp)

        # Confirm second event was not created
        self.assertEqual(len(PruneEvent.objects.all()), 1)

    def test_duplicate_repot_event(self):
        # Create RepotEvent, confirm 1 entry exists
        RepotEvent.objects.create(plant=self.plant, timestamp=self.timestamp)
        self.assertEqual(len(RepotEvent.objects.all()), 1)

        # Attempt to create duplicate with same timestamp, should raise error
        with self.assertRaises(ValidationError):
            RepotEvent.objects.create(plant=self.plant, timestamp=self.timestamp)

        # Confirm second event was not created
        self.assertEqual(len(RepotEvent.objects.all()), 1)


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
        response = self.client.get('/register')
        self.assertEqual(response.status_code, 405)
        self.assertEqual(response.json(), {'error': 'must post data'})

        # Send GET request to endpoint that expects FormData (handles own error)
        response = self.client.get('/add_plant_photos')
        self.assertEqual(response.status_code, 405)
        self.assertEqual(response.json(), {'error': 'must post FormData'})

    def test_invalid_post_body(self):
        # Send POST with non-JSON body, confirm error
        response = self.client.post(
            '/register',
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
            {"error": "invalid event_type, must be 'water', 'fertilize', 'prune', or 'repot"}
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


class RegressionTests(TestCase):
    def test_changing_uuid_should_not_create_duplicate(self):
        '''Issue: UUID was originally used as primary_key with editable=True.
        When UUID was changed (assign new QR code) the primary_key no longer
        matched any row in the database, so a new row was created without
        deleting the original. This was fixed by changing the attribute name
        from id to uuid and removing primary_key=True (use default BigAuto).
        '''

        # Create test plant and tray, confirm 1 entry each
        plant = Plant.objects.create(uuid=uuid4())
        tray = Tray.objects.create(uuid=uuid4())
        self.assertEqual(len(Plant.objects.all()), 1)
        self.assertEqual(len(Tray.objects.all()), 1)

        # Change both UUIDs, confirm no duplicates were created
        plant.uuid = uuid4()
        tray.uuid = uuid4()
        plant.save()
        tray.save()
        self.assertEqual(len(Plant.objects.all()), 1)
        self.assertEqual(len(Tray.objects.all()), 1)

    def test_water_tray_fails_due_to_duplicate_timestamp(self):
        '''Issue: The bulk_add_plant_events endpoint did not trap errors when
        creating events. If a plant in UUID list already had an event with the
        same timestamp an uncaught exception would occur, preventing remaining
        events from being created and returning an unexpected response.
        '''

        # Create 3 test plants, create WaterEvent for second plant
        plant1 = Plant.objects.create(uuid=uuid4())
        plant2 = Plant.objects.create(uuid=uuid4())
        plant3 = Plant.objects.create(uuid=uuid4())
        timestamp = datetime.now()
        WaterEvent.objects.create(plant=plant2, timestamp=timestamp)

        # Confirm 1 WaterEvent exists, plant2 has event, plants 1 and 3 do not
        self.assertEqual(len(WaterEvent.objects.all()), 1)
        self.assertEqual(len(plant1.waterevent_set.all()), 0)
        self.assertEqual(len(plant2.waterevent_set.all()), 1)
        self.assertEqual(len(plant3.waterevent_set.all()), 0)

        # Send bulk_add_plants_to_tray request for all plants with same
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
        timestamp = datetime.now()
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


class ViewDecoratorRegressionTests(TestCase):
    def setUp(self):
        self.plant = Plant.objects.create(uuid=uuid4())
        self.tray = Tray.objects.create(uuid=uuid4())

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

    def test_get_tray_from_post_body_traps_wrapped_function_exceptions(self):
        '''Issue: get_tray_from_post_body called the wrapped function inside a
        try/except block used to handle request payload errors. If an uncaught
        exception occurred in the wrapped function it would be caught by the
        wrapper, resulting in a JsonResponse with misleading error.
        '''

        # Create test functions that raise errors caught by decorator
        @get_tray_from_post_body
        def test_key_error(tray, data):
            raise KeyError("wrapped function error")

        @get_tray_from_post_body
        def test_validation_error(tray, data):
            raise ValidationError("wrapped function error")

        # Exceptions should not be caught by the decorator
        # Confirm exceptions were raised by wrapped function and not decorator
        with self.assertRaises(KeyError) as e:
            test_key_error({'tray_id': str(self.tray.uuid)})
        self.assertEqual(e.exception.args[0], "wrapped function error")

        with self.assertRaises(ValidationError) as e:
            test_validation_error({'tray_id': str(self.tray.uuid)})
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
