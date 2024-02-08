import base64
from uuid import uuid4
from datetime import datetime

from django.test import Client, TestCase

from .models import Tray, Plant, WaterEvent, FertilizeEvent


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
        Plant.objects.create(id=test_id, name='test plant')
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
        Tray.objects.create(id=test_id, name='test tray')
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

    def test_registration_plant(self):
        # Confirm no plants or trays in database
        self.assertEqual(len(Plant.objects.all()), 0)
        self.assertEqual(len(Tray.objects.all()), 0)

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
        self.assertEqual(len(Plant.objects.all()), 1)
        plant = Plant.objects.get(id=test_id)
        self.assertEqual(plant.name, 'test plant')
        self.assertEqual(plant.species, 'Giant Sequoia')
        self.assertEqual(plant.description, '300 feet and a few thousand years old')
        self.assertEqual(plant.pot_size, 4)
        # Confirm tray not created
        self.assertEqual(len(Tray.objects.all()), 0)

    def test_registration_tray(self):
        # Confirm no plants or trays in database
        self.assertEqual(len(Plant.objects.all()), 0)
        self.assertEqual(len(Tray.objects.all()), 0)

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
        self.assertEqual(len(Tray.objects.all()), 1)
        tray = Tray.objects.get(id=test_id)
        self.assertEqual(tray.name, 'test tray')
        self.assertEqual(tray.location, 'top shelf')
        # Confirm plant not created
        self.assertEqual(len(Plant.objects.all()), 0)

    def test_manage_new_plant(self):
        # Request management page for new plant, confirm register template renders
        response = self.client.get(f'/manage/{uuid4()}')
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'plant_tracker/register.html')

    def test_manage_existing_plant(self):
        # Create test plant
        test_id = uuid4()
        Plant.objects.create(id=test_id)

        # Request management page, confirm plant management template renders
        response = self.client.get(f'/manage/{test_id}')
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'plant_tracker/manage_plant.html')
        self.assertTemplateNotUsed(response, 'plant_tracker/manage_tray.html')

    def test_manage_existing_tray(self):
        # Create test tray with 1 plant
        tray_id = uuid4()
        plant_id = uuid4()
        tray = Tray.objects.create(id=tray_id)
        Plant.objects.create(id=plant_id, tray=tray)

        # Request management page, confirm tray management template renders
        response = self.client.get(f'/manage/{tray_id}')
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'plant_tracker/manage_tray.html')
        self.assertTemplateNotUsed(response, 'plant_tracker/manage_plant.html')

        # Confirm context includes tray, correct plant details
        self.assertEqual(response.context['tray'], tray)
        self.assertEqual(len(response.context['details']), 1)
        self.assertEqual(response.context['details'][plant_id]['name'], None)
        self.assertEqual(response.context['details'][plant_id]['last_watered'], None)
        self.assertEqual(response.context['details'][plant_id]['last_fertilized'], None)

    def test_edit_plant_details(self):
        # Create test plant with no name, confirm exists in database
        test_id = uuid4()
        Plant.objects.create(id=test_id)
        self.assertEqual(len(Plant.objects.all()), 1)
        self.assertIsNone(Plant.objects.all()[0].name)

        # Send edit details request, confirm redirects to manage page
        payload = {
            'plant_id': test_id,
            'name': 'test plant',
            'species': 'Giant Sequoia',
            'description': '300 feet and a few thousand years old',
            'pot_size': '4'
        }
        response = self.client.post('/edit_plant', payload)
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.url, f'/manage/{test_id}')

        # Confirm no additional plant created, confirm details now match
        self.assertEqual(len(Plant.objects.all()), 1)
        self.assertEqual(Plant.objects.all()[0].name, 'test plant')
        self.assertEqual(Plant.objects.all()[0].species, 'Giant Sequoia')

    def test_edit_tray_details(self):
        # Create test tray with no name, confirm exists in database
        test_id = uuid4()
        Tray.objects.create(id=test_id)
        self.assertEqual(len(Tray.objects.all()), 1)
        self.assertIsNone(Tray.objects.all()[0].name)

        # Send edit details request, confirm redirects to manage page
        payload = {
            'tray_id': test_id,
            'name': 'test tray',
            'location': 'middle shelf'
        }
        response = self.client.post('/edit_tray', payload)
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.url, f'/manage/{test_id}')

        # Confirm no additional plant created, confirm details now match
        self.assertEqual(len(Tray.objects.all()), 1)
        self.assertEqual(Tray.objects.all()[0].name, 'test tray')
        self.assertEqual(Tray.objects.all()[0].location, 'middle shelf')

    def test_water_plant(self):
        # Create test plant, confirm no water events
        plant = Plant.objects.create(id=uuid4())
        self.assertIsNone(plant.last_watered())
        self.assertEqual(len(WaterEvent.objects.all()), 0)

        payload = {
            'plant_id': plant.id,
            'timestamp': '2024-02-06T03:06:26.000Z'
        }

        # Send water request, confirm event created
        response = self.client.post('/water_plant', payload)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"action": "water", "plant": str(plant.id)})
        self.assertEqual(len(WaterEvent.objects.all()), 1)
        self.assertEqual(plant.last_watered(), '2024-02-06T03:06:26+00:00')

    def test_fertilize_plant(self):
        # Create test plant, confirm no fertilize events
        plant = Plant.objects.create(id=uuid4())
        self.assertIsNone(plant.last_fertilized())
        self.assertEqual(len(FertilizeEvent.objects.all()), 0)

        payload = {
            'plant_id': plant.id,
            'timestamp': '2024-02-06T03:06:26.000Z'
        }

        # Send water request, confirm event created
        response = self.client.post('/fertilize_plant', payload)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"action": "fertilize", "plant": str(plant.id)})
        self.assertEqual(len(FertilizeEvent.objects.all()), 1)
        self.assertEqual(plant.last_fertilized(), '2024-02-06T03:06:26+00:00')

    def test_add_plant_to_tray(self):
        # Create test tray and plant, confirm no relation
        tray = Tray.objects.create(id=uuid4())
        plant = Plant.objects.create(id=uuid4())
        self.assertIsNone(plant.tray)
        self.assertEqual(len(tray.plant_set.all()), 0)

        # Send add_plant_to_tray request, confirm relation created
        payload = {'plant_id': plant.id, 'tray_id': tray.id}
        response = self.client.post('/add_plant_to_tray', payload)
        self.assertEqual(response.status_code, 200)
        plant.refresh_from_db()
        self.assertEqual(plant.tray, tray)
        self.assertEqual(len(tray.plant_set.all()), 1)

    def test_remove_plant_from_tray(self):
        # Create test tray and plant with relation, confirm relation
        tray = Tray.objects.create(id=uuid4())
        plant = Plant.objects.create(id=uuid4(), tray=tray)
        self.assertEqual(plant.tray, tray)
        self.assertEqual(len(tray.plant_set.all()), 1)

        # Send add_plant_to_tray request, confirm relation created
        response = self.client.post('/remove_plant_from_tray', {'plant_id': plant.id})
        self.assertEqual(response.status_code, 200)
        plant.refresh_from_db()
        self.assertIsNone(plant.tray)
        self.assertEqual(len(tray.plant_set.all()), 0)

    def test_bulk_add_plants_to_tray(self):
        # Create test tray and 2 plants, confirm no relation
        tray = Tray.objects.create(id=uuid4())
        plant1 = Plant.objects.create(id=uuid4())
        plant2 = Plant.objects.create(id=uuid4())
        self.assertIsNone(plant1.tray)
        self.assertIsNone(plant2.tray)
        self.assertEqual(len(tray.plant_set.all()), 0)

        # Send bulk_add_plants_to_tray request with both IDs
        payload = {
            'tray_id': tray.id,
            'plants': [
                plant1.id,
                plant2.id
            ]
        }
        response = self.client.post('/bulk_add_plants_to_tray', payload)

        # Confirm page refreshed, confirm plants both have relation
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.url, f'/manage/{tray.id}')
        plant1.refresh_from_db()
        plant2.refresh_from_db()
        self.assertEqual(plant1.tray, tray)
        self.assertEqual(plant2.tray, tray)
        self.assertEqual(len(tray.plant_set.all()), 2)


