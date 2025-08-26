# pylint: disable=missing-docstring,too-many-lines,R0801,global-statement

import os
import base64
from uuid import uuid4
from datetime import datetime
from unittest.mock import patch

from django.conf import settings
from django.test import TestCase
from django.utils import timezone
from django.core.cache import cache
from django.contrib.auth import get_user_model
from django.test.client import MULTIPART_CONTENT
from PIL import UnidentifiedImageError

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
from .unit_test_helpers import (
    JSONClient,
    create_mock_photo,
    enable_isolated_media_root,
    cleanup_isolated_media_root,
)

user_model = get_user_model()

OVERRIDE = None
MODULE_MEDIA_ROOT = None


def setUpModule():
    global OVERRIDE, MODULE_MEDIA_ROOT
    OVERRIDE, MODULE_MEDIA_ROOT = enable_isolated_media_root()


def tearDownModule():
    # Delete mock photo directory after tests
    print("\nDeleting mock photos...\n")
    cleanup_isolated_media_root(OVERRIDE, MODULE_MEDIA_ROOT)


class OverviewTests(TestCase):
    def setUp(self):
        # Clear entire cache before each test
        cache.clear()

        # Set default content_type for post requests (avoid long lines)
        self.client = JSONClient()

    def test_overview_page(self):
        # Request overview, confirm returns SPA
        response = self.client.get('/')
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'plant_tracker/index.html')

    def test_overview_page_cached_state(self):
        # Cache arbitrary string as overview_state
        cache.set(f'overview_state_{get_default_user().pk}', {'state': 'cached'})

        # Mock build_overview_state to return a different string
        # pylint: disable-next=line-too-long
        with patch('plant_tracker.build_states.build_overview_state', return_value={'state': 'built'}):
            # Request overview state, confirm state was loaded from cache
            response = self.client.get('/get_overview_state')
            self.assertEqual(response.json(), {'state': 'cached'})

        # Delete cached overview__state
        cache.delete(f'overview_state_{get_default_user().pk}')

        # Mock build_overview_state to return a different string
        # pylint: disable-next=line-too-long
        with patch('plant_tracker.build_states.build_overview_state', return_value={'state': 'built'}):
            # Request overview state, confirm was built by calling mocked
            # function (failed to load from cache)
            response = self.client.get('/get_overview_state')
            self.assertEqual(response.json(), {'state': 'built'})

    def test_get_overview_state_no_database_entries(self):
        # Call get_overview_state endpoint, confirm returns overview state
        response = self.client.get('/get_overview_state')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {
                'plants': {},
                'groups': {},
                'show_archive': False,
                'title': 'Plant Overview'
            }
        )

    def test_get_overview_state_with_database_entries(self):
        # Create test group and 2 test plants
        default_user = get_default_user()
        group = Group.objects.create(
            uuid=uuid4(),
            user=default_user
        )
        plant1 = Plant.objects.create(
            uuid=uuid4(),
            name='Test plant',
            user=default_user
        )
        plant2 = Plant.objects.create(
            uuid=uuid4(),
            species='fittonia',
            user=default_user,
            group=group
        )

        # Create archived group and archived plant (should not be in context)
        Plant.objects.create(
            uuid=uuid4(),
            name='Archived plant',
            user=default_user,
            archived=True
        )
        Group.objects.create(
            uuid=uuid4(),
            name='Archived group',
            user=default_user,
            archived=True
        )

        # Clear cache (plant post_save does not update number of plants in group)
        cache.clear()

        # Request overview state, confirm contains details of all non-archived
        # plants and groups, does not contain archived plant and group
        response = self.client.get('/get_overview_state')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {
                'plants': {
                    str(plant1.uuid): {
                        'uuid': str(plant1.uuid),
                        'created': plant1.created.isoformat(),
                        'archived': False,
                        'name': 'Test plant',
                        'display_name': 'Test plant',
                        'species': None,
                        'thumbnail': None,
                        'description': None,
                        'pot_size': None,
                        'last_watered': None,
                        'last_fertilized': None,
                        'group': None
                    },
                    str(plant2.uuid): {
                        'uuid': str(plant2.uuid),
                        'created': plant2.created.isoformat(),
                        'archived': False,
                        'name': None,
                        'display_name': 'Unnamed fittonia',
                        'species': 'fittonia',
                        'thumbnail': None,
                        'description': None,
                        'pot_size': None,
                        'last_watered': None,
                        'last_fertilized': None,
                        'group': {
                            'name': 'Unnamed group 1',
                            'uuid': str(group.uuid)
                        }
                    }
                },
                'groups': {
                    str(group.uuid): {
                        'uuid': str(group.uuid),
                        'created': group.created.isoformat(),
                        'archived': False,
                        'name': None,
                        'display_name': 'Unnamed group 1',
                        'location': None,
                        'description': None,
                        'plants': 1
                    }
                },
                'show_archive': True,
                'title': 'Plant Overview'
            }
        )

    def test_get_qr_codes(self):
        # Mock URL_PREFIX env var
        settings.URL_PREFIX = 'mysite.com'
        # Send request, confirm response contains base64 string
        response = self.client.post('/get_qr_codes', {'qr_per_row': 8})
        self.assertEqual(response.status_code, 200)
        try:
            base64.b64decode(response.json()['qr_codes'], validate=True)
        # pylint: disable-next=bare-except
        except:  # noqa
            self.fail('Failed to decode base64 string returned by /get_qr_codes')

    def test_get_qr_codes_with_long_url(self):
        # Mock URL_PREFIX env var with a very long URL
        settings.URL_PREFIX = 'planttracker.several.more.subdomains.mysite.com'
        # Send request, confirm response contains base64 string
        response = self.client.post('/get_qr_codes', {'qr_per_row': 8})
        self.assertEqual(response.status_code, 200)
        try:
            base64.b64decode(response.json()['qr_codes'], validate=True)
        # pylint: disable-next=bare-except
        except:  # noqa
            self.fail('Failed to decode base64 string returned by /get_qr_codes')

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
        # pylint: disable-next=line-too-long
        settings.URL_PREFIX = 'https://excessive.number.of.extremely.long.repeating.subdomains.excessive.number.of.extremely.long.repeating.subdomains.excessive.number.of.extremely.long.repeating.subdomains.excessive.number.of.extremely.long.repeating.subdomains.excessive.number.of.extremely.long.repeating.subdomains.longdomainname.com/'  # noqa

        # Send request with qr_per_row = 25 (worst case), confirm correct error
        response = self.client.post('/get_qr_codes', {'qr_per_row': 25})
        self.assertEqual(response.status_code, 500)
        self.assertEqual(
            response.json(),
            {'error': 'failed to generate, try a shorter URL_PREFIX'}
        )

    def test_bulk_delete_plants_and_groups(self):
        # Create test plant and group, confirm both exist in database
        plant_id = uuid4()
        group_id = uuid4()
        default_user = get_default_user()
        Plant.objects.create(uuid=plant_id, name='test plant', user=default_user)
        Group.objects.create(uuid=group_id, name='test group', user=default_user)
        self.assertEqual(len(Plant.objects.all()), 1)
        self.assertEqual(len(Group.objects.all()), 1)

        # Post both UUIDs to /bulk_delete_plants_and_groups
        response = self.client.post('/bulk_delete_plants_and_groups', {
            'uuids': [
                str(plant_id),
                str(group_id)
            ]
        })

        # Confirm response, confirm removed from database
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {'deleted': [str(plant_id), str(group_id)], 'failed': []}
        )
        self.assertEqual(len(Plant.objects.all()), 0)
        self.assertEqual(len(Group.objects.all()), 0)

        # Create plant owned by a different user
        user = user_model.objects.create_user(username='unittest', password='12345')
        plant = Plant.objects.create(user=user, uuid=uuid4())

        # Attempt to delete plant owned by a different user, confirm error
        response = self.client.post('/bulk_delete_plants_and_groups', {
            'uuids': [str(plant.uuid)]
        })
        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.json(),
            {'deleted': [], 'failed': [str(plant.uuid)]}
        )

    def test_bulk_archive_plants_and_groups(self):
        # Create test plant and group, confirm both exist in database and are not archived
        plant_id = uuid4()
        group_id = uuid4()
        default_user = get_default_user()
        Plant.objects.create(uuid=plant_id, name='test plant', user=default_user)
        Group.objects.create(uuid=group_id, name='test group', user=default_user)
        self.assertEqual(len(Plant.objects.all()), 1)
        self.assertEqual(len(Group.objects.all()), 1)
        self.assertFalse(Plant.objects.all()[0].archived)
        self.assertFalse(Group.objects.all()[0].archived)

        # Post both UUIDs to /bulk_archive_plants_and_groups
        response = self.client.post('/bulk_archive_plants_and_groups', {
            'uuids': [
                str(plant_id),
                str(group_id)
            ],
            'archived': True
        })

        # Confirm response, confirm still in database but archived is True
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {'archived': [str(plant_id), str(group_id)], 'failed': []}
        )
        self.assertEqual(len(Plant.objects.all()), 1)
        self.assertEqual(len(Group.objects.all()), 1)
        self.assertTrue(Plant.objects.all()[0].archived)
        self.assertTrue(Group.objects.all()[0].archived)

        # Create plant owned by a different user
        user = user_model.objects.create_user(username='unittest', password='12345')
        plant = Plant.objects.create(user=user, uuid=uuid4())

        # Attempt to archive plant owned by a different user, confirm error
        response = self.client.post('/bulk_archive_plants_and_groups', {
            'uuids': [str(plant.uuid)],
            'archived': True
        })
        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.json(),
            {'archived': [], 'failed': [str(plant.uuid)]}
        )


