# pylint: disable=missing-docstring

import json
from uuid import uuid4

from django.test import TestCase
from django.http import HttpResponse
from django.test.client import RequestFactory

from .models import Plant
from .view_decorators import (
    requires_json_post,
    get_default_user,
    get_plant_from_post_body,
    get_group_from_post_body,
    get_qr_instance_from_post_body,
    get_timestamp_from_post_body,
    get_event_type_from_post_body,
    clean_payload_data
)
from .unit_test_helpers import JSONClient


class CleanPayloadDataTests(TestCase):
    def setUp(self):
        # Decorate mock function so tests can see cleaned payload
        def passthrough(*, data):
            return data
        self.decorated = clean_payload_data(passthrough)

    def test_trims_leading_and_trailing_whitespace(self):
        cleaned = self.decorated(data={
            'name': '     test plant',
            'species': '  Spider Plant  ',
            'description': '\nNeeds bright light\t',
            'pot_size': '4'
        })
        self.assertEqual(cleaned['name'], 'test plant')
        self.assertEqual(cleaned['species'], 'Spider Plant')
        self.assertEqual(cleaned['description'], 'Needs bright light')
        self.assertEqual(cleaned['pot_size'], '4')

    def test_converts_empty_strings_to_none(self):
        cleaned = self.decorated(data={
            'name': '     ',
            'species': '',
            'description': '\n',
            'pot_size': '\t'
        })
        self.assertIsNone(cleaned['name'])
        self.assertIsNone(cleaned['species'])
        self.assertIsNone(cleaned['description'])
        self.assertIsNone(cleaned['pot_size'])

    def test_does_not_change_non_string_values(self):
        cleaned = self.decorated(data={
            'int_value': 7,
            'float_value': 12.5,
            'bool_value': True,
            'none_value': None,
            'list_value': ['item1', 'item2'],
            'dict_value': {'key': 'value'},
        })

        self.assertEqual(cleaned['int_value'], 7)
        self.assertEqual(cleaned['float_value'], 12.5)
        self.assertTrue(cleaned['bool_value'])
        self.assertIsNone(cleaned['none_value'])
        self.assertEqual(cleaned['list_value'], ['item1', 'item2'])
        self.assertEqual(cleaned['dict_value'], {'key': 'value'})


class ViewDecoratorErrorTests(TestCase):
    def setUp(self):
        # Create test plant to use in tests
        self.test_plant = Plant.objects.create(uuid=uuid4(), user=get_default_user())

        # Set default content_type for post requests (avoid long lines)
        self.client = JSONClient()

    def test_invalid_get_request(self):
        # Send GET request to endpoint with requires_json_post, confirm error
        response = self.client.get('/register_plant')
        self.assertEqual(response.status_code, 405)
        self.assertEqual(response.json(), {'error': 'must post data'})

    def test_invalid_post_body(self):
        # Send POST with non-JSON body to endpoint with requires_json_post
        # decorator, confirm error
        response = self.client.post(
            '/register_plant',
            f'uuid={uuid4()}&name=test&species=test&description=None&pot_size=4&type=plant',
            content_type='text/plain',
        )
        self.assertEqual(response.status_code, 405)
        self.assertEqual(response.json(), {'error': 'request body must be JSON'})

    def test_plant_uuid_does_not_exist(self):
        # Send POST with UUID that does not exist in database to endpoint with
        # get_plant_from_post_body decorator, confirm error
        response = self.client.post('/add_plant_event', {
            'plant_id': uuid4(),
            'event_type': 'water',
            'timestamp': '2024-02-06T03:06:26.000Z'
        })
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json(), {"error": "plant not found"})

    def test_group_uuid_does_not_exist(self):
        # Send POST with UUID that does not exist in database to endpoint with
        # get_group_from_post_body decorator, confirm error
        response = self.client.post('/bulk_add_plants_to_group', {
            'group_id': uuid4(),
            'plants': [uuid4()]
        })
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json(), {"error": "group not found"})

    def test_qr_instance_uuid_does_not_exist(self):
        # Send POST with UUID that does not exist in database to endpoint with
        # get_qr_instance_from_post_body decorator, confirm error
        response = self.client.post('/change_uuid', {
            'uuid': uuid4(),
            'new_id': uuid4()
        })
        self.assertEqual(response.status_code, 404)
        self.assertEqual(
            response.json(),
            {"error": "uuid does not match any plant or group"}
        )

    def test_missing_plant_id(self):
        # Send POST with no plant_id key in body to endpoint that requires
        # plant_id (requires_json_post decorator arg), confirm error
        response = self.client.post('/add_plant_event', {
            'event_type': 'water',
            'timestamp': '2024-02-06T03:06:26.000Z'
        })
        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.json(),
            {"error": "POST body missing required keys", "keys": ['plant_id']}
        )

    def test_missing_group_id(self):
        # Send POST with no group_id key in body to endpoint that requires
        # group_id (requires_json_post decorator arg), confirm error
        response = self.client.post('/add_plant_to_group', {'plant_id': '1'})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.json(),
            {"error": "POST body missing required keys", "keys": ['group_id']}
        )

    def test_invalid_plant_uuid(self):
        # Send POST with plant_id that is not a valid UUID to endpoint with
        # get_plant_from_post_body decorator, confirm error
        response = self.client.post('/add_plant_event', {
            'plant_id': '31670857',
            'event_type': 'water',
            'timestamp': '2024-02-06T03:06:26.000Z'
        })
        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.json(),
            {"error": "plant_id key is not a valid UUID"}
        )

    def test_invalid_group_uuid(self):
        # Send POST with group_id that is not a valid UUID to endpoint with
        # get_group_from_post_body decorator, confirm error
        response = self.client.post('/bulk_add_plants_to_group', {
            'group_id': '31670857',
            'plants': [uuid4()]
        })
        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.json(),
            {"error": "group_id key is not a valid UUID"}
        )

    def test_invalid_qr_instance_uuid(self):
        # Send POST with uuid that is not a valid UUID to endpoint with
        # get_qr_instance_from_post_body decorator, confirm error
        response = self.client.post('/change_uuid', {
            'uuid': '31670857',
            'new_id': uuid4()
        })
        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.json(),
            {"error": "uuid key is not a valid UUID"}
        )

    def test_missing_timestamp_key(self):
        # Send POST with no timestamp key in body to endpoint that requires
        # timestamp (requires_json_post decorator arg), confirm error
        response = self.client.post('/add_plant_event', {
            'plant_id': self.test_plant.uuid,
            'event_type': 'water'
        })
        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.json(),
            {"error": "POST body missing required keys", "keys": ['timestamp']}
        )

    def test_invalid_timestamp_format(self):
        # Send POST with invalid timestamp in body to endpoint with
        # get_timestamp_from_post_body decorator, confirm error
        response = self.client.post('/add_plant_event', {
            'plant_id': self.test_plant.uuid,
            'timestamp': '04:20',
            'event_type': 'water'
        })
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"error": "timestamp format invalid"})

    def test_missing_event_type_key(self):
        # Send POST with with no event_type in body to endpoint that requires
        # event_type (requires_json_post arg), confirm error
        response = self.client.post('/add_plant_event', {
            'plant_id': self.test_plant.uuid,
            'timestamp': '2024-02-06T03:06:26.000Z'
        })
        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.json(),
            {"error": "POST body missing required keys", "keys": ['event_type']}
        )

    def test_invalid_event_type(self):
        # Send POST with invalid event_type in body to endpoint with
        # get_event_type_from_post_body decorator, confirm error
        response = self.client.post('/add_plant_event', {
            'plant_id': self.test_plant.uuid,
            'timestamp': '2024-02-06T03:06:26.000Z',
            'event_type': 'juice'
        })
        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.json(),
            {"error": "invalid event_type, must be 'water', 'fertilize', 'prune', or 'repot'"}
        )