class InvalidRequestTests(TestCase):
    def setUp(self):
        self.test_plant = Plant.objects.create(id=uuid4())
        self.test_tray = Tray.objects.create(id=uuid4())

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
        response = self.client.post(
            '/water_plant',
            {'plant_id': uuid4(), 'timestamp': '2024-02-06T03:06:26.000Z'},
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json(), {"error": "plant not found"})

    def test_missing_plant_id(self):
        # Send POST with no plant_id key in body, confirm error
        response = self.client.post(
            '/water_plant',
            {'timestamp': '2024-02-06T03:06:26.000Z'},
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"error": "POST body missing required 'plant_id' key"})

    def test_missing_tray_id(self):
        # Send POST with no tray_id key in body, confirm error
        response = self.client.post(
            '/water_tray',
            {'timestamp': '2024-02-06T03:06:26.000Z'},
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"error": "POST body missing required 'tray_id' key"})

    def test_invalid_plant_uuid(self):
        # Send POST with plant_id that is not a valid UUID, confirm error
        response = self.client.post(
            '/water_plant',
            {'plant_id': '31670857', 'timestamp': '2024-02-06T03:06:26.000Z'},
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"error": "plant_id key is not a valid UUID"})

    def test_invalid_tray_uuid(self):
        # Send POST with tray_id that is not a valid UUID, confirm error
        response = self.client.post(
            '/water_tray',
            {'tray_id': '31670857', 'timestamp': '2024-02-06T03:06:26.000Z'},
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"error": "tray_id key is not a valid UUID"})

    def test_missing_timestamp_key(self):
        # Send POST with no timestamp key in body, confirm error
        response = self.client.post(
            '/water_plant',
            {'plant_id': self.test_plant.id},
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"error": "POST body missing required 'timestamp' key"})

    def test_invalid_timestamp_format(self):
        # Send POST with invalid timestamp in body, confirm error
        response = self.client.post(
            '/water_plant',
            {'plant_id': self.test_plant.id, 'timestamp': '04:20'},
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"error": "timestamp format invalid"})