class ArchivedOverviewTests(TestCase):
    def setUp(self):
        # Clear entire cache before each test
        cache.clear()

        # Set default content_type for post requests (avoid long lines)
        self.client = JSONClient()

    def test_archived_overview_page_no_database_entries(self):
        # Request archived overview when no archived plants or groups exist
        response = self.client.get('/archived')

        # Request archive overview, confirm uses correct template and title
        # (get_archived_overview_state response will redirect to permission denied)
        response = self.client.get('/archived')
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'plant_tracker/index.html')

    def test_archived_overview_page_with_database_entries(self):
        # Create test group (archived)
        default_user = get_default_user()
        Group.objects.create(uuid=uuid4(), user=default_user, archived=True)

        # Request archive overview, confirm uses correct template and title
        response = self.client.get('/archived')
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'plant_tracker/index.html')


    def test_get_archived_overview_state_no_database_entries(self):
        # Request archived overview state when no archived plants or groups exist
        response = self.client.get('/get_archived_overview_state')
        # Confirm redirected to main overview
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.json(), {'redirect': '/'})

    def test_get_archived_overview_state_with_database_entries(self):
        # Create test group and 2 test plants (should NOT be in context)
        default_user = get_default_user()
        Group.objects.create(uuid=uuid4(), user=default_user)
        Plant.objects.create(uuid=uuid4(), name='Test plant', user=default_user)
        Plant.objects.create(uuid=uuid4(), species='fittonia', user=default_user)

        # Create archived group and archived plant (SHOULD be in context)
        plant = Plant.objects.create(
            uuid=uuid4(),
            name='Archived plant',
            user=default_user,
            archived=True
        )
        group = Group.objects.create(
            uuid=uuid4(),
            name='Archived group',
            user=default_user,
            archived=True
        )

        # Request archive overview state, confirm state object has details of all
        # archived plants and groups, does not contain non-archived plant and group
        response = self.client.get('/get_archived_overview_state')
        self.assertEqual(response.json(), {
            'plants': {
                str(plant.uuid): {
                    'uuid': str(plant.uuid),
                    'created': plant.created.isoformat(),
                    'archived': True,
                    'name': 'Archived plant',
                    'display_name': 'Archived plant',
                    'species': None,
                    'thumbnail': None,
                    'description': None,
                    'pot_size': None,
                    'last_watered': None,
                    'last_fertilized': None,
                    'group': None
                }
            },
            'groups': {
                str(group.uuid): {
                    'uuid': str(group.uuid),
                    'created': group.created.isoformat(),
                    'archived': True,
                    'name': 'Archived group',
                    'display_name': 'Archived group',
                    'location': None,
                    'description': None,
                    'plants': 0
                }
            },
            'show_archive': True,
            'title': 'Archived'
        })


class RegistrationTests(TestCase):
    def setUp(self):
        # Clear entire cache before each test
        cache.clear()

        # Set default content_type for post requests (avoid long lines)
        self.client = JSONClient()

        self.default_user = get_default_user()

    def test_register_plant_endpoint(self):
        # Confirm no plants or groups in database
        self.assertEqual(len(Plant.objects.all()), 0)
        self.assertEqual(len(Group.objects.all()), 0)

        # Send plant registration request with extra spaces on some params
        test_id = uuid4()
        response = self.client.post('/register_plant', {
            'uuid': test_id,
            'name': '     test plant',
            'species': 'Giant Sequoia    ',
            'description': '300 feet and a few thousand years old',
            'pot_size': '4'
        })

        # Confirm response redirects to management page for new plant
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'success': 'plant registered'})

        # Confirm new plant exists in database, confirm no group was created
        self.assertEqual(len(Plant.objects.all()), 1)
        self.assertEqual(len(Group.objects.all()), 0)
        # Confirm no repot event was created (not divided from existing plant)
        self.assertEqual(len(RepotEvent.objects.all()), 0)

        # Confirm plant has correct params, confirm extra spaces were removed
        plant = Plant.objects.get(uuid=test_id)
        self.assertEqual(plant.name, 'test plant')
        self.assertEqual(plant.species, 'Giant Sequoia')
        self.assertEqual(plant.description, '300 feet and a few thousand years old')
        self.assertEqual(plant.pot_size, 4)
        # Confirm plant is owned by default user
        self.assertEqual(plant.user, self.default_user)

        # Confirm plant was not divided from another plant
        self.assertIsNone(plant.divided_from)
        self.assertIsNone(plant.divided_from_event)

    def test_register_plant_divided_from_existing_plant(self):
        # Create existing plant to divide from
        existing_plant = Plant.objects.create(
            user=self.default_user,
            uuid=uuid4(),
            pot_size=8
        )
        self.assertEqual(len(Plant.objects.all()), 1)
        self.assertEqual(len(RepotEvent.objects.all()), 0)

        # Simulate division in progress (user hit /divide_plant endpoint)
        division_event = DivisionEvent.objects.create(
            plant=existing_plant,
            timestamp=timezone.now()
        )
        cache.set(f'division_in_progress_{self.default_user.pk}', {
            'divided_from_plant_uuid': str(existing_plant.uuid),
            'division_event_key': str(division_event.pk)
        }, 900)

        # Send plant registration request with id of existing plant + event
        test_id = uuid4()
        response = self.client.post('/register_plant', {
            'uuid': test_id,
            'name': 'Geoppertia prop',
            'species': 'Geoppertia Warszewiczii',
            'description': 'Divided from mature plant',
            'pot_size': '4',
            'divided_from_id': str(existing_plant.pk),
            'divided_from_event_id': str(division_event.pk)
        })

        # Confirm response redirects to management page for new plant
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'success': 'plant registered'})

        # Confirm new plant was created, has reverse relation to original plant
        # and DivisionEvent
        self.assertEqual(len(Plant.objects.all()), 2)
        new_plant = Plant.objects.get(name='Geoppertia prop')
        self.assertEqual(new_plant.divided_from, existing_plant)
        self.assertEqual(new_plant.divided_from_event, division_event)

        # Confirm new plant is in existing_plant children queryset
        self.assertIn(new_plant, existing_plant.children.all())

        # Confirm RepotEvent was created for new plant with same timestamp
        self.assertEqual(len(RepotEvent.objects.all()), 1)
        repot = RepotEvent.objects.all().first()
        self.assertEqual(repot.timestamp, new_plant.created)
        # Confirm RepotEvent has parent pot size for old, child pot size for new
        self.assertEqual(repot.old_pot_size, 8)
        self.assertEqual(repot.new_pot_size, 4)

    def test_register_unrelated_plant_while_division_in_progress(self):
        # Create existing plant, simulate division in progress
        existing_plant = Plant.objects.create(user=self.default_user, uuid=uuid4())
        self.assertEqual(len(Plant.objects.all()), 1)
        division_event = DivisionEvent.objects.create(
            plant=existing_plant,
            timestamp=timezone.now()
        )
        cache.set(f'division_in_progress_{self.default_user.pk}', {
            'divided_from_plant_uuid': str(existing_plant.uuid),
            'division_event_key': str(division_event.pk)
        }, 900)

        # Send plant registration request WITHOUT existing plant id (user
        # clicked no at confirmation screen asking if new plant was divided)
        test_id = uuid4()
        response = self.client.post('/register_plant', {
            'uuid': test_id,
            'name': 'Geoppertia prop',
            'species': 'Geoppertia Warszewiczii',
            'description': 'Divided from mature plant',
            'pot_size': '4'
        })

        # Confirm response redirects to management page for new plant
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'success': 'plant registered'})

        # Confirm new plant was created, does NOT have reverse relation to
        # original plant or DivisionEvent
        self.assertEqual(len(Plant.objects.all()), 2)
        new_plant = Plant.objects.get(name='Geoppertia prop')
        self.assertIsNone(new_plant.divided_from)
        self.assertIsNone(new_plant.divided_from_event)
        # Confirm no repot event was created (not divided from existing plant)
        self.assertEqual(len(RepotEvent.objects.all()), 0)

    def test_register_group_endpoint(self):
        # Confirm no plants or groups in database
        self.assertEqual(len(Plant.objects.all()), 0)
        self.assertEqual(len(Group.objects.all()), 0)

        # Send plant registration request with extra spaces on some params
        test_id = uuid4()
        response = self.client.post('/register_group', {
            'uuid': test_id,
            'name': '    test group',
            'location': 'top shelf    ',
            'description': 'This group is used for propagation'
        })

        # Confirm response redirects to management page for new group
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'success': 'group registered'})

        # Confirm new group exists in database, confirm no plant was created
        self.assertEqual(len(Group.objects.all()), 1)
        self.assertEqual(len(Plant.objects.all()), 0)

        # Confirm group has correct params, confirm extra spaces were removed
        group = Group.objects.get(uuid=test_id)
        self.assertEqual(group.name, 'test group')
        self.assertEqual(group.location, 'top shelf')
        self.assertEqual(group.description, 'This group is used for propagation')
        # Confirm group is owned by default user
        self.assertEqual(group.user, self.default_user)

    def test_registration_page(self):
        # Request management page with uuid that doesn't exist in database
        response = self.client.get(f'/manage/{uuid4()}')

        # Confirm returned SPA
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'plant_tracker/index.html')

        # Request state
        response = self.client.get_json(f'/get_manage_state/{uuid4()}')
        self.assertEqual(response.status_code, 200)
        state = response.json()['state']

        # Confirm does not contain details of plant being divided (cache not set)
        self.assertNotIn('dividing_from', state.keys())

    def test_registration_page_division_in_progress(self):
        # Create Plant + DivisionEvent, simulate division in progress
        existing_plant = Plant.objects.create(user=self.default_user, uuid=uuid4())
        division_event = DivisionEvent.objects.create(
            plant=existing_plant,
            timestamp=timezone.now()
        )
        cache.set(f'division_in_progress_{self.default_user.pk}', {
            'divided_from_plant_uuid': str(existing_plant.uuid),
            'division_event_key': str(division_event.pk)
        }, 900)

        # Request management page with uuid that doesn't exist in database
        response = self.client.get(f'/manage/{uuid4()}')

        # Confirm returned SPA
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'plant_tracker/index.html')

        # Request state
        response = self.client.get_json(f'/get_manage_state/{uuid4()}')
        self.assertEqual(response.status_code, 200)
        state = response.json()['state']

        # Confirm context contains details of plant being divided from
        self.assertEqual(state['dividing_from'], {
            'plant_details': existing_plant.get_details(),
            'default_photo': existing_plant.get_default_photo_details(),
            'plant_key': str(existing_plant.pk),
            'event_key': str(division_event.pk)
        })

    def test_plant_fields_max_length(self):
        # Send plant registration request name longer than 50 characters
        response = self.client.post('/register_plant', {
            'uuid': uuid4(),
            'name': 'this name is longer than the fifty character length limit',
            'species': '',
            'description': '',
            'pot_size': ''
        })

        # Confirm rejected with correct error message
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {'error': {
            'name': ["Ensure this value has at most 50 characters (it has 57)."]
        }})

        # Send plant registration request species longer than 50 characters
        response = self.client.post('/register_plant', {
            'uuid': uuid4(),
            'name': 'this name is longer than the fifty character limit',
            'species': 'this species is longer than the fifty character limit',
            'description': '',
            'pot_size': ''
        })

        # Confirm rejected with correct error message
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {'error': {
            'species': ["Ensure this value has at most 50 characters (it has 53)."]
        }})

        # Send plant registration request description longer than 500 characters
        response = self.client.post('/register_plant', {
            'uuid': uuid4(),
            'name': '',
            'species': '',
            # pylint: disable-next=line-too-long
            'description': 'this is a very excessively long description that uses a large variety of completely unnecessary filler words that add no information to the description and serve no purpose other than to make the length of the description exceed the maximum allowed length for a description, which is five hundred characters. Descriptions longer than five hundred characters are not allowed because it is completely, totally, unnecessarily long and will potentially create layout issues in various places on the frontend.',
            'pot_size': ''
        })

        # Confirm rejected with correct error message
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {'error': {
            'description': ["Ensure this value has at most 500 characters (it has 504)."]
        }})

        # Confirm no plants were added to database
        self.assertEqual(len(Plant.objects.all()), 0)

    def test_group_fields_max_length(self):
        # Send group registration request name longer than 50 characters
        response = self.client.post('/register_group', {
            'uuid': uuid4(),
            'name': 'this name is longer than the fifty character length limit',
            'location': '',
            'description': ''
        })

        # Confirm rejected with correct error message
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {'error': {
            'name': ["Ensure this value has at most 50 characters (it has 57)."]
        }})

        # Send group registration request species longer than 50 characters
        response = self.client.post('/register_group', {
            'uuid': uuid4(),
            'name': '',
            'location': 'this location is longer than the fifty character limit',
            'description': ''
        })

        # Confirm rejected with correct error message
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {'error': {
            'location': ["Ensure this value has at most 50 characters (it has 54)."]
        }})

        # Send group registration request description longer than 500 characters
        response = self.client.post('/register_group', {
            'uuid': uuid4(),
            'name': '',
            'location': '',
            # pylint: disable-next=line-too-long
            'description': 'this is a very excessively long description that uses a large variety of completely unnecessary filler words that add no information to the description and serve no purpose other than to make the length of the description exceed the maximum allowed length for a description, which is five hundred characters. Descriptions longer than five hundred characters are not allowed because it is completely, totally, unnecessarily long and will potentially create layout issues in various places on the frontend.'
        })

        # Confirm rejected with correct error message
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {'error': {
            'description': ["Ensure this value has at most 500 characters (it has 504)."]
        }})

        # Confirm no groups were added to database
        self.assertEqual(len(Group.objects.all()), 0)