class FallbackErrorHandlingTests(TestCase):
    '''These error handling lines are redundant if required_keys arg is passed
    to requires_json_post, as it currently is for all views. However, they are
    kept for an extra layer of safety in case args are omitted from the list.
    '''

    def test_get_plant_from_post_body_missing_plant_id(self):
        @get_plant_from_post_body()
        def mock_view_function(**kwargs):
            pass

        # Call function with empty data dict, confirm correct error
        response = mock_view_function(data={})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            json.loads(response.content),
            {"error": "POST body missing required 'plant_id' key"}
        )

    def test_get_group_from_post_body_missing_group_id(self):
        @get_group_from_post_body()
        def mock_view_function(**kwargs):
            pass

        # Call function with empty data dict, confirm correct error
        response = mock_view_function(data={})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            json.loads(response.content),
            {"error": "POST body missing required 'group_id' key"}
        )

    def test_get_qr_instance_from_post_body_missing_uuid(self):
        @get_qr_instance_from_post_body()
        def mock_view_function(**kwargs):
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
        def mock_view_function(**kwargs):
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
        def mock_view_function(**kwargs):
            pass

        # Call function with empty data dict, confirm correct error
        response = mock_view_function(data={})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            json.loads(response.content),
            {"error": "POST body missing required 'event_type' key"}
        )


class UnusedBranchCoverageTests(TestCase):
    '''These tests provide full coverage for branches that are not currently
    used by any endpoint.
    '''

    def test_requires_json_post_no_required_keys(self):
        # Create mock function with no required JSON keys
        @requires_json_post()
        def mock_view_function(**kwargs):
            return HttpResponse(200)

        # Create mock POST request with arbitrary JSON data
        factory = RequestFactory()
        request = factory.post(
            '/mock_endpoint',
            json.dumps({'mock': 'data'}),
            content_type='application/json'
        )

        # Pass mock request to mock view, confirm decorator does not return error
        # pylint: disable-next=too-many-function-args
        response = mock_view_function(request)
        self.assertEqual(response.status_code, 200)

    def test_get_qr_instance_from_post_body_without_annotations(self):
        # Create mock function with annotate set to False
        @requires_json_post(['uuid'])
        @get_qr_instance_from_post_body(annotate=False)
        def mock_view_function(instance, **kwargs):
            return instance

        # Create test plant
        plant = Plant.objects.create(uuid=uuid4(), user=get_default_user())

        # Create mock POST request with plant UUID
        factory = RequestFactory()
        request = factory.post(
            '/mock_endpoint',
            json.dumps({'uuid': str(plant.uuid)}),
            content_type='application/json'
        )

        # Pass mock request to mock view, should return plant instance
        plant = mock_view_function(request)
        self.assertIsInstance(plant, Plant)

        # Confirm plant does not have attributes added by annotation
        self.assertFalse(hasattr(plant, 'last_watered_time'))
        self.assertFalse(hasattr(plant, 'last_fertilized_time'))
        self.assertFalse(hasattr(plant, 'last_photo_thumbnail'))
