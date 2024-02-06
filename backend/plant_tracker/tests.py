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
        response = self.client.post('/delete_plant', {'uuid': str(test_id)})
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.url, '/')
        self.assertEqual(len(Plant.objects.all()), 0)

        # Attempt to delete non-existing plant, confirm error
        response = self.client.post('/delete_plant', {'uuid': str(test_id)})
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json(), {'error': 'plant not found'})


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

        # Request management page, confirm management template renders
        response = self.client.get(f'/manage/{test_id}')
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'plant_tracker/manage_plant.html')

    def test_edit_plant_details(self):
        # Create test plant with no name, confirm exists in database
        test_id = uuid4()
        Plant.objects.create(id=test_id)
        self.assertEqual(len(Plant.objects.all()), 1)
        self.assertIsNone(Plant.objects.all()[0].name)

        # Send edit details request, confirm redirects to manage page
        payload = {
            'uuid': test_id,
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
            'uuid': test_id,
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
            'uuid': plant.id,
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
            'uuid': plant.id,
            'timestamp': '2024-02-06T03:06:26.000Z'
        }

        # Send water request, confirm event created
        response = self.client.post('/fertilize_plant', payload)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"action": "fertilize", "plant": str(plant.id)})
        self.assertEqual(len(FertilizeEvent.objects.all()), 1)
        self.assertEqual(plant.last_fertilized(), '2024-02-06T03:06:26+00:00')


class InvalidRequestTests(TestCase):
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

    def test_invalid_uuid(self):
        # Send POST with UUID that does not exist in database, confirm error
        response = self.client.post(
            '/water_plant',
            {'uuid': uuid4(), 'timestamp': ''},
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json(), {"error": "plant not found"})


class TrayModelTests(TestCase):
    def setUp(self):
        # Create test tray
        self.test_tray = Tray.objects.create(id=uuid4(), name="Test tray")

        # Create 2 plants with relations to Tray and 1 without
        self.plant1 = Plant.objects.create(id=uuid4(), name="plant1", tray=self.test_tray)
        self.plant2 = Plant.objects.create(id=uuid4(), name="plant2", tray=self.test_tray)
        self.plant3 = Plant.objects.create(id=uuid4(), name="plant3")

    def test_water_all(self):
        # Confirm plants have no water events
        self.assertEqual(len(self.plant1.waterevent_set.all()), 0)
        self.assertEqual(len(self.plant2.waterevent_set.all()), 0)
        self.assertEqual(len(self.plant3.waterevent_set.all()), 0)

        # Call water_all, plants in tray should have water event, other plant should not
        self.test_tray.water_all()
        self.assertEqual(len(self.plant1.waterevent_set.all()), 1)
        self.assertEqual(len(self.plant2.waterevent_set.all()), 1)
        self.assertEqual(len(self.plant3.waterevent_set.all()), 0)

    def test_fertilize_all(self):
        # Confirm plants have no water events
        self.assertEqual(len(self.plant1.fertilizeevent_set.all()), 0)
        self.assertEqual(len(self.plant2.fertilizeevent_set.all()), 0)
        self.assertEqual(len(self.plant3.fertilizeevent_set.all()), 0)

        # Call water_all, plants in tray should have fertilize event, other plant should not
        self.test_tray.fertilize_all()
        self.assertEqual(len(self.plant1.fertilizeevent_set.all()), 1)
        self.assertEqual(len(self.plant2.fertilizeevent_set.all()), 1)
        self.assertEqual(len(self.plant3.fertilizeevent_set.all()), 0)