class ManagePageTests(TestCase):
    def setUp(self):
        # Clear entire cache before each test
        cache.clear()

        # Set default content_type for post requests (avoid long lines)
        self.client = JSONClient()

        # Create test plants and groups
        default_user = get_default_user()
        self.plant1 = Plant.objects.create(uuid=uuid4(), user=default_user)
        self.plant2 = Plant.objects.create(uuid=uuid4(), user=default_user)
        self.group1 = Group.objects.create(uuid=uuid4(), user=default_user)

    def test_manage_plant(self):
        # Request management page for test plant, confirm status
        response = self.client.get(f'/manage/{self.plant1.uuid}')
        self.assertEqual(response.status_code, 200)

        # Confirm returned SPA
        self.assertTemplateUsed(response, 'plant_tracker/index.html')

        # Request state, confirm state object has correct details
        response = self.client.get_json(f'/get_manage_state/{self.plant1.uuid}')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['title'], 'Manage Plant')
        self.assertEqual(response.json()['state']['plant_details'], {
            'uuid': str(self.plant1.uuid),
            'created': self.plant1.created.isoformat(),
            'archived': False,
            'name': None,
            'display_name': 'Unnamed plant 1',
            'species': None,
            'thumbnail': None,
            'pot_size': None,
            'description': None,
            'last_watered': None,
            'last_fertilized': None,
            'group': None,
        })
        self.assertEqual(response.json()['state']['events'], {
            'water': [],
            'fertilize': [],
            'prune': [],
            'repot': []
        })
        self.assertEqual(response.json()['state']['notes'], {})
        self.assertEqual(response.json()['state']['photos'], {})

    def test_manage_plant_with_photos(self):
        # Create mock photos for plant1
        photo1 = Photo.objects.create(
            photo=create_mock_photo('2024:03:21 10:52:03', 'photo1.jpg'),
            plant=self.plant1
        )
        photo2 = Photo.objects.create(
            photo=create_mock_photo('2024:03:22 10:52:03', 'photo2.jpg'),
            plant=self.plant1
        )

        # Request management page, confirm status
        response = self.client.get(f'/manage/{self.plant1.uuid}')
        self.assertEqual(response.status_code, 200)

        # Request state
        response = self.client.get_json(f'/get_manage_state/{self.plant1.uuid}')
        self.assertEqual(response.status_code, 200)
        state = response.json()['state']

        # Confirm plant.thumbnail contains URL of most recent photo
        self.assertEqual(
            state['plant_details']['thumbnail'],
            '/media/user_1/thumbnails/photo2_thumb.webp'
        )

        # Confirm photos key contains list of dicts with timestamps, database
        # keys, thumbnail URLs, and full-res URLs of each photo
        self.assertEqual(
            state['photos'],
            {
                str(photo2.pk): {
                    'timestamp': '2024-03-22T10:52:03+00:00',
                    'photo': '/media/user_1/images/photo2.jpg',
                    'thumbnail': '/media/user_1/thumbnails/photo2_thumb.webp',
                    'preview': '/media/user_1/previews/photo2_preview.webp',
                    'key': photo2.pk
                },
                str(photo1.pk): {
                    'timestamp': '2024-03-21T10:52:03+00:00',
                    'photo': '/media/user_1/images/photo1.jpg',
                    'thumbnail': '/media/user_1/thumbnails/photo1_thumb.webp',
                    'preview': '/media/user_1/previews/photo1_preview.webp',
                    'key': photo1.pk
                },
            }
        )

    def test_manage_plant_with_notes(self):
        # Create 2 notes for plant1 with different timestamps
        NoteEvent.objects.create(
            plant=self.plant1,
            timestamp=datetime.fromisoformat('2024-02-06T03:06:26+00:00'),
            text='Leaves drooping, needs to be watered more often'
        )
        NoteEvent.objects.create(
            plant=self.plant1,
            timestamp=datetime.fromisoformat('2024-02-16T03:06:26+00:00'),
            text='Looks much better now'
        )

        # Request management page, confirm status
        response = self.client.get(f'/manage/{self.plant1.uuid}')
        self.assertEqual(response.status_code, 200)

        # Request state
        response = self.client.get_json(f'/get_manage_state/{self.plant1.uuid}')
        self.assertEqual(response.status_code, 200)
        state = response.json()['state']

        # Confirm notes dict contains timestamp and text of both notes
        self.assertEqual(
            state['notes'],
            {
                '2024-02-06T03:06:26+00:00': 'Leaves drooping, needs to be watered more often',
                '2024-02-16T03:06:26+00:00': 'Looks much better now'
            }
        )

    def test_manage_plant_with_group(self):
        # Add test plant to group
        self.plant1.group = self.group1
        self.plant1.save()

        # Request management page, confirm status
        response = self.client.get(f'/manage/{self.plant1.uuid}')
        self.assertEqual(response.status_code, 200)

        # Request state
        response = self.client.get_json(f'/get_manage_state/{self.plant1.uuid}')
        self.assertEqual(response.status_code, 200)
        state = response.json()['state']

        # Confirm group key in plant state state contains group details
        self.assertEqual(
            state['plant_details']['group'],
            {
                'name': self.group1.get_display_name(),
                'uuid': str(self.group1.uuid)
            }
        )

    def test_manage_plant_with_name(self):
        # Give plant1 a name
        self.plant1.name = 'Favorite Plant'
        self.plant1.save()

        # Request manage page state, confirm display_name matches name attribute
        response = self.client.get_json(f'/get_manage_state/{self.plant1.uuid}')
        self.assertEqual(
            response.json()['state']['plant_details']['display_name'],
            'Favorite Plant'
        )

    def test_get_new_plant_state(self):
        # Create water events for test plant in non-chronological order (should
        # be sorted chronologically by database)
        WaterEvent.objects.create(plant=self.plant1, timestamp=datetime(2024, 2, 26, 0, 0, 0, 0))
        WaterEvent.objects.create(plant=self.plant1, timestamp=datetime(2024, 2, 28, 0, 0, 0, 0))
        WaterEvent.objects.create(plant=self.plant1, timestamp=datetime(2024, 2, 27, 0, 0, 0, 0))

        # Request new state with UUID of existing plant entry
        response = self.client.get_json(f'/get_manage_state/{self.plant1.uuid}')

        # Confirm returned full manage_plant state
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json()['state'],
            {
                'plant_details': {
                    'uuid': str(self.plant1.uuid),
                    'created': self.plant1.created.isoformat(),
                    'archived': False,
                    'name': None,
                    'display_name': 'Unnamed plant 1',
                    'species': None,
                    'thumbnail': None,
                    'pot_size': None,
                    'description': None,
                    'last_watered': '2024-02-28T00:00:00+00:00',
                    'last_fertilized': None,
                    'group': None,
                },
                'events': {
                    'water': [
                        '2024-02-28T00:00:00+00:00',
                        '2024-02-27T00:00:00+00:00',
                        '2024-02-26T00:00:00+00:00'
                    ],
                    'fertilize': [],
                    'prune': [],
                    'repot': []
                },
                'notes': {},
                'photos': {},
                'default_photo': {
                    'set': False,
                    'timestamp': None,
                    'photo': None,
                    'thumbnail': None,
                    'preview': None,
                    'key': None
                },
                'divided_from': None,
                'division_events': {}
            }
        )

    def test_get_new_plant_state_plant_has_parent(self):
        # Simulate division in progress (user called /divide_plant from plant1)
        divide = DivisionEvent.objects.create(plant=self.plant1, timestamp=timezone.now())
        cache.set(f'division_in_progress_{self.plant1.user.pk}', {
            'divided_from_plant_uuid': str(self.plant1.uuid),
            'division_event_key': str(divide.pk)
        }, 900)

        # Register new plant that is a child of plant1
        test_id = uuid4()
        response = self.client.post('/register_plant', {
            'uuid': test_id,
            'name': '',
            'species': '',
            'description': '',
            'pot_size': '',
            'divided_from_id': str(self.plant1.pk),
            'divided_from_event_id': str(divide.pk)
        })

        # Request new state with UUID of new child plant
        response = self.client.get_json(f'/get_manage_state/{test_id}')

        # Confirm returned manage_plant state contains details of plant1 (parent)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['state']['divided_from'], {
            'name': self.plant1.get_display_name(),
            'uuid': str(self.plant1.uuid),
            'timestamp': divide.timestamp.isoformat()
        })
        # Confirm no division_events (DivisionEvent associated with parent, not child)
        self.assertEqual(response.json()['state']['division_events'], {})

    def test_get_new_plant_state_plant_has_child(self):
        # Make plant2 child of plant1
        divide = DivisionEvent.objects.create(plant=self.plant1, timestamp=timezone.now())
        self.plant2.divided_from = self.plant1
        self.plant2.divided_from_event = divide
        self.plant2.save()

        # Request new state with UUID of plant1
        response = self.client.get_json(f'/get_manage_state/{self.plant1.uuid}')

        # Confirm returned manage_plant state contains division_events + details
        # of plant2 (child)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['state']['division_events'], {
            divide.timestamp.isoformat(): [
                {
                    'name': self.plant2.get_display_name(),
                    'uuid': str(self.plant2.uuid),
                }
            ]
        })
        # Confirm no divided_from (parent has no parent)
        self.assertFalse(response.json()['state']['divided_from'])

    def test_get_new_plant_state_invalid(self):
        # Request new state with non-UUID string
        response = self.client.get_json('/get_manage_state/plant1')

        # Confirmer returned expected error
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {'Error': 'Requires valid UUID'})

    def test_manage_group_with_no_plants(self):
        # Request management page for test group, confirm status
        response = self.client.get(f'/manage/{self.group1.uuid}')
        self.assertEqual(response.status_code, 200)

        # Confirm returned SPA
        self.assertTemplateUsed(response, 'plant_tracker/index.html')

        # Request state
        response = self.client.get_json(f'/get_manage_state/{self.group1.uuid}')
        self.assertEqual(response.status_code, 200)
        state = response.json()['state']

        # Confirm expected state objects
        self.assertEqual(
            state['group_details'],
            {
                'uuid': str(self.group1.uuid),
                'name': self.group1.name,
                'created': self.group1.created.isoformat(),
                'archived': False,
                'location': None,
                'description': None,
                'display_name': 'Unnamed group 1',
                'plants': 0
            }
        )

        # Confirm details state contains empty list (no plants in group)
        self.assertEqual(state['plants'], {})

    def test_manage_group_with_plant(self):
        # Add test plant to group
        self.plant1.group = self.group1
        self.plant1.save()

        # Request management page for test group, confirm status
        response = self.client.get(f'/manage/{self.group1.uuid}')
        self.assertEqual(response.status_code, 200)

        # Request state
        response = self.client.get_json(f'/get_manage_state/{self.group1.uuid}')
        self.assertEqual(response.status_code, 200)
        state = response.json()['state']

        # Confirm plants key in group state matches number of plants
        self.assertEqual(state['group_details']['plants'], 1)

        # Confirm details state contains params for plant in group
        self.assertEqual(
            state['plants'],
            {
                str(self.plant1.uuid): {
                    'name': None,
                    'display_name': 'Unnamed plant 1',
                    'uuid': str(self.plant1.uuid),
                    'created': self.plant1.created.isoformat(),
                    'archived': False,
                    'species': None,
                    'thumbnail': None,
                    'description': None,
                    'pot_size': None,
                    'last_watered': None,
                    'last_fertilized': None,
                    'group': {
                        'name': 'Unnamed group 1',
                        'uuid': str(self.group1.uuid)
                    }
                }
            }
        )

    def test_get_new_group_state(self):
        # Create second group, add plant2
        group2 = Group.objects.create(uuid=uuid4(), user=get_default_user())
        self.plant2.group = group2
        self.plant2.save()

        # Request new state with UUID of existing group entry
        response = self.client.get_json(f'/get_manage_state/{self.group1.uuid}')

        # Confirm returned full manage_group state
        # Confirm options list does NOT contain plant2 (already in a group)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json()['state'],
            {
                'group_details': {
                    'uuid': str(self.group1.uuid),
                    'name': self.group1.name,
                    'created': self.group1.created.isoformat(),
                    'archived': False,
                    'location': None,
                    'description': None,
                    'display_name': 'Unnamed group 1',
                    'plants': 0
                },
                'plants': {}
            }
        )

    def test_get_new_group_state_invalid(self):
        # Request new state with non-UUID string
        response = self.client.get_json('/get_manage_state/group1')

        # Confirmer returned expected error
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {'Error': 'Requires valid UUID'})


