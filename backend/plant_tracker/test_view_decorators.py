# pylint: disable=missing-docstring

import json
from uuid import uuid4

from django.conf import settings
from django.test import TestCase
from django.core.cache import cache
from django.http import HttpResponse
from django.contrib.auth.models import User
from django.test.client import RequestFactory, MULTIPART_CONTENT

from .models import Plant, Group
from .view_decorators import (
    requires_json_post,
    get_default_user,
    get_plant_from_post_body,
    get_group_from_post_body,
    get_qr_instance_from_post_body,
    get_timestamp_from_post_body,
    get_event_type_from_post_body
)
from .unit_test_helpers import JSONClient, create_mock_photo


class AuthenticationTests(TestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.test_user = User.objects.create_user(
            username='unittest',
            password='12345',
            first_name='Bob',
            last_name='Smith'
        )

    def setUp(self):
        # Set default content_type for post requests (avoid long lines)
        self.client = JSONClient()

    def tearDown(self):
        # Ensure user logged out between tests
        self.client.logout()

        # Revert back to SINGLE_USER_MODE
        settings.SINGLE_USER_MODE = True

    def test_overview_page(self):
        # Request overview while signed out, confirm page loads
        response = self.client.get('/')
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'plant_tracker/index.html')
        self.assertEqual(response.context['title'], 'Plant Overview')

        # Disable SINGLE_USER_MODE (require authentication)
        settings.SINGLE_USER_MODE = False

        # Request overview page, confirm redirected to login page
        response = self.client.get('/')
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.url, '/accounts/login/')

        # Sign user in
        self.client.login(username='unittest', password='12345')

        # Request overview while signed in, confirm page loads
        response = self.client.get('/')
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'plant_tracker/index.html')
        # Confirm title includes user's first name
        self.assertEqual(response.context['title'], "Bob's Plants")

    def test_manage_plant_page(self):
        # Create plant owned by test user
        plant = Plant.objects.create(uuid=uuid4(), user=self.test_user)

        # Request management page without signing in (will come from default
        # user since SINGLE_USER_MODE is enabled)
        response = self.client.get(f'/manage/{plant.uuid}')

        # Confirm rendered permission denied page, not manage plant
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.context['js_bundle'], 'plant_tracker/permission_denied.js')
        self.assertEqual(response.context['title'], 'Permission Denied')

    def test_manage_group_page(self):
        # Create group owned by test user
        group = Group.objects.create(uuid=uuid4(), user=self.test_user)

        # Request management page without signing in (will come from default
        # user since SINGLE_USER_MODE is enabled)
        response = self.client.get(f'/manage/{group.uuid}')

        # Confirm rendered permission denied page, not manage group
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.context['js_bundle'], 'plant_tracker/permission_denied.js')
        self.assertEqual(response.context['title'], 'Permission Denied')

    def test_endpoints_reject_requests_from_user_who_does_not_own_plant(self):
        # Create plant and group owned by test user (SINGLE_USER_MODE is
        # enabled, so requests will come from default user which doesn't own)
        plant = Plant.objects.create(uuid=uuid4(), user=self.test_user)
        group = Group.objects.create(uuid=uuid4(), user=self.test_user)

        # Confirm /change_qr_code returns 403, does not cache UUID
        response = self.client.post('/change_qr_code', {'uuid': str(plant.uuid)})
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json(), {"error": "instance is owned by a different user"})
        self.assertIsNone(cache.get(f'old_uuid_{get_default_user().pk}'))

        # Confirm /change_uuid returns 403
        response = self.client.post('/change_uuid', {
            'uuid': str(plant.uuid),
            'new_id': str(uuid4())
        })
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json(), {"error": "instance is owned by a different user"})

        # Confirm /edit_plant returns 403
        response = self.client.post('/edit_plant', {
            'plant_id': plant.uuid,
            'name': 'test plant    ',
            'species': '   Giant Sequoia',
            'description': '300 feet and a few thousand years old',
            'pot_size': '4'
        })
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json(), {"error": "plant is owned by a different user"})

        # Confirm /edit_group returns 403
        response = self.client.post('/edit_group', {
            'group_id': group.uuid,
            'name': 'test group    ',
            'location': '    middle shelf',
            'description': 'This group is used for propagation'
        })
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json(), {"error": "group is owned by a different user"})

        # Confirm /delete_plant returns 403
        response = self.client.post('/delete_plant', {'plant_id': str(plant.uuid)})
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json(), {"error": "plant is owned by a different user"})

        # Confirm /archive_plant returns 403
        response = self.client.post('/archive_plant', {'plant_id': str(plant.uuid), 'archived': True})
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json(), {"error": "plant is owned by a different user"})

        # Confirm /delete_group returns 403
        response = self.client.post('/delete_group', {'group_id': str(group.uuid)})
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json(), {"error": "group is owned by a different user"})

        # Confirm /archive_group returns 403
        response = self.client.post('/archive_group', {'group_id': str(group.uuid), 'archived': True})
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json(), {"error": "group is owned by a different user"})

        # Confirm /add_plant_event returns 403
        response = self.client.post('/add_plant_event', {
            'plant_id': plant.uuid,
            'event_type': 'water',
            'timestamp': '2024-02-06T03:06:26.000Z'
        })
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json(), {"error": "plant is owned by a different user"})

        # Confirm /bulk_add_plant_events returns 400 (does not indicate failure
        # reason but this is only to prevent malicious API calls, should not be
        # possible to make this request from the frontend)
        response = self.client.post('/bulk_add_plant_events', {
            'plants': [str(plant.uuid)],
            'event_type': 'water',
            'timestamp': '2024-02-06T03:06:26.000Z'
        })
        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.json(),
            {"action":"water","plants":[],"failed":[str(plant.uuid)]}
        )

        # Confirm /delete_plant_event returns 403
        response = self.client.post('/delete_plant_event', {
            'plant_id': plant.uuid,
            'event_type': 'water',
            'timestamp': '2024-02-06T03:06:26.000Z'
        })
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json(), {"error": "plant is owned by a different user"})

        # Confirm /bulk_delete_plant_events returns 403
        response = self.client.post('/bulk_delete_plant_events', {
            'plant_id': plant.uuid,
            'events': [{'type': 'water', 'timestamp': '2024-02-06T03:06:26.000Z'}]
        })
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json(), {"error": "plant is owned by a different user"})

        # Confirm /add_plant_note returns 403
        response = self.client.post('/add_plant_note', {
            'plant_id': plant.uuid,
            'timestamp': '2024-02-06T03:06:26.000Z',
            'note_text': '  plant is looking healthier than last week  '
        })
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json(), {"error": "plant is owned by a different user"})

        # Confirm /edit_plant_note returns 403
        response = self.client.post('/edit_plant_note', {
            'plant_id': plant.uuid,
            'timestamp': '2024-02-06T03:06:26.000Z',
            'note_text': '   This is the text I forgot to add   '
        })
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json(), {"error": "plant is owned by a different user"})

        # Confirm /delete_plant_note returns 403
        response = self.client.post('/delete_plant_note', {
            'plant_id': plant.uuid,
            'timestamp': '2024-02-06T03:06:26.000Z'
        })
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json(), {"error": "plant is owned by a different user"})

        # Confirm /add_plant_to_group returns 403
        response = self.client.post('/add_plant_to_group', {
            'plant_id': plant.uuid,
            'group_id': group.uuid
        })
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json(), {"error": "plant is owned by a different user"})

        # Confirm /remove_plant_from_group returns 403
        response = self.client.post('/remove_plant_from_group', {
            'plant_id': plant.uuid
        })
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json(), {"error": "plant is owned by a different user"})

        # Confirm /bulk_add_plants_to_group returns 403
        response = self.client.post('/bulk_add_plants_to_group', {
            'group_id': group.uuid,
            'plants': [plant.uuid]
        })
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json(), {"error": "group is owned by a different user"})

        # Confirm /bulk_remove_plants_from_group returns 403
        response = self.client.post('/bulk_remove_plants_from_group', {
            'group_id': group.uuid,
            'plants': [plant.uuid]
        })
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json(), {"error": "group is owned by a different user"})

        # Confirm /repot_plant returns 403
        response = self.client.post('/repot_plant', {
            'plant_id': plant.uuid,
            'timestamp': '2024-02-06T03:06:26.000Z',
            'new_pot_size': 6
        })
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json(), {"error": "plant is owned by a different user"})

        # Confirm /add_plant_photos returns 403
        response = self.client.post(
            '/add_plant_photos',
            data={
                'plant_id': str(plant.uuid),
                'photo_0': create_mock_photo('2024:03:22 10:52:03')
            },
            content_type=MULTIPART_CONTENT
        )
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json(), {"error": "plant is owned by a different user"})

        # Confirm /delete_plant_photos returns 403
        response = self.client.post('/delete_plant_photos', {
            'plant_id': str(plant.uuid),
            'delete_photos': [1]
        })
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json(), {"error": "plant is owned by a different user"})

        # Confirm /set_plant_default_photo returns 403
        response = self.client.post('/set_plant_default_photo', {
            'plant_id': str(plant.uuid),
            'photo_key': 1
        })
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json(), {"error": "plant is owned by a different user"})

    def test_endpoints_redirect_to_login_if_user_not_signed_in(self):
        # Create plant and group owned by test user
        plant = Plant.objects.create(uuid=uuid4(), user=self.test_user)
        group = Group.objects.create(uuid=uuid4(), user=self.test_user)

        # Disable SINGLE_USER_MODE (require authentication)
        settings.SINGLE_USER_MODE = False

        # Confirm /change_qr_code returns 401, does not cache UUID
        response = self.client.post('/change_qr_code', {'uuid': str(plant.uuid)})
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json(), {"error": "authentication required"})
        self.assertIsNone(cache.get(f'old_uuid_{get_default_user().pk}'))

        # Confirm /change_uuid returns 401
        response = self.client.post('/change_uuid', {
            'uuid': str(plant.uuid),
            'new_id': str(uuid4())
        })
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json(), {"error": "authentication required"})

        # Confirm /edit_plant returns 401
        response = self.client.post('/edit_plant', {
            'plant_id': plant.uuid,
            'name': 'test plant    ',
            'species': '   Giant Sequoia',
            'description': '300 feet and a few thousand years old',
            'pot_size': '4'
        })
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json(), {"error": "authentication required"})

        # Confirm /edit_group returns 401
        response = self.client.post('/edit_group', {
            'group_id': group.uuid,
            'name': 'test group    ',
            'location': '    middle shelf',
            'description': 'This group is used for propagation'
        })
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json(), {"error": "authentication required"})

        # Confirm /delete_plant returns 401
        response = self.client.post('/delete_plant', {'plant_id': str(plant.uuid)})
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json(), {"error": "authentication required"})

        # Confirm /archive_plant returns 401
        response = self.client.post('/archive_plant', {'plant_id': str(plant.uuid), 'archived': True})
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json(), {"error": "authentication required"})

        # Confirm /delete_group returns 401
        response = self.client.post('/delete_group', {'group_id': str(group.uuid)})
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json(), {"error": "authentication required"})

        # Confirm /archive_group returns 401
        response = self.client.post('/archive_group', {'group_id': str(group.uuid), 'archived': True})
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json(), {"error": "authentication required"})

        # Confirm /add_plant_event returns 401
        response = self.client.post('/add_plant_event', {
            'plant_id': plant.uuid,
            'event_type': 'water',
            'timestamp': '2024-02-06T03:06:26.000Z'
        })
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json(), {"error": "authentication required"})

        # Confirm /bulk_add_plant_events returns 401
        response = self.client.post('/bulk_add_plant_events', {
            'plants': [str(plant.uuid)],
            'event_type': 'water',
            'timestamp': '2024-02-06T03:06:26.000Z'
        })
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json(), {"error": "authentication required"})

        # Confirm /delete_plant_event returns 401
        response = self.client.post('/delete_plant_event', {
            'plant_id': plant.uuid,
            'event_type': 'water',
            'timestamp': '2024-02-06T03:06:26.000Z'
        })
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json(), {"error": "authentication required"})

        # Confirm /bulk_delete_plant_events returns 401
        response = self.client.post('/bulk_delete_plant_events', {
            'plant_id': plant.uuid,
            'events': [{'type': 'water', 'timestamp': '2024-02-06T03:06:26.000Z'}]
        })
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json(), {"error": "authentication required"})

        # Confirm /add_plant_note returns 401
        response = self.client.post('/add_plant_note', {
            'plant_id': plant.uuid,
            'timestamp': '2024-02-06T03:06:26.000Z',
            'note_text': '  plant is looking healthier than last week  '
        })
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json(), {"error": "authentication required"})

        # Confirm /edit_plant_note returns 401
        response = self.client.post('/edit_plant_note', {
            'plant_id': plant.uuid,
            'timestamp': '2024-02-06T03:06:26.000Z',
            'note_text': '   This is the text I forgot to add   '
        })
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json(), {"error": "authentication required"})

        # Confirm /delete_plant_note returns 401
        response = self.client.post('/delete_plant_note', {
            'plant_id': plant.uuid,
            'timestamp': '2024-02-06T03:06:26.000Z'
        })
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json(), {"error": "authentication required"})

        # Confirm /add_plant_to_group returns 401
        response = self.client.post('/add_plant_to_group', {
            'plant_id': plant.uuid,
            'group_id': group.uuid
        })
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json(), {"error": "authentication required"})

        # Confirm /remove_plant_from_group returns 401
        response = self.client.post('/remove_plant_from_group', {
            'plant_id': plant.uuid
        })
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json(), {"error": "authentication required"})

        # Confirm /bulk_add_plants_to_group returns 401
        response = self.client.post('/bulk_add_plants_to_group', {
            'group_id': group.uuid,
            'plants': [plant.uuid]
        })
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json(), {"error": "authentication required"})

        # Confirm /bulk_remove_plants_from_group returns 401
        response = self.client.post('/bulk_remove_plants_from_group', {
            'group_id': group.uuid,
            'plants': [plant.uuid]
        })
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json(), {"error": "authentication required"})

        # Confirm /repot_plant returns 401
        response = self.client.post('/repot_plant', {
            'plant_id': plant.uuid,
            'timestamp': '2024-02-06T03:06:26.000Z',
            'new_pot_size': 6
        })
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json(), {"error": "authentication required"})

        # Confirm /add_plant_photos returns 401
        response = self.client.post(
            '/add_plant_photos',
            data={
                'plant_id': str(plant.uuid),
                'photo_0': create_mock_photo('2024:03:22 10:52:03')
            },
            content_type=MULTIPART_CONTENT
        )
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json(), {"error": "authentication required"})

        # Confirm /delete_plant_photos returns 401
        response = self.client.post('/delete_plant_photos', {
            'plant_id': str(plant.uuid),
            'delete_photos': [1]
        })
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json(), {"error": "authentication required"})

        # Confirm /set_plant_default_photo returns 401
        response = self.client.post('/set_plant_default_photo', {
            'plant_id': str(plant.uuid),
            'photo_key': 1
        })
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json(), {"error": "authentication required"})


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
        response = self.client.post('/delete_plant', {'plant_id': uuid4()})
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json(), {"error": "plant not found"})

    def test_qr_instance_uuid_does_not_exist(self):
        # Send POST with UUID that does not exist in database to endpoint with
        # get_qr_instance_from_post_body decorator, confirm error
        response = self.client.post('/change_qr_code', {'uuid': uuid4()})
        self.assertEqual(response.status_code, 404)
        self.assertEqual(
            response.json(),
            {"error": "uuid does not match any plant or group"}
        )

    def test_missing_plant_id(self):
        # Send POST with no plant_id key in body to endpoint that requires
        # plant_id (requires_json_post decorator arg), confirm error
        response = self.client.post('/delete_plant', {
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
        response = self.client.post('/delete_group')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.json(),
            {"error": "POST body missing required keys", "keys": ['group_id']}
        )

    def test_invalid_plant_uuid(self):
        # Send POST with plant_id that is not a valid UUID to endpoint with
        # get_plant_from_post_body decorator, confirm error
        response = self.client.post('/delete_plant', {'plant_id': '31670857'})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.json(),
            {"error": "plant_id key is not a valid UUID"}
        )

    def test_invalid_group_uuid(self):
        # Send POST with group_id that is not a valid UUID to endpoint with
        # get_group_from_post_body decorator, confirm error
        response = self.client.post('/delete_group', {'group_id': '31670857'})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.json(),
            {"error": "group_id key is not a valid UUID"}
        )

    def test_invalid_qr_instance_uuid(self):
        # Send POST with uuid that is not a valid UUID to endpoint with
        # get_qr_instance_from_post_body decorator, confirm error
        response = self.client.post('/change_qr_code', {'uuid': '31670857'})
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
        @get_plant_from_post_body
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
        @get_group_from_post_body
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
        @get_qr_instance_from_post_body
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
