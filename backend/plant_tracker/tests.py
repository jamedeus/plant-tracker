import base64
from uuid import uuid4
from datetime import datetime, timedelta

from django.utils import timezone
from django.test import Client, TestCase

from .models import Tray, Plant, WaterEvent, FertilizeEvent, PruneEvent, RepotEvent


# Subclass Client, add default for content_type arg
class JSONClient(Client):
    def post(self, path, data=None, content_type='application/json', **extra):
        return super().post(path, data, content_type, **extra)


class OverviewTests(TestCase):
    def setUp(self):
        # Set default content_type for post requests (avoid long lines)
        self.client = JSONClient()

    def test_overview_page(self):
        # Confirm correct template used
        response = self.client.get('/')
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'plant_tracker/overview.html')

    def test_get_qr_codes(self):
        # Confirm response contains base64 string
        response = self.client.get('/get_qr_codes')
        try:
            base64.b64decode(response.json()['qr_codes'], validate=True)
        except:
            self.assertTrue(False)

    def test_delete_plant(self):
        # Create test plant, confirm exists in database
        test_id = uuid4()
        Plant.objects.create(uuid=test_id, name='test plant')
        self.assertEqual(len(Plant.objects.all()), 1)

        # Call delete endpoint, confirm redirects to overview, confirm removed from database
        response = self.client.post('/delete_plant', {'plant_id': str(test_id)})
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.url, '/')
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

        # Call delete endpoint, confirm redirects to overview, confirm removed from database
        response = self.client.post('/delete_tray', {'tray_id': str(test_id)})
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.url, '/')
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

    def _refresh_test_models(self):
        self.plant1.refresh_from_db()
        self.plant2.refresh_from_db()
        self.tray1.refresh_from_db()

    def test_registration_plant(self):
        # Confirm no plants or trays in database (except test entries)
        self.assertEqual(len(Plant.objects.all()), 2)
        self.assertEqual(len(Tray.objects.all()), 1)

        # Send plant registration request
        test_id = uuid4()
        payload = {
            'uuid': test_id,
            'name': 'test plant',
            'species': 'Giant Sequoia',
            'description': '300 feet and a few thousand years old',
            'pot_size': '4',
            'type': 'plant'
        }
        response = self.client.post('/register', payload)

        # Confirm response redirects to management page for new plant
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.url, f'/manage/{test_id}')

        # Confirm exists in database, has correct parameters
        self.assertEqual(len(Plant.objects.all()), 3)
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

        # Send registration request
        test_id = uuid4()
        payload = {
            'uuid': test_id,
            'name': 'test tray',
            'location': 'top shelf',
            'type': 'tray'
        }
        response = self.client.post('/register', payload)

        # Confirm response redirects to management page for new tray
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.url, f'/manage/{test_id}')

        # Confirm exists in database, has correct parameters
        self.assertEqual(len(Tray.objects.all()), 2)
        tray = Tray.objects.get(uuid=test_id)
        self.assertEqual(tray.name, 'test tray')
        self.assertEqual(tray.location, 'top shelf')
        # Confirm no extra plant created
        self.assertEqual(len(Plant.objects.all()), 2)

    def test_manage_new_plant(self):
        # Add species to test plants
        self.plant1.species = "Fittonia"
        self.plant2.species = "Calathea"
        self.plant1.save()
        self.plant2.save()

        # Request management page for new plant, confirm register template renders
        response = self.client.get(f'/manage/{uuid4()}')
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'plant_tracker/register.html')

        # Confirm context contains list of existing plant species
        self.assertIn('Calathea', response.context['species_options'])
        self.assertIn('Fittonia', response.context['species_options'])
        self.assertEqual(len(response.context['species_options']), 2)

    def test_manage_existing_plant(self):
        # Request management page for test plant, confirm correct template renders
        response = self.client.get(f'/manage/{self.plant1.uuid}')
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'plant_tracker/manage_plant.html')
        self.assertTemplateNotUsed(response, 'plant_tracker/manage_tray.html')
        # Confirm species_options list is empty (test plants have no species)
        self.assertEqual(response.context['species_options'], [])

    def test_manage_existing_tray(self):
        # Add test plant to tray
        self.plant1.tray = self.tray1
        self.plant1.save()

        # Request management page for test tray, confirm correct template renders
        response = self.client.get(f'/manage/{self.tray1.uuid}')
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'plant_tracker/manage_tray.html')
        self.assertTemplateNotUsed(response, 'plant_tracker/manage_plant.html')

        # Confirm context includes tray, correct plant details
        self.assertEqual(response.context['tray'], self.tray1)
        self.assertEqual(len(response.context['details']), 1)
        self.assertEqual(response.context['details'][self.plant1.uuid]['name'], 'Unnamed plant 1')
        self.assertEqual(response.context['details'][self.plant1.uuid]['last_watered'], None)
        self.assertEqual(response.context['details'][self.plant1.uuid]['last_fertilized'], None)

    def test_edit_plant_details(self):
        # Confirm test plant has no name or species
        self.assertIsNone(self.plant1.name)
        self.assertIsNone(self.plant1.species)

        # Send edit details request, confirm redirects to manage page
        payload = {
            'plant_id': self.plant1.uuid,
            'name': 'test plant',
            'species': 'Giant Sequoia',
            'description': '300 feet and a few thousand years old',
            'pot_size': '4'
        }
        response = self.client.post('/edit_plant', payload)
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.url, f'/manage/{self.plant1.uuid}')

        # Confirm no additional plant created, confirm details now match
        self.assertEqual(len(Plant.objects.all()), 2)
        self._refresh_test_models()
        self.assertEqual(self.plant1.name, 'test plant')
        self.assertEqual(self.plant1.species, 'Giant Sequoia')

    def test_edit_tray_details(self):
        # Confirm test tray has no name
        self.assertIsNone(self.tray1.name)

        # Send edit details request, confirm redirects to manage page
        payload = {
            'tray_id': self.tray1.uuid,
            'name': 'test tray',
            'location': 'middle shelf'
        }
        response = self.client.post('/edit_tray', payload)
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.url, f'/manage/{self.tray1.uuid}')

        # Confirm no additional tray created, confirm details now match
        self.assertEqual(len(Tray.objects.all()), 1)
        self._refresh_test_models()
        self.assertEqual(self.tray1.name, 'test tray')
        self.assertEqual(self.tray1.location, 'middle shelf')

    def test_add_plant_to_tray(self):
        # Confirm test plant and tray have no database relation
        self.assertIsNone(self.plant1.tray)
        self.assertEqual(len(self.tray1.plant_set.all()), 0)

        # Send add_plant_to_tray request, confirm response + relation created
        payload = {'plant_id': self.plant1.uuid, 'tray_id': self.tray1.uuid}
        response = self.client.post('/add_plant_to_tray', payload)
        self.assertEqual(response.status_code, 200)
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

        # Send bulk_add_plants_to_tray request with both IDs
        payload = {
            'tray_id': self.tray1.uuid,
            'plants': [
                self.plant1.uuid,
                self.plant2.uuid
            ]
        }
        response = self.client.post('/bulk_add_plants_to_tray', payload)

        # Confirm page refreshed, confirm plants both have relation
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.url, f'/manage/{self.tray1.uuid}')
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

        # Send bulk_add_plants_to_tray request with both IDs
        payload = {
            'tray_id': self.tray1.uuid,
            'plants': [
                self.plant1.uuid,
                self.plant2.uuid
            ]
        }
        response = self.client.post('/bulk_remove_plants_from_tray', payload)

        # Confirm page refreshed, confirm plants both have relation
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.url, f'/manage/{self.tray1.uuid}')
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

    def _refresh_test_models(self):
        self.plant1.refresh_from_db()
        self.plant2.refresh_from_db()

    def test_water_plant(self):
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

    def test_fertilize_plant(self):
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

    def test_prune_plant(self):
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

    def test_repot_plant(self):
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

        # Create fake UUID that doesn't exist in database
        fake_id = uuid4()

        # Send bulk_add_plants_to_tray request with both IDs
        payload = {
            'plants': [
                str(self.plant1.uuid),
                str(self.plant2.uuid),
                str(fake_id)
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
                "failed": [str(fake_id)]
            }
        )
        self.assertEqual(len(self.plant1.waterevent_set.all()), 1)
        self.assertEqual(len(self.plant2.waterevent_set.all()), 1)

    def test_bulk_fertilize_plants(self):
        # Confirm test plants have no FertilizeEvents
        self.assertEqual(len(self.plant1.fertilizeevent_set.all()), 0)
        self.assertEqual(len(self.plant2.fertilizeevent_set.all()), 0)

        # Create fake UUID that doesn't exist in database
        fake_id = uuid4()

        # Send bulk_add_plants_to_tray request with both IDs
        payload = {
            'plants': [
                str(self.plant1.uuid),
                str(self.plant2.uuid),
                str(fake_id)
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
                "failed": [str(fake_id)]
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
        # Create 3 WaterEvents for the plant, 1 day apart
        WaterEvent.objects.create(plant=self.plant, timestamp=self.timestamp)
        WaterEvent.objects.create(plant=self.plant, timestamp=self.timestamp - timedelta(days=1))
        WaterEvent.objects.create(plant=self.plant, timestamp=self.timestamp - timedelta(days=2))

        # Confirm method returns correct list
        self.assertEqual(
            self.plant.get_water_timestamps(),
            [
                self.timestamp.isoformat(),
                (self.timestamp - timedelta(days=1)).isoformat(),
                (self.timestamp - timedelta(days=2)).isoformat()
            ]
        )

    def test_get_fertilize_timestamps(self):
        # Create 3 FertilizeEvent for the plant, 1 day apart
        FertilizeEvent.objects.create(plant=self.plant, timestamp=self.timestamp)
        FertilizeEvent.objects.create(plant=self.plant, timestamp=self.timestamp - timedelta(days=1))
        FertilizeEvent.objects.create(plant=self.plant, timestamp=self.timestamp - timedelta(days=2))

        # Confirm method returns correct list
        self.assertEqual(
            self.plant.get_fertilize_timestamps(),
            [
                self.timestamp.isoformat(),
                (self.timestamp - timedelta(days=1)).isoformat(),
                (self.timestamp - timedelta(days=2)).isoformat()
            ]
        )

    def test_get_prune_timestamps(self):
        # Create 3 PruneEvent for the plant, 1 day apart
        PruneEvent.objects.create(plant=self.plant, timestamp=self.timestamp)
        PruneEvent.objects.create(plant=self.plant, timestamp=self.timestamp - timedelta(days=1))
        PruneEvent.objects.create(plant=self.plant, timestamp=self.timestamp - timedelta(days=2))

        # Confirm method returns correct list
        self.assertEqual(
            self.plant.get_prune_timestamps(),
            [
                self.timestamp.isoformat(),
                (self.timestamp - timedelta(days=1)).isoformat(),
                (self.timestamp - timedelta(days=2)).isoformat()
            ]
        )

    def test_get_repot_timestamps(self):
        # Create 3 RepotEvent for the plant, 1 day apart
        RepotEvent.objects.create(plant=self.plant, timestamp=self.timestamp)
        RepotEvent.objects.create(plant=self.plant, timestamp=self.timestamp - timedelta(days=1))
        RepotEvent.objects.create(plant=self.plant, timestamp=self.timestamp - timedelta(days=2))

        # Confirm method returns correct list
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


class InvalidRequestTests(TestCase):
    def setUp(self):
        # Create test models to use in tests
        self.test_plant = Plant.objects.create(uuid=uuid4())
        self.test_tray = Tray.objects.create(uuid=uuid4())

        # Set default content_type for post requests (avoid long lines)
        self.client = JSONClient()

    def test_invalid_get_request(self):
        # Send GET request to endpoint that requires POST, confirm error
        response = self.client.get('/register')
        self.assertEqual(response.status_code, 405)
        self.assertEqual(response.json(), {'Error': 'Must post data'})

    def test_invalid_post_body(self):
        # Send POST with non-JSON body, confirm error
        response = self.client.post(
            '/register',
            f'uuid={uuid4()}&name=test&species=test&description=None&pot_size=4&type=plant',
            content_type='text/plain',
        )
        self.assertEqual(response.status_code, 405)
        self.assertEqual(response.json(), {'Error': 'Request body must be JSON'})

    def test_uuid_does_not_exist(self):
        # Send POST with UUID that does not exist in database, confirm error
        response = self.client.post('/delete_plant', {'plant_id': uuid4()})
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json(), {"error": "plant not found"})

    def test_missing_plant_id(self):
        # Send POST with no plant_id key in body, confirm error
        response = self.client.post('/delete_plant', {'timestamp': '2024-02-06T03:06:26.000Z'})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"error": "POST body missing required 'plant_id' key"})

    def test_missing_tray_id(self):
        # Send POST with no tray_id key in body, confirm error
        response = self.client.post('/delete_tray')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"error": "POST body missing required 'tray_id' key"})

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
        self.assertEqual(response.json(), {"error": "POST body missing required 'timestamp' key"})

    def test_invalid_timestamp_format(self):
        # Send POST with invalid timestamp in body, confirm error
        response = self.client.post(
            '/add_plant_event',
            {'plant_id': self.test_plant.uuid, 'timestamp': '04:20', 'event_type': 'water'}
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"error": "timestamp format invalid"})

    def test_missing_event_type_key(self):
        # Send POST with with no event_type in body, confirm error
        response = self.client.post(
            '/add_plant_event',
            {'plant_id': self.test_plant.uuid, 'timestamp': '2024-02-06T03:06:26.000Z'}
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"error": "POST body missing required 'event_type' key"})

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