class ManagePlantEndpointTests(TestCase):
    def setUp(self):
        # Clear entire cache before each test
        cache.clear()

        # Set default content_type for post requests (avoid long lines)
        self.client = JSONClient()

        # Create test plant and group
        self.plant = Plant.objects.create(uuid=uuid4(), user=get_default_user())
        self.group = Group.objects.create(uuid=uuid4(), user=get_default_user())

    def _refresh_test_models(self):
        self.plant.refresh_from_db()
        self.group.refresh_from_db()

    def test_get_species_options(self):
        # Call endpoint with no plants in database with species set
        response = self.client.get('/get_plant_species_options')

        # Confirm returns empty list (no species in database)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'options': []})

        # Create plants with species set
        user = get_default_user()
        Plant.objects.create(uuid=uuid4(), user=user, species='Calathea')
        Plant.objects.create(uuid=uuid4(), user=user, species='Fittonia')

        # Call endpoint again, confirm list contains both species
        response = self.client.get('/get_plant_species_options')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'options': ['Calathea', 'Fittonia']})

    def test_edit_plant_details(self):
        # Confirm test plant has no name or species
        self.assertIsNone(self.plant.name)
        self.assertIsNone(self.plant.species)

        # Send edit_plant_details request with leading/trailing spaces on some params
        response = self.client.post('/edit_plant_details', {
            'plant_id': self.plant.uuid,
            'name': 'test plant    ',
            'species': '   Giant Sequoia',
            'description': '300 feet and a few thousand years old',
            'pot_size': '4'
        })

        # Confirm response contains correct details with extra spaces removed
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {
                'name': 'test plant',
                'display_name': 'test plant',
                'species': 'Giant Sequoia',
                'description': '300 feet and a few thousand years old',
                'pot_size': '4'
            }
        )

        # Confirm no additional plant created
        self.assertEqual(len(Plant.objects.all()), 1)

        # Confirm details now match, leading/trailing spaces were removed
        self._refresh_test_models()
        self.assertEqual(self.plant.name, 'test plant')
        self.assertEqual(self.plant.species, 'Giant Sequoia')

    def test_edit_plant_details_field_too_long(self):
        # Send edit_plant_details request with name longer than length limit (50 char)
        response = self.client.post('/edit_plant_details', {
            'plant_id': self.plant.uuid,
            'name': 'this name is longer than the fifty character length limit',
            'species': '',
            'description': '',
            'pot_size': ''
        })

        # Confirm rejected with correct error message
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {'error': {
            'name': ["Ensure this value has at most 50 characters (it has 57)."]
        }})

        # Confirm name did not change in database
        self.assertIsNone(self.plant.name)

    def test_add_plant_to_group(self):
        # Confirm test plant and group have no database relation
        self.assertIsNone(self.plant.group)
        self.assertEqual(len(self.group.plant_set.all()), 0)

        # Send add_plant_to_group request, confirm response
        response = self.client.post('/add_plant_to_group', {
            'plant_id': self.plant.uuid,
            'group_id': self.group.uuid
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {
                "action": "add_plant_to_group",
                "plant": str(self.plant.uuid),
                "group_name": 'Unnamed group 1',
                "group_uuid": str(self.group.uuid)
            }
        )

        # Confirm database relation created
        self._refresh_test_models()
        self.assertEqual(self.plant.group, self.group)
        self.assertEqual(len(self.group.plant_set.all()), 1)

    def test_remove_plant_from_group(self):
        # Add test plant to group, confirm relation
        self.plant.group = self.group
        self.plant.save()
        self.assertEqual(self.plant.group, self.group)
        self.assertEqual(len(self.group.plant_set.all()), 1)

        # Send add_plant_to_group request, confirm response
        response = self.client.post('/remove_plant_from_group', {
            'plant_id': self.plant.uuid
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {
                'action': 'remove_plant_from_group',
                'plant': str(self.plant.uuid)
            }
        )

        # Confirm database relation removed
        self._refresh_test_models()
        self.assertIsNone(self.plant.group)
        self.assertEqual(len(self.group.plant_set.all()), 0)

    def test_repot_plant(self):
        # Set starting pot_size
        self.plant.pot_size = 4
        self.plant.save()

        # Confirm plant has no RepotEvents
        self.assertEqual(len(self.plant.repotevent_set.all()), 0)

        # Send repot_plant request
        response = self.client.post('/repot_plant', {
            'plant_id': self.plant.uuid,
            'timestamp': '2024-02-06T03:06:26.000Z',
            'new_pot_size': 6
        })

        # Confirm response, confirm RepotEvent created
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {
                "action": "repot",
                "plant": str(self.plant.uuid),
                "timestamp": "2024-02-06T03:06:26+00:00",
                "pot_size": 6
            }
        )
        self._refresh_test_models()
        self.assertEqual(len(self.plant.repotevent_set.all()), 1)

        # Confirm correct pot_size attributes on plant and event entries
        self.assertEqual(self.plant.pot_size, 6)
        self.assertEqual(self.plant.repotevent_set.all()[0].old_pot_size, 4)
        self.assertEqual(self.plant.repotevent_set.all()[0].new_pot_size, 6)

    def test_repot_plant_blank_new_pot_size(self):
        # Set starting pot_size
        self.plant.pot_size = 4
        self.plant.save()

        # Send repot_plant request with blank new_pot_size
        response = self.client.post('/repot_plant', {
            'plant_id': self.plant.uuid,
            'timestamp': '2024-02-06T03:06:26.000Z',
            'new_pot_size': None
        })

        # Confirm status, confirm plant pot_size did not change
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.plant.pot_size, 4)

    def test_divide_plant(self):
        # Confirm plant has no DivisionEvents
        self.assertEqual(len(self.plant.divisionevent_set.all()), 0)

        # Send divide_plant request
        response = self.client.post('/divide_plant', {
            'plant_id': self.plant.uuid,
            'timestamp': '2024-02-06T03:06:26.000Z'
        })

        # Confirm response, confirm DivisionEvent created
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {"action": "divide", "plant": str(self.plant.uuid)}
        )
        self._refresh_test_models()
        self.assertEqual(len(self.plant.divisionevent_set.all()), 1)

        # Confirm cache key contains UUID of divided plant + pk of DivisionEvent
        division_event = self.plant.divisionevent_set.all().first()
        self.assertEqual(
            cache.get(f'division_in_progress_{get_default_user().pk}'),
            {
                'divided_from_plant_uuid': str(self.plant.uuid),
                'division_event_key': str(division_event.pk)
            }
        )

    def test_divide_plant_duplicate_timestamp(self):
        # Create existing DivisionEvent
        timestamp = '2024-02-06T03:06:26.000Z'
        DivisionEvent.objects.create(plant=self.plant, timestamp=timestamp)
        self.assertEqual(len(self.plant.divisionevent_set.all()), 1)

        # Send divide_plant request with identical timestamp
        response = self.client.post('/divide_plant', {
            'plant_id': self.plant.uuid,
            'timestamp': timestamp
        })

        # Confirm expected error
        self.assertEqual(response.status_code, 409)
        self.assertEqual(
            response.json(),
            {"error": "Event with same timestamp already exists"}
        )

        # Confirm no event was created
        self._refresh_test_models()
        self.assertEqual(len(self.plant.divisionevent_set.all()), 1)

        # Confirm UUID was not cached
        self.assertIsNone(cache.get(f'division_in_progress_{get_default_user().pk}'))

    def test_get_add_to_group_options(self):
        # Confirm endpoint returns details of all existing groups
        response = self.client.get('/get_add_to_group_options')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {
                'options': {
                    str(self.group.uuid): {
                        'name': None,
                        'display_name': 'Unnamed group 1',
                        'uuid': str(self.group.uuid),
                        'created': self.group.created.isoformat(),
                        'archived': False,
                        'location': None,
                        'description': None,
                        'plants': 0
                    }
                }
            }
        )