class TrayModelTests(TestCase):
    def setUp(self):
        # Create test tray
        self.test_tray = Tray.objects.create(id=uuid4(), name="Test tray")

        # Create 2 plants with relations to Tray and 1 without
        self.plant1 = Plant.objects.create(id=uuid4(), name="plant1", tray=self.test_tray)
        self.plant2 = Plant.objects.create(id=uuid4(), name="plant2", tray=self.test_tray)
        self.plant3 = Plant.objects.create(id=uuid4(), name="plant3")

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

    def test_water_tray_endpoint(self):
        # Confirm plants have no water events
        self.assertEqual(len(self.plant1.waterevent_set.all()), 0)
        self.assertEqual(len(self.plant2.waterevent_set.all()), 0)
        self.assertEqual(len(self.plant3.waterevent_set.all()), 0)

        # Send water_tray request
        payload = {
            'tray_id': self.test_tray.id,
            'timestamp': '2024-02-06T03:06:26.000Z'
        }
        response = self.client.post('/water_tray', payload)

        # Confirm response, confirm both plants in tray have water events, other plant does not
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"action": "water tray", "tray": str(self.test_tray.id)})
        self.assertEqual(len(self.plant1.waterevent_set.all()), 1)
        self.assertEqual(len(self.plant2.waterevent_set.all()), 1)
        self.assertEqual(len(self.plant3.waterevent_set.all()), 0)

    def test_fertilize_tray_endpoint(self):
        # Confirm plants have no fertilize events
        self.assertEqual(len(self.plant1.fertilizeevent_set.all()), 0)
        self.assertEqual(len(self.plant2.fertilizeevent_set.all()), 0)
        self.assertEqual(len(self.plant3.fertilizeevent_set.all()), 0)

        # Send fertilize_tray request
        payload = {
            'tray_id': self.test_tray.id,
            'timestamp': '2024-02-06T03:06:26.000Z'
        }
        response = self.client.post('/fertilize_tray', payload)

        # Confirm response, confirm both plants in tray have fertilize events, other plant does not
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"action": "fertilize tray", "tray": str(self.test_tray.id)})
        self.assertEqual(len(self.plant1.fertilizeevent_set.all()), 1)
        self.assertEqual(len(self.plant2.fertilizeevent_set.all()), 1)
        self.assertEqual(len(self.plant3.fertilizeevent_set.all()), 0)