class ManageGroupEndpointTests(TestCase):
    def setUp(self):
        # Clear entire cache before each test
        cache.clear()

        # Set default content_type for post requests (avoid long lines)
        self.client = JSONClient()

        # Create test plants and groups
        default_user = get_default_user()
        self.plant1 = Plant.objects.create(uuid=uuid4(), user=default_user)
        self.plant2 = Plant.objects.create(uuid=uuid4(), user=default_user)
        self.group1 = Group.objects.create(uuid=uuid4(), user=default_user)

        # Create fake UUID that doesn't exist in database
        self.fake_id = uuid4()

    def _refresh_test_models(self):
        self.plant1.refresh_from_db()
        self.plant2.refresh_from_db()
        self.group1.refresh_from_db()

    def test_edit_group_details(self):
        # Confirm test group has no name, location, or description
        self.assertIsNone(self.group1.name)
        self.assertIsNone(self.group1.location)
        self.assertIsNone(self.group1.description)

        # Send edit_group_details request with leading/trailing spaces on some params
        response = self.client.post('/edit_group_details', {
            'group_id': self.group1.uuid,
            'name': 'test group    ',
            'location': '    middle shelf',
            'description': 'This group is used for propagation'
        })

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
        self.assertEqual(
            self.group1.description,
            'This group is used for propagation'
        )

    def test_edit_group_details_field_too_long(self):
        # Send edit_group_details request with name longer than length limit (50 char)
        response = self.client.post('/edit_group_details', {
            'group_id': self.group1.uuid,
            'name': 'this name is longer than the fifty character length limit',
            'location': '',
            'description': '',
        })

        # Confirm rejected with correct error message
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {'error': {
            'name': ["Ensure this value has at most 50 characters (it has 57)."]
        }})

        # Confirm name did not change in database
        self.assertIsNone(self.group1.name)

    def test_bulk_add_plants_to_group(self):
        # Confirm test plants are not in test group
        self.assertIsNone(self.plant1.group)
        self.assertIsNone(self.plant2.group)
        self.assertEqual(len(self.group1.plant_set.all()), 0)

        # Send bulk_add_plants_to_group request with both IDs + 1 fake ID
        response = self.client.post('/bulk_add_plants_to_group', {
            'group_id': self.group1.uuid,
            'plants': [
                self.plant1.uuid,
                self.plant2.uuid,
                self.fake_id
            ]
        })

        # Confirm plant UUIDs were added, fake ID failed
        self.plant1.refresh_from_db()
        self.plant2.refresh_from_db()
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
        response = self.client.post('/bulk_remove_plants_from_group', {
            'group_id': self.group1.uuid,
            'plants': [
                self.plant1.uuid,
                self.plant2.uuid,
                self.fake_id
            ]
        })

        # Confirm plants were removed, response contains details of removed plants
        # Confirm fake ID failed, response contains UUID
        self.plant1.refresh_from_db()
        self.plant2.refresh_from_db()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {
                "removed": [self.plant1.get_details(), self.plant2.get_details()],
                "failed": [str(self.fake_id)]
            }
        )

        # Confirm plants no longer have relation to group
        self._refresh_test_models()
        self.assertIsNone(self.plant1.group)
        self.assertIsNone(self.plant2.group)
        self.assertEqual(len(self.group1.plant_set.all()), 0)

    def test_get_plant_options(self):
        # Confirm endpoint returns dict with details of all plants
        response = self.client.get('/get_plant_options')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {
                'options': {
                    str(self.plant1.uuid): {
                        'name': self.plant1.name,
                        'display_name': self.plant1.get_display_name(),
                        'uuid': str(self.plant1.uuid),
                        'created': self.plant1.created.isoformat(),
                        'archived': False,
                        'species': None,
                        'pot_size': None,
                        'description': None,
                        'last_watered': None,
                        'last_fertilized': None,
                        'thumbnail': None,
                        'group': None
                    },
                    str(self.plant2.uuid): {
                        'name': self.plant2.name,
                        'display_name': self.plant2.get_display_name(),
                        'uuid': str(self.plant2.uuid),
                        'created': self.plant2.created.isoformat(),
                        'archived': False,
                        'species': None,
                        'pot_size': None,
                        'description': None,
                        'last_watered': None,
                        'last_fertilized': None,
                        'thumbnail': None,
                        'group': None
                    }
                }
            }
        )

        # Archive plant1, confirm removed from options
        self.plant2.archived = True
        self.plant2.save()
        response = self.client.get('/get_plant_options')
        self.assertEqual(
            response.json(),
            {
                'options': {
                    str(self.plant1.uuid): {
                        'name': self.plant1.name,
                        'display_name': self.plant1.get_display_name(),
                        'uuid': str(self.plant1.uuid),
                        'created': self.plant1.created.isoformat(),
                        'archived': False,
                        'species': None,
                        'pot_size': None,
                        'description': None,
                        'last_watered': None,
                        'last_fertilized': None,
                        'thumbnail': None,
                        'group': None
                    }
                }
            }
        )


class ChangeQrCodeTests(TestCase):
    '''Separate test case to prevent leftover cache breaking other tests'''

    def setUp(self):
        # Clear entire cache before each test
        cache.clear()

        # Set default content_type for post requests (avoid long lines)
        self.client = JSONClient()

        # Create test plants and groups
        self.default_user = get_default_user()
        self.plant1 = Plant.objects.create(uuid=uuid4(), user=self.default_user)
        self.plant2 = Plant.objects.create(uuid=uuid4(), user=self.default_user)
        self.group1 = Group.objects.create(uuid=uuid4(), user=self.default_user)

        # Create fake UUID that doesn't exist in database
        self.fake_id = uuid4()

    def _refresh_test_models(self):
        self.plant1.refresh_from_db()
        self.plant2.refresh_from_db()
        self.group1.refresh_from_db()

    def test_change_qr_code_endpoint(self):
        # Confirm cache key is empty
        self.assertIsNone(cache.get(f'old_uuid_{self.default_user.pk}'))

        # Post UUID to change_qr_code endpoint, confirm response
        response = self.client.post('/change_qr_code', {
            'uuid': str(self.plant1.uuid)
        })
        self.assertEqual(
            response.json(),
            {"success": "scan new QR code within 15 minutes to confirm"}
        )
        self.assertEqual(response.status_code, 200)

        # Confirm cache key contains UUID
        self.assertEqual(
            cache.get(f'old_uuid_{self.default_user.pk}'),
            str(self.plant1.uuid)
        )

    def test_change_uuid_endpoint_plant(self):
        # Simulate cached UUID from change_qr_code request
        cache.set(f'old_uuid_{self.default_user.pk}', str(self.plant1.uuid))
        self.assertEqual(
            cache.get(f'old_uuid_{self.default_user.pk}'),
            str(self.plant1.uuid)
        )

        # Post new UUID to change_uuid endpoint, confirm response
        response = self.client.post('/change_uuid', {
            'uuid': str(self.plant1.uuid),
            'new_id': str(self.fake_id)
        })
        self.assertEqual(
            response.json(),
            {"new_uuid": str(self.fake_id)}
        )
        self.assertEqual(response.status_code, 200)

        # Confirm plant UUID changed + cache cleared
        self._refresh_test_models()
        self.assertEqual(str(self.plant1.uuid), str(self.fake_id))
        self.assertIsNone(cache.get(f'old_uuid_{self.default_user.pk}'))

    def test_change_uuid_endpoint_while_dividing_plant(self):
        # Simulate division in progress for plant2
        cache.set(f'division_in_progress_{self.default_user.pk}', {
            'divided_from_plant_uuid': str(self.plant2.uuid),
            'division_event_key': 3
        }, 900)

        # Simulate cached plant1 UUID from change_qr_code_request
        cache.set(f'old_uuid_{self.default_user.pk}', str(self.plant1.uuid))

        # Post new plant1 UUID to change_uuid endpoint
        response = self.client.post('/change_uuid', {
            'uuid': str(self.plant1.uuid),
            'new_id': str(uuid4())
        })
        self.assertEqual(response.status_code, 200)

        # Confirm plant2 UUID in division cache did NOT change
        dividing = cache.get(f'division_in_progress_{self.default_user.pk}')
        self.assertEqual(dividing['divided_from_plant_uuid'], str(self.plant2.uuid))

        # Simulate cached plant2 UUID (same plant as dividing)
        cache.set(f'old_uuid_{self.default_user.pk}', str(self.plant2.uuid))

        # Post new plant2 UUID to change_uuid endpoint
        response = self.client.post('/change_uuid', {
            'uuid': str(self.plant2.uuid),
            'new_id': str(self.fake_id)
        })
        self.assertEqual(response.status_code, 200)

        # Confirm plant2 UUID in division cache changed
        dividing = cache.get(f'division_in_progress_{self.default_user.pk}')
        self.assertEqual(dividing['divided_from_plant_uuid'], str(self.fake_id))

    def test_change_uuid_endpoint_group(self):
        # Simulate cached UUID from change_qr_code request
        cache.set(f'old_uuid_{self.default_user.pk}', str(self.group1.uuid))
        self.assertEqual(
            cache.get(f'old_uuid_{self.default_user.pk}'),
            str(self.group1.uuid)
        )

        # Post new UUID to change_uuid endpoint, confirm response
        response = self.client.post('/change_uuid', {
            'uuid': str(self.group1.uuid),
            'new_id': str(self.fake_id)
        })
        self.assertEqual(
            response.json(),
            {"new_uuid": str(self.fake_id)}
        )
        self.assertEqual(response.status_code, 200)

        # Confirm plant UUID changed + cache cleared
        self._refresh_test_models()
        self.assertEqual(str(self.group1.uuid), str(self.fake_id))
        self.assertIsNone(cache.get(f'old_uuid_{self.default_user.pk}'))

    def test_change_uuid_invalid(self):
        # post invalid UUID to change_uuid endpoint, confirm error
        response = self.client.post('/change_uuid', {
            'uuid': self.plant1.uuid,
            'new_id': '31670857'
        })
        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.json(),
            {"error": "new_id key is not a valid UUID"}
        )

    def test_confirmation_page_plant(self):
        # Simulate cached UUID from change_qr_code request
        cache.set(f'old_uuid_{self.default_user.pk}', str(self.plant1.uuid))
        self.assertEqual(
            cache.get(f'old_uuid_{self.default_user.pk}'),
            str(self.plant1.uuid)
        )

        # Request management page with new UUID (simulate user scanning new QR)
        response = self.client.get(f'/manage/{self.fake_id}')

        # Confirm returned SPA
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'plant_tracker/index.html')

        # Request state
        response = self.client.get_json(f'/get_manage_state/{self.fake_id}')
        self.assertEqual(response.status_code, 200)
        state = response.json()['state']

        # Confirm state contains plant details and new UUID
        self.assertEqual(
            state,
            {
                'new_id': str(self.fake_id),
                'changing_qr_code': {
                    'type': 'plant',
                    'instance': {
                        'uuid': str(self.plant1.uuid),
                        'created': self.plant1.created.isoformat(),
                        'archived': False,
                        'name': None,
                        'display_name': 'Unnamed plant 1',
                        'species': None,
                        'thumbnail': None,
                        'pot_size': None,
                        'description': None,
                        'last_watered': None,
                        'last_fertilized': None,
                        'group': None
                    },
                    'new_uuid': str(self.fake_id),
                    'preview': self.plant1.get_default_photo_details()['preview']
                }
            }
        )

    def test_confirmation_page_group(self):
        # Simulate cached UUID from change_qr_code request
        cache.set(f'old_uuid_{self.default_user.pk}', str(self.group1.uuid))
        self.assertEqual(
            cache.get(f'old_uuid_{self.default_user.pk}'),
            str(self.group1.uuid)
        )

        # Request management page with new UUID (simulate user scanning new QR)
        response = self.client.get_json(f'/manage/{self.fake_id}')

        # Confirm returned SPA
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'plant_tracker/index.html')

        # Request state
        response = self.client.get_json(f'/get_manage_state/{self.fake_id}')
        self.assertEqual(response.status_code, 200)
        state = response.json()['state']

        # Confirm state contains group details and new UUID
        self.assertEqual(
            state,
            {
                'new_id': str(self.fake_id),
                'changing_qr_code': {
                    'type': 'group',
                    'instance': {
                        'uuid': str(self.group1.uuid),
                        'created': self.group1.created.isoformat(),
                        'archived': False,
                        'name': None,
                        'display_name': 'Unnamed group 1',
                        'location': None,
                        'description': None,
                        'plants': 0
                    },
                    'new_uuid': str(self.fake_id)
                }
            }
        )

    def test_manage_page_while_waiting_for_new_qr_code(self):
        '''The /manage endpoint should only return the confirmation page if a
        new QR code is scanned. If the QR code of an existing plant or group is
        scanned it should return the manage page for the plant or group.
        '''

        # Simulate cached UUID from change_qr_code request
        cache.set(f'old_uuid_{self.default_user.pk}', str(self.plant1.uuid))
        self.assertEqual(
            cache.get(f'old_uuid_{self.default_user.pk}'),
            str(self.plant1.uuid)
        )

        # Request management page state with new UUID (should return confirmation page)
        response = self.client.get_json(f'/get_manage_state/{self.fake_id}')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['title'], 'Register New Plant')

        # Request management page state with existing plant UUID (should return manage_plant)
        response = self.client.get_json(f'/get_manage_state/{self.plant2.uuid}')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['title'], 'Manage Plant')

        # Request management page state with existing group UUID (should return manage_group)
        response = self.client.get_json(f'/get_manage_state/{self.group1.uuid}')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['title'], 'Manage Group')

        # Request management page state with UUID of plant waiting for new QR code,
        # should return manage_plant page like normal
        response = self.client.get_json(f'/get_manage_state/{self.plant1.uuid}')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['title'], 'Manage Plant')

    def test_target_plant_deleted_before_confirmation_page_loaded(self):
        # Simulate user changing plant QR code
        cache.set(f'old_uuid_{self.default_user.pk}', str(self.plant1.uuid))
        # Simulate user deleting plant before loading confirmation page
        self.plant1.delete()
        self.assertIsNotNone(cache.get(f'old_uuid_{self.default_user.pk}'))

        # Request register state with new UUID (simulate user scanning new QR)
        response = self.client.get_json(f'/get_manage_state/{self.fake_id}')
        self.assertEqual(response.status_code, 200)
        state = response.json()['state']

        # Confirm old_id cache was cleared, state does not say changing QR code
        self.assertIsNone(cache.get(f'old_uuid_{self.default_user.pk}'))
        self.assertNotIn('changing_qr_code', state)


class PlantEventEndpointTests(TestCase):
    def setUp(self):
        # Clear entire cache before each test
        cache.clear()

        # Set default content_type for post requests (avoid long lines)
        self.client = JSONClient()

        # Create test plants
        self.default_user = get_default_user()
        self.plant1 = Plant.objects.create(uuid=uuid4(), user=self.default_user)
        self.plant2 = Plant.objects.create(uuid=uuid4(), user=self.default_user)

        # Create fake UUID that doesn't exist in database
        self.fake_id = uuid4()

    def test_add_water_event(self):
        # Confirm test plant has no water events
        self.assertIsNone(self.plant1.last_watered())
        self.assertEqual(len(WaterEvent.objects.all()), 0)

        # Send add_plant_event request, confirm response
        response = self.client.post('/add_plant_event', {
            'plant_id': self.plant1.uuid,
            'event_type': 'water',
            'timestamp': '2024-02-06T03:06:26.000Z'
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {
                "action": "water",
                "timestamp": "2024-02-06T03:06:26+00:00",
                "plant": str(self.plant1.uuid)
            }
        )

        # Confirm WaterEvent was created
        self.assertEqual(len(WaterEvent.objects.all()), 1)
        self.assertEqual(self.plant1.last_watered(), '2024-02-06T03:06:26+00:00')

    def test_add_fertilize_event(self):
        # Confirm test plant has no fertilize events
        self.assertIsNone(self.plant1.last_fertilized())
        self.assertEqual(len(FertilizeEvent.objects.all()), 0)

        # Send add_plant_event request, confirm response
        response = self.client.post('/add_plant_event', {
            'plant_id': self.plant1.uuid,
            'event_type': 'fertilize',
            'timestamp': '2024-02-06T03:06:26.000Z'
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {
                "action": "fertilize",
                "timestamp": "2024-02-06T03:06:26+00:00",
                "plant": str(self.plant1.uuid)
            }
        )

        # Confirm FertilizeEvent was created
        self.assertEqual(len(FertilizeEvent.objects.all()), 1)
        self.assertEqual(self.plant1.last_fertilized(), '2024-02-06T03:06:26+00:00')

    def test_add_prune_event(self):
        # Confirm test plant has no prune events
        self.assertIsNone(self.plant1.last_pruned())
        self.assertEqual(len(PruneEvent.objects.all()), 0)

        # Send add_plant_event request, confirm response
        response = self.client.post('/add_plant_event', {
            'plant_id': self.plant1.uuid,
            'event_type': 'prune',
            'timestamp': '2024-02-06T03:06:26.000Z'
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {
                "action": "prune",
                "timestamp": "2024-02-06T03:06:26+00:00",
                "plant": str(self.plant1.uuid)
            }
        )

        # Confirm PruneEvent was created
        self.assertEqual(len(PruneEvent.objects.all()), 1)
        self.assertEqual(self.plant1.last_pruned(), '2024-02-06T03:06:26+00:00')

    def test_add_repot_event(self):
        # Confirm test plant has no repot events
        self.assertIsNone(self.plant1.last_repotted())
        self.assertEqual(len(RepotEvent.objects.all()), 0)

        # Send add_plant_event request, confirm response
        response = self.client.post('/add_plant_event', {
            'plant_id': self.plant1.uuid,
            'event_type': 'repot',
            'timestamp': '2024-02-06T03:06:26.000Z'
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {
                "action": "repot",
                "timestamp": "2024-02-06T03:06:26+00:00",
                "plant": str(self.plant1.uuid)
            }
        )

        # Confirm RepotEvent was created
        self.assertEqual(len(RepotEvent.objects.all()), 1)
        self.assertEqual(self.plant1.last_repotted(), '2024-02-06T03:06:26+00:00')

    def test_add_event_with_duplicate_timestamp(self):
        # Create WaterEvent manually, then attempt to create with API call
        timestamp = timezone.now()
        WaterEvent.objects.create(plant=self.plant1, timestamp=timestamp)
        self.assertEqual(len(WaterEvent.objects.all()), 1)
        response = self.client.post('/add_plant_event', {
            'plant_id': self.plant1.uuid,
            'timestamp': timestamp.isoformat(),
            'event_type': 'water'
        })
        # Confirm correct error, confirm no WaterEvent created
        self.assertEqual(response.status_code, 409)
        self.assertEqual(
            response.json(),
            {'error': 'event with same timestamp already exists'}
        )
        self.assertEqual(len(WaterEvent.objects.all()), 1)

    def test_bulk_water_plants(self):
        # Confirm test plants have no WaterEvents
        self.assertEqual(len(self.plant1.waterevent_set.all()), 0)
        self.assertEqual(len(self.plant2.waterevent_set.all()), 0)

        # Send bulk_add_plants_to_group request with both IDs
        response = self.client.post('/bulk_add_plant_events', {
            'plants': [
                str(self.plant1.uuid),
                str(self.plant2.uuid),
                str(self.fake_id)
            ],
            'event_type': 'water',
            'timestamp': '2024-02-06T03:06:26.000Z'
        })

        # Confirm response, confirm WaterEvent created for both plants
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {
                "action": "water",
                "timestamp": "2024-02-06T03:06:26+00:00",
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
        response = self.client.post('/bulk_add_plant_events', {
            'plants': [
                str(self.plant1.uuid),
                str(self.plant2.uuid),
                str(self.fake_id)
            ],
            'event_type': 'fertilize',
            'timestamp': '2024-02-06T03:06:26.000Z'
        })

        # Confirm response, confirm WaterEvent created for both plants
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {
                "action": "fertilize",
                "timestamp": "2024-02-06T03:06:26+00:00",
                "plants": [str(self.plant1.uuid), str(self.plant2.uuid)],
                "failed": [str(self.fake_id)]
            }
        )
        self.assertEqual(len(self.plant1.fertilizeevent_set.all()), 1)
        self.assertEqual(len(self.plant2.fertilizeevent_set.all()), 1)

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
        response = self.client.post('/bulk_delete_plant_events', {
            'plant_id': self.plant1.uuid,
            'events': {
                'water': [timestamp.isoformat()],
                'fertilize': [timestamp.isoformat()],
                'prune': [timestamp.isoformat()],
                'repot': [timestamp.isoformat()],
            }
        })

        # Confirm correct response, confirm removed from database
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json()['deleted'],
            {
                "water": [timestamp.isoformat()],
                "fertilize": [timestamp.isoformat()],
                "prune": [timestamp.isoformat()],
                "repot": [timestamp.isoformat()]
            }
        )
        self.assertEqual(len(self.plant1.waterevent_set.all()), 0)
        self.assertEqual(len(self.plant1.fertilizeevent_set.all()), 0)
        self.assertEqual(len(self.plant1.pruneevent_set.all()), 0)
        self.assertEqual(len(self.plant1.repotevent_set.all()), 0)

    def test_bulk_delete_plant_events_does_not_exist(self):
        # Post payload containing event that does not exist
        response = self.client.post('/bulk_delete_plant_events', {
            'plant_id': self.plant1.uuid,
            'events': {
                'water': ['2024-04-19T00:13:37+00:00'],
                'fertilize': [],
                'prune': [],
                'repot': [],
            }
        })

        # Confirm event is in failed section
        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.json(),
            {
                "deleted": {
                    "water": [],
                    "fertilize": [],
                    "prune": [],
                    "repot": []
                },
                "failed": {
                    "water": ['2024-04-19T00:13:37+00:00'],
                    "fertilize": [],
                    "prune": [],
                    "repot": []
                }
            }
        )


class NoteEventEndpointTests(TestCase):
    def setUp(self):
        # Clear entire cache before each test
        cache.clear()

        # Set default content_type for post requests (avoid long lines)
        self.client = JSONClient()

        # Create test plant
        self.plant = Plant.objects.create(uuid=uuid4(), user=get_default_user())

    def test_add_note_event(self):
        # Confirm test plant has no note events
        self.assertEqual(len(self.plant.noteevent_set.all()), 0)
        self.assertEqual(len(NoteEvent.objects.all()), 0)

        # Send add_plant_note request with leading and trailing spaces on text
        response = self.client.post('/add_plant_note', {
            'plant_id': self.plant.uuid,
            'timestamp': '2024-02-06T03:06:26.000Z',
            'note_text': '  plant is looking healthier than last week  '
        })

        # Confirm response, confirm leading/trailing spaces were removed
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {
                'action': 'add_note',
                'plant': str(self.plant.uuid),
                'timestamp': '2024-02-06T03:06:26+00:00',
                'note_text': 'plant is looking healthier than last week'
            }
        )

        # Confirm NoteEvent was created, leading/trailing spaces were removed
        self.assertEqual(len(NoteEvent.objects.all()), 1)
        self.assertEqual(len(self.plant.noteevent_set.all()), 1)
        self.assertEqual(
            NoteEvent.objects.all()[0].text,
            'plant is looking healthier than last week'
        )

    def test_add_note_event_duplicate_timestamp(self):
        # Create NoteEvent manually, then attempt to create with API call
        timestamp = timezone.now()
        NoteEvent.objects.create(plant=self.plant, timestamp=timestamp)
        self.assertEqual(len(NoteEvent.objects.all()), 1)
        response = self.client.post('/add_plant_note', {
            'plant_id': self.plant.uuid,
            'timestamp': timestamp.isoformat(),
            'note_text': 'plant is looking healthier than last week'
        })
        # Confirm correct error, confirm no NoteEvent created
        self.assertEqual(response.status_code, 409)
        self.assertEqual(
            response.json(),
            {"error": "Plant already has a note with the same timestamp"}
        )
        self.assertEqual(len(NoteEvent.objects.all()), 1)

    def test_add_note_event_empty_text_field(self):
        # Send add_plant_note request with empty note_text param
        response = self.client.post('/add_plant_note', {
            'plant_id': self.plant.uuid,
            'timestamp': '2024-02-06T03:06:26.000Z',
            'note_text': ''
        })
        # Confirm correct error, confirm no NoteEvent created
        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.json(),
            {"error": {"text": ["This field cannot be null."]}}
        )
        self.assertEqual(len(NoteEvent.objects.all()), 0)

    def test_edit_note_event(self):
        # Create NoteEvent with no text, confirm exists
        timestamp = timezone.now()
        NoteEvent.objects.create(plant=self.plant, timestamp=timestamp, text="note")
        self.assertEqual(len(self.plant.noteevent_set.all()), 1)

        # Send edit_plant_note request with leading and trailing spaces on text
        response = self.client.post('/edit_plant_note', {
            'plant_id': self.plant.uuid,
            'timestamp': timestamp.isoformat(),
            'note_text': '   This is the text I forgot to add   '
        })

        # Confirm response, confirm leading/trailing spaces were removed
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {
                'action': 'edit_note',
                'plant': str(self.plant.uuid),
                'timestamp': timestamp.isoformat(),
                'note_text': 'This is the text I forgot to add'
            }
        )

        # Confirm text of existing NoteEvent was updated, extra spaces removed
        self.assertEqual(len(self.plant.noteevent_set.all()), 1)
        self.assertEqual(
            NoteEvent.objects.get(timestamp=timestamp).text,
            'This is the text I forgot to add'
        )

    def test_edit_note_event_target_does_not_exist(self):
        # Call edit_plant_note endpoint with a timestamp that doesn't exist
        response = self.client.post('/edit_plant_note', {
            'plant_id': self.plant.uuid,
            'timestamp': timezone.now().isoformat(),
            'note_text': 'forgot to add this to my note'
        })

        # Confirm correct error
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json(), {"error": "note not found"})

    def test_edit_note_event_empty_text_field(self):
        # Create NoteEvent, confirm exists
        timestamp = timezone.now()
        NoteEvent.objects.create(plant=self.plant, timestamp=timestamp, text="note")
        self.assertEqual(len(self.plant.noteevent_set.all()), 1)

        # Send edit_plant_note request with empty note_text param
        response = self.client.post('/edit_plant_note', {
            'plant_id': self.plant.uuid,
            'timestamp': timestamp.isoformat(),
            'note_text': ''
        })

        # Confirm correct error, confirm NoteEvent was not modified
        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.json(),
            {"error": {"text": ["This field cannot be null."]}}
        )
        self.assertEqual(len(NoteEvent.objects.all()), 1)
        self.assertEqual(NoteEvent.objects.get(timestamp=timestamp).text, 'note')

    def test_delete_note_event(self):
        # Create NoteEvent, confirm exists
        timestamp = timezone.now()
        NoteEvent.objects.create(plant=self.plant, timestamp=timestamp, text="note")
        self.assertEqual(len(self.plant.noteevent_set.all()), 1)

        # Send delete_plant_notes request, confirm response + event deleted
        response = self.client.post('/delete_plant_notes', {
            'plant_id': self.plant.uuid,
            'timestamps': [timestamp.isoformat()]
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {"deleted": [timestamp.isoformat()], "failed": []}
        )

        # Confirm NoteEvent was deleted
        self.assertEqual(len(self.plant.noteevent_set.all()), 0)

    def test_delete_note_event_target_does_not_exist(self):
        # Call delete_plant_notes endpoint with a timestamp that doesn't exist
        timestamp = timezone.now().isoformat()
        response = self.client.post('/delete_plant_notes', {
            'plant_id': self.plant.uuid,
            'timestamps': [timestamp]
        })

        # Confirm correct error
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"deleted": [], "failed": [timestamp]})

    def test_bulk_delete_note_events(self):
        # Create 2 NoteEvents, confirm exists
        timestamp1 = timezone.now()
        NoteEvent.objects.create(plant=self.plant, timestamp=timestamp1, text="note1")
        timestamp2 = timezone.now()
        NoteEvent.objects.create(plant=self.plant, timestamp=timestamp2, text="note2")
        self.assertEqual(len(self.plant.noteevent_set.all()), 2)

        # Send delete_plant_notes request, confirm response + events deleted
        response = self.client.post('/delete_plant_notes', {
            'plant_id': self.plant.uuid,
            'timestamps': [timestamp1.isoformat(), timestamp2.isoformat()]
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {"deleted": [timestamp1.isoformat(), timestamp2.isoformat()], "failed": []}
        )

        # Confirm NoteEvents were deleted
        self.assertEqual(len(self.plant.noteevent_set.all()), 0)


class PlantPhotoEndpointTests(TestCase):
    def setUp(self):
        # Clear entire cache before each test
        cache.clear()

        # Set default content_type for post requests (avoid long lines)
        self.client = JSONClient()

        # Create test plant
        self.plant = Plant.objects.create(uuid=uuid4(), user=get_default_user())

    def tearDown(self):
        # Delete mock photos between tests to prevent duplicate names (django
        # appends random string to keep unique, which makes testing difficult)
        user_photos = os.path.join(settings.TEST_DIR, 'data', 'images', 'user_1')
        for i in os.listdir(os.path.join(user_photos, 'images')):
            os.remove(os.path.join(user_photos, 'images', i))
        for i in os.listdir(os.path.join(user_photos, 'thumbnails')):
            os.remove(os.path.join(user_photos, 'thumbnails', i))
        for i in os.listdir(os.path.join(user_photos, 'previews')):
            os.remove(os.path.join(user_photos, 'previews', i))

    def test_add_plant_photos(self):
        # Confirm no photos exist in database or plant reverse relation
        self.assertEqual(len(Photo.objects.all()), 0)
        self.assertEqual(len(self.plant.photo_set.all()), 0)

        # Post mock photo to add_plant_photos endpoint
        data = {
            'plant_id': str(self.plant.uuid),
            'photo_0': create_mock_photo('2024:03:22 10:52:03')
        }
        response = self.client.post(
            '/add_plant_photos',
            data=data,
            content_type=MULTIPART_CONTENT
        )

        # Confirm expected response
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()), 3)
        self.assertEqual(response.json()["uploaded"], "1 photo(s)")
        self.assertEqual(response.json()["failed"], [])

        # Confirm response contains new photo creation timestamp, URL, primary key
        self.assertEqual(
            response.json()["urls"],
            [
                {
                    "timestamp": "2024-03-22T10:52:03+00:00",
                    "photo": "/media/user_1/images/mock_photo.jpg",
                    "thumbnail": "/media/user_1/thumbnails/mock_photo_thumb.webp",
                    "preview": "/media/user_1/previews/mock_photo_preview.webp",
                    "key": Photo.objects.all()[0].pk
                }
            ]
        )

        # Confirm Photo was added to database, reverse relation was created
        self.assertEqual(len(Photo.objects.all()), 1)
        self.assertEqual(len(self.plant.photo_set.all()), 1)

        # Confirm Photo.timestamp was set from exif DateTimeOriginal param
        self.assertEqual(
            Photo.objects.all()[0].timestamp.strftime('%Y:%m:%d %H:%M:%S'),
            '2024:03:22 10:52:03'
        )

    def test_add_plant_photos_invalid_file_types(self):
        # Confirm no photos exist in database or plant reverse relation
        self.assertEqual(len(Photo.objects.all()), 0)
        self.assertEqual(len(self.plant.photo_set.all()), 0)

        # Post mock photo to add_plant_photos endpoint
        # Raise PIL.UnidentifiedImageError to simulate invalid file type
        with patch(
            'plant_tracker.models.Photo.objects.create',
            side_effect=UnidentifiedImageError
        ):
            data = {
                'plant_id': str(self.plant.uuid),
                'photo_0': create_mock_photo('2024:03:22 10:52:03')
            }
            response = self.client.post(
                '/add_plant_photos',
                data=data,
                content_type=MULTIPART_CONTENT
            )

        # Confirm expected response
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()), 3)
        self.assertEqual(response.json()["uploaded"], "0 photo(s)")
        self.assertEqual(response.json()["failed"], ["mock_photo.jpg"])
        self.assertEqual(response.json()["urls"], [])

        # Confirm Photo was not added to database
        self.assertEqual(len(Photo.objects.all()), 0)

    def test_add_plant_photos_invalid_get_request(self):
        # Send GET request (expects FormData), confirm error
        response = self.client.get('/add_plant_photos')
        self.assertEqual(response.status_code, 405)
        self.assertEqual(response.json(), {'error': 'must post FormData'})

    def test_delete_plant_photos(self):
        # Create 2 mock photos, add to database
        mock_photo1 = create_mock_photo('2024:03:21 10:52:03')
        mock_photo2 = create_mock_photo('2024:03:22 10:52:03')
        photo1 = Photo.objects.create(photo=mock_photo1, plant=self.plant)
        photo2 = Photo.objects.create(photo=mock_photo2, plant=self.plant)
        self.assertEqual(len(Photo.objects.all()), 2)

        # Post primary keys of both photos to delete_plant_photos endpoint
        # Add a non-existing primary key, should add to response failed section
        response = self.client.post('/delete_plant_photos', {
            'plant_id': str(self.plant.uuid),
            'delete_photos': [
                photo1.pk,
                photo2.pk,
                999
            ]
        })

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

    def test_delete_plant_photos_target_does_not_exist(self):
        # Call delete_plant_photos endpoint with a photo that doesn't exist
        photo_key = 999
        response = self.client.post('/delete_plant_photos', {
            'plant_id': self.plant.uuid,
            'delete_photos': [photo_key]
        })

        # Confirm correct error
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"deleted": [], "failed": [photo_key]})

    def test_set_plant_default_photo(self):
        # Create mock photo, add to database
        mock_photo = create_mock_photo('2024:03:21 10:52:03')
        photo = Photo.objects.create(photo=mock_photo, plant=self.plant)

        # Confirm plant has no default_photo
        self.assertIsNone(self.plant.default_photo)

        # Post photo primary key to set_plant_default_photo endpoint
        response = self.client.post('/set_plant_default_photo', {
            'plant_id': str(self.plant.uuid),
            'photo_key': photo.pk
        })

        # Confirm response, confirm plant now has default_photo
        self.assertEqual(response.status_code, 200)
        self.plant.refresh_from_db()
        self.assertEqual(
            response.json(),
            {'default_photo': {
                'set': True,
                'timestamp': '2024-03-21T10:52:03+00:00',
                'photo': '/media/user_1/images/mock_photo.jpg',
                'thumbnail': '/media/user_1/thumbnails/mock_photo_thumb.webp',
                'preview': '/media/user_1/previews/mock_photo_preview.webp',
                'key': photo.pk
            }}
        )
        self.plant.refresh_from_db()
        self.assertEqual(self.plant.default_photo, photo)

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
            data={'plant_id': str(self.plant.uuid)},
            content_type=MULTIPART_CONTENT
        )
        self.assertEqual(response.status_code, 404)
        self.assertEqual(
            response.json(),
            {'error': 'no photos were sent'}
        )

    def test_set_non_existing_default_photo(self):
        # Post fake primary key to set_plant_default_photo endpoint
        response = self.client.post('/set_plant_default_photo', {
            'plant_id': str(self.plant.uuid),
            'photo_key': 1337
        })

        # Confirm error, confirm plant does not have default_photo
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json(), {"error": "unable to find photo"})
        self.plant.refresh_from_db()
        self.assertIsNone(self.plant.default_photo)

    def test_set_photo_of_wrong_plant_as_default_photo(self):
        # Create second plant entry + photo associated with second plant
        wrong_plant = Plant.objects.create(uuid=uuid4(), user=get_default_user())
        wrong_plant_photo = Photo.objects.create(
            photo=create_mock_photo('2024:02:21 10:52:03', 'IMG1.jpg'),
            plant=wrong_plant
        )
        wrong_plant_photo.save()

        # Post primary key of wrong photo to set_plant_default_photo endpoint
        response = self.client.post('/set_plant_default_photo', {
            'plant_id': str(self.plant.uuid),
            'photo_key': wrong_plant_photo.pk
        })

        # Confirm error, confirm plant does not have default_photo
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json(), {"error": "unable to find photo"})
        self.plant.refresh_from_db()
        self.assertIsNone(self.plant.default_photo)
