# pylint: disable=missing-docstring,too-many-lines,R0801

import os
import io
import sys
import json
import base64
import shutil
from uuid import uuid4
from datetime import datetime
from unittest.mock import patch

from django.conf import settings
from django.test import TestCase
from django.utils import timezone
from django.core.cache import cache
from django.test.client import RequestFactory, MULTIPART_CONTENT
from PIL import UnidentifiedImageError

from .views import render_react_app
from .view_decorators import get_default_user
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


class RenderReactAppTests(TestCase):
    def setUp(self):
        # Create GET request for mock endpoint
        factory = RequestFactory()
        self.request = factory.get('/mock')

        # Redirect stdout to variable
        self.stdout = io.StringIO()
        sys.stdout = self.stdout

    def tearDown(self):
        # Reset stdout redirect
        sys.stdout = sys.__stdout__

    def test_render_react_app_without_logging_state(self):
        # Call function with mock arguments and log_state set to False
        response = render_react_app(
            request=self.request,
            title='Mock Title',
            bundle='overview',
            state={
                'data': 'mock'
            },
            log_state=False
        )

        # Confirm returned status 200, confirm nothing was printed to stdout
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.stdout.getvalue(), '')

    def test_render_react_app_and_log_state(self):
        # Call function with mock arguments and log_state set to True
        response = render_react_app(
            request=self.request,
            title='Mock Title',
            bundle='overview',
            state={
                'data': 'mock'
            },
            log_state=True
        )

        # Confirm returned status 200 and pretty printed context to stdout
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            self.stdout.getvalue(),
            json.dumps({
                'title': 'Mock Title',
                'js_files': settings.PAGE_DEPENDENCIES['overview']['js'],
                'css_files': settings.PAGE_DEPENDENCIES['overview']['css'],
                'state': {
                    'data': 'mock'
                },
                'user_accounts_enabled': False
            }, indent=4) + '\n'
        )


class OverviewTests(TestCase):
    def setUp(self):
        # Set default content_type for post requests (avoid long lines)
        self.client = JSONClient()

    def test_overview_page_no_database_entries(self):
        # Request overview, confirm uses correct JS bundle and title
        response = self.client.get('/')
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'plant_tracker/index.html')
        self.assertEqual(
            response.context['js_files'],
            settings.PAGE_DEPENDENCIES['overview']['js']
        )
        self.assertEqual(response.context['title'], 'Plant Overview')

        # Confirm correct state object (no plants or groups in database)
        self.assertEqual(
            response.context['state'],
            {
                'plants': [],
                'groups': [],
                'show_archive': False
            }
        )

    def test_overview_page_with_database_entries(self):
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
            user=default_user, group=group
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

        # Request overview, confirm uses correct JS bundle and title
        response = self.client.get('/')
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'plant_tracker/index.html')
        self.assertEqual(
            response.context['js_files'],
            settings.PAGE_DEPENDENCIES['overview']['js']
        )
        self.assertEqual(response.context['title'], 'Plant Overview')

        # Confirm state object has details of all non-archived plants and groups,
        # does not contain archived plant and group
        state = response.context['state']
        self.assertEqual(
            state['plants'],
            [
                {
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
                    'last_fertilized': None
                },
                {
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
                    'last_fertilized': None
                }
            ]
        )
        self.assertEqual(
            state['groups'],
            [
                {
                    'uuid': str(group.uuid),
                    'created': group.created.isoformat(),
                    'archived': False,
                    'name': None,
                    'display_name': 'Unnamed group 1',
                    'location': None,
                    'description': None,
                    'plants': 1
                }
            ]
        )

    def test_overview_page_cached_state(self):
        # Cache arbitrary string as overview_state
        cache.set(f'overview_state_{get_default_user().pk}', 'cached')

        # Mock build_overview_state to return a different string
        with patch('plant_tracker.tasks.build_overview_state', return_value='built'):
            # Request overview page, confirm state was loaded from cache
            response = self.client.get('/')
            self.assertEqual(response.context['state'], 'cached')

        # Delete cached overview__state
        cache.delete(f'overview_state_{get_default_user().pk}')

        # Mock build_overview_state to return a different string
        with patch('plant_tracker.tasks.build_overview_state', return_value='built'):
            # Request overview page, confirm was built by calling mocked
            # function (failed to load from cache)
            response = self.client.get('/')
            self.assertEqual(response.context['state'], 'built')

    def test_get_overview_state(self):
        # Call get_overview_state endpoint, confirm returns overview state
        response = self.client.get('/get_overview_state')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {
                'plants': [],
                'groups': [],
                'show_archive': False
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

    def test_delete_plant(self):
        # Create test plant, confirm exists in database
        test_id = uuid4()
        Plant.objects.create(uuid=test_id, name='test plant', user=get_default_user())
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

    def test_archive_plant(self):
        # Create test plant, confirm exists in database, is not archived
        test_id = uuid4()
        Plant.objects.create(uuid=test_id, name='test plant', user=get_default_user())
        self.assertEqual(len(Plant.objects.all()), 1)
        self.assertFalse(Plant.objects.all()[0].archived)

        # Call archive endpoint, confirm response, confirm updated in database
        response = self.client.post('/archive_plant', {
            'plant_id': str(test_id),
            'archived': True
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'updated': str(test_id)})
        self.assertTrue(Plant.objects.all()[0].archived)

        # Call again to un-archive, confirm response, confirm updated in database
        response = self.client.post('/archive_plant', {
            'plant_id': str(test_id),
            'archived': False
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'updated': str(test_id)})
        self.assertFalse(Plant.objects.all()[0].archived)

    def test_archive_plant_error(self):
        # Create test plant, confirm exists in database, is not archived
        test_id = uuid4()
        Plant.objects.create(uuid=test_id, name='test plant', user=get_default_user())
        self.assertEqual(len(Plant.objects.all()), 1)
        self.assertFalse(Plant.objects.all()[0].archived)

        # Call archive endpoint with invalid archived bool, confirm error,
        # confirm database not updated
        response = self.client.post('/archive_plant', {
            'plant_id': str(test_id),
            'archived': 'archived'
        })
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"error": "archived key is not bool"})
        self.assertFalse(Plant.objects.all()[0].archived)

    def test_delete_group(self):
        # Create test group, confirm exists in database
        test_id = uuid4()
        Group.objects.create(uuid=test_id, name='test group', user=get_default_user())
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

    def test_archive_group(self):
        # Create test group, confirm exists in database, is not archived
        test_id = uuid4()
        Group.objects.create(uuid=test_id, name='test group', user=get_default_user())
        self.assertEqual(len(Group.objects.all()), 1)
        self.assertFalse(Group.objects.all()[0].archived)

        # Call archive endpoint, confirm response, confirm updated in database
        response = self.client.post('/archive_group', {
            'group_id': str(test_id),
            'archived': True
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'updated': str(test_id)})
        self.assertTrue(Group.objects.all()[0].archived)

        # Call again to un-archive, confirm response, confirm updated in database
        response = self.client.post('/archive_group', {
            'group_id': str(test_id),
            'archived': False
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'updated': str(test_id)})
        self.assertFalse(Group.objects.all()[0].archived)

    def test_archive_group_error(self):
        # Create test plant, confirm exists in database, is not archived
        test_id = uuid4()
        Group.objects.create(uuid=test_id, name='test group', user=get_default_user())
        self.assertEqual(len(Group.objects.all()), 1)
        self.assertFalse(Group.objects.all()[0].archived)

        # Call archive endpoint with invalid archived bool, confirm error,
        # confirm database not updated
        response = self.client.post('/archive_group', {
            'group_id': str(test_id),
            'archived': 'archived'
        })
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"error": "archived key is not bool"})
        self.assertFalse(Group.objects.all()[0].archived)

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

        # Attempt to delete non-existing plant, confirm error
        response = self.client.post('/bulk_delete_plants_and_groups', {
            'uuids': [str(plant_id)]
        })
        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.json(),
            {'deleted': [], 'failed': [str(plant_id)]}
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

        # Attempt to archive non-existing uuid, confirm error
        test_id = uuid4()
        response = self.client.post('/bulk_archive_plants_and_groups', {
            'uuids': [str(test_id)],
            'archived': True
        })
        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.json(),
            {'archived': [], 'failed': [str(test_id)]}
        )


class ArchivedOverviewTests(TestCase):
    def setUp(self):
        # Set default content_type for post requests (avoid long lines)
        self.client = JSONClient()

    def test_archived_overview_page_no_database_entries(self):
        # Request archived overview when no archived plants or groups exist
        response = self.client.get('/archived')

        # Confirm redirected to main overview
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.url, '/')

    def test_overview_page_with_database_entries(self):
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

        # Request archive overview, confirm uses correct JS bundle and title
        response = self.client.get('/archived')
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'plant_tracker/index.html')
        self.assertEqual(
            response.context['js_files'],
            settings.PAGE_DEPENDENCIES['overview']['js']
        )
        self.assertEqual(response.context['title'], 'Archived')

        # Confirm state object has details of all archived plants and groups,
        # does not contain non-archived plant and group
        state = response.context['state']
        self.assertEqual(
            state['plants'],
            [
                {
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
                    'last_fertilized': None
                }
            ]
        )
        self.assertEqual(
            state['groups'],
            [
                {
                    'uuid': str(group.uuid),
                    'created': group.created.isoformat(),
                    'archived': True,
                    'name': 'Archived group',
                    'display_name': 'Archived group',
                    'location': None,
                    'description': None,
                    'plants': 0
                }
            ]
        )


class RegistrationTests(TestCase):
    def setUp(self):
        # Set default content_type for post requests (avoid long lines)
        self.client = JSONClient()

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
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.url, f'/manage/{test_id}')

        # Confirm new plant exists in database, confirm no group was created
        self.assertEqual(len(Plant.objects.all()), 1)
        self.assertEqual(len(Group.objects.all()), 0)

        # Confirm plant has correct params, confirm extra spaces were removed
        plant = Plant.objects.get(uuid=test_id)
        self.assertEqual(plant.name, 'test plant')
        self.assertEqual(plant.species, 'Giant Sequoia')
        self.assertEqual(plant.description, '300 feet and a few thousand years old')
        self.assertEqual(plant.pot_size, 4)
        # Confirm plant is owned by default user
        self.assertEqual(plant.user, get_default_user())

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
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.url, f'/manage/{test_id}')

        # Confirm new group exists in database, confirm no plant was created
        self.assertEqual(len(Group.objects.all()), 1)
        self.assertEqual(len(Plant.objects.all()), 0)

        # Confirm group has correct params, confirm extra spaces were removed
        group = Group.objects.get(uuid=test_id)
        self.assertEqual(group.name, 'test group')
        self.assertEqual(group.location, 'top shelf')
        self.assertEqual(group.description, 'This group is used for propagation')
        # Confirm group is owned by default user
        self.assertEqual(group.user, get_default_user())

    def test_registration_page(self):
        # Request management page with uuid that doesn't exist in database
        response = self.client.get(f'/manage/{uuid4()}')

        # Confirm used register bundle and correct title
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'plant_tracker/index.html')
        self.assertEqual(
            response.context['js_files'],
            settings.PAGE_DEPENDENCIES['register']['js']
        )
        self.assertEqual(response.context['title'], 'Register New Plant')

    def test_registration_page_plant_species_options(self):
        # Request management page with uuid that doesn't exist in database
        response = self.client.get(f'/manage/{uuid4()}')

        # Confirm species_options list is empty (no plants in database)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.context['state']['species_options'], [])

        # Create 2 test plants with species set
        Plant.objects.create(uuid=uuid4(), species='Calathea', user=get_default_user())
        Plant.objects.create(uuid=uuid4(), species='Fittonia', user=get_default_user())

        # Reguest page again, confirm species_options contains both species
        response = self.client.get(f'/manage/{uuid4()}')
        self.assertIn('Calathea', response.context['state']['species_options'])
        self.assertIn('Fittonia', response.context['state']['species_options'])
        self.assertEqual(len(response.context['state']['species_options']), 2)


class ManagePageTests(TestCase):
    def setUp(self):
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

        # Confirm used manage_plant bundle and correct title
        self.assertTemplateUsed(response, 'plant_tracker/index.html')
        self.assertEqual(
            response.context['js_files'],
            settings.PAGE_DEPENDENCIES['manage_plant']['js']
        )
        self.assertEqual(response.context['title'], 'Manage Plant')

        # Confirm expected state object
        state = response.context['state']
        self.assertEqual(
            state['plant_details'],
            {
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
            }
        )
        self.assertEqual(
            state['events'],
            {
                'water': [],
                'fertilize': [],
                'prune': [],
                'repot': []
            }
        )

        # Confirm notes list is empty (test plant has no notes)
        self.assertEqual(state['notes'], [])

        # Confirm species_options list is empty (test plants have no species)
        self.assertEqual(state['species_options'], [])

        # Confirm photos list is empty (test plant has no photos)
        self.assertEqual(state['photos'], [])

        # Confirm group_options key contains details of all existing groups
        self.assertEqual(
            state['group_options'],
            [
                {
                    'name': None,
                    'display_name': 'Unnamed group 1',
                    'uuid': str(self.group1.uuid),
                    'created': self.group1.created.isoformat(),
                    'archived': False,
                    'location': None,
                    'description': None,
                    'plants': 0
                }
            ]
        )

    def test_manage_plant_with_photos(self):
        # Create mock photos for plant1
        Photo.objects.create(
            photo=create_mock_photo('2024:03:21 10:52:03', 'photo1.jpg'),
            plant=self.plant1
        )
        Photo.objects.create(
            photo=create_mock_photo('2024:03:22 10:52:03', 'photo2.jpg'),
            plant=self.plant1
        )

        # Request management page, confirm status
        response = self.client.get(f'/manage/{self.plant1.uuid}')
        self.assertEqual(response.status_code, 200)

        # Confirm plant.thumbnail contains URL of most recent photo
        self.assertEqual(
            response.context['state']['plant_details']['thumbnail'],
            '/media/thumbnails/photo2_thumb.jpg'
        )

        # Confirm photos key contains list of dicts with timestamps, database
        # keys, thumbnail URLs, and full-res URLs of each photo
        self.assertEqual(
            response.context['state']['photos'],
            [
                {
                    'timestamp': '2024-03-22T10:52:03+00:00',
                    'image': '/media/images/photo2.jpg',
                    'thumbnail': '/media/thumbnails/photo2_thumb.jpg',
                    'preview': '/media/previews/photo2_preview.jpg',
                    'key': 2
                },
                {
                    'timestamp': '2024-03-21T10:52:03+00:00',
                    'image': '/media/images/photo1.jpg',
                    'thumbnail': '/media/thumbnails/photo1_thumb.jpg',
                    'preview': '/media/previews/photo1_preview.jpg',
                    'key': 1
                },
            ]
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

        # Confirm notes list contains dicts with timestamp and text of both notes
        self.assertEqual(
            response.context['state']['notes'],
            [
                {
                    'text': 'Leaves drooping, needs to be watered more often',
                    'timestamp': '2024-02-06T03:06:26+00:00'
                },
                {
                    'text': 'Looks much better now',
                    'timestamp': '2024-02-16T03:06:26+00:00'
                }
            ]
        )

    def test_manage_plant_with_group(self):
        # Add test plant to group
        self.plant1.group = self.group1
        self.plant1.save()

        # Request management page, confirm status
        response = self.client.get(f'/manage/{self.plant1.uuid}')
        self.assertEqual(response.status_code, 200)

        # Confirm group key in plant state state contains group details
        self.assertEqual(
            response.context['state']['plant_details']['group'],
            {
                'name': self.group1.get_display_name(),
                'uuid': str(self.group1.uuid)
            }
        )

    def test_manage_plant_with_name(self):
        # Give plant1 a name
        self.plant1.name = 'Favorite Plant'
        self.plant1.save()

        # Request manage page, confirm display_name matches name attribute
        response = self.client.get(f'/manage/{self.plant1.uuid}')
        self.assertEqual(
            response.context['state']['plant_details']['display_name'],
            'Favorite Plant'
        )

    def test_manage_plant_with_species_options(self):
        # Add species to both plants
        self.plant1.species = 'Calathea'
        self.plant1.save()
        self.plant2.species = 'Fittonia'
        self.plant2.save()

        # Request manage page, confirm species_options contains both species
        response = self.client.get(f'/manage/{self.plant1.uuid}')
        self.assertIn('Calathea', response.context['state']['species_options'])
        self.assertIn('Fittonia', response.context['state']['species_options'])
        self.assertEqual(len(response.context['state']['species_options']), 2)

        # Save species_options
        plant1_species_options = response.context['state']['species_options']

        # Request manage oage for second plant, confirm identical species_options
        response = self.client.get(f'/manage/{self.plant2.uuid}')
        self.assertEqual(
            response.context['state']['species_options'],
            plant1_species_options
        )

    def test_get_plant_state(self):
        # Call get_plant_state endpoint with UUID of existing plant entry
        response = self.client.get(f'/get_plant_state/{self.plant1.uuid}')

        # Confirm returned full manage_plant state
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
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
                    'last_watered': None,
                    'last_fertilized': None,
                    'group': None,
                },
                'events': {
                    'water': [],
                    'fertilize': [],
                    'prune': [],
                    'repot': []
                },
                'notes': [],
                'photos': [],
                'default_photo': {
                    'set': False,
                    'timestamp': None,
                    'image': None,
                    'thumbnail': None,
                    'key': None
                },
                'group_options': [
                    {
                        'name': None,
                        'display_name': 'Unnamed group 1',
                        'uuid': str(self.group1.uuid),
                        'created': self.group1.created.isoformat(),
                        'archived': False,
                        'location': None,
                        'description': None,
                        'plants': 0
                    }
                ],
                'species_options': []
            }
        )

    def test_get_plant_state_invalid(self):
        # Call get_plant_state endpoint with UUID that doesn't exist in database
        response = self.client.get(f'/get_plant_state/{uuid4()}')

        # Confirmer returned expected error
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json(), {'Error': 'Plant not found'})

        # Call get_plant_state endpoint with non-UUID string
        response = self.client.get('/get_plant_state/plant1')

        # Confirmer returned expected error
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {'Error': 'Requires plant UUID'})

    def test_manage_group_with_no_plants(self):
        # Request management page for test group, confirm status
        response = self.client.get(f'/manage/{self.group1.uuid}')
        self.assertEqual(response.status_code, 200)

        # Confirm used manage_group bundle and correct title
        self.assertTemplateUsed(response, 'plant_tracker/index.html')
        self.assertEqual(
            response.context['js_files'],
            settings.PAGE_DEPENDENCIES['manage_group']['js']
        )
        self.assertEqual(response.context['title'], 'Manage Group')

        # Confirm expected state objects
        state = response.context['state']
        self.assertEqual(
            state['group'],
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
        self.assertEqual(state['details'], [])

        # Confirm options state contains params for all plants
        self.assertEqual(
            state['options'],
            [
                {
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
                    'thumbnail': None
                },
                {
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
                    'thumbnail': None
                }
            ]
        )

    def test_manage_group_with_plant(self):
        # Add test plant to group
        self.plant1.group = self.group1
        self.plant1.save()

        # Request management page for test group, confirm status
        response = self.client.get(f'/manage/{self.group1.uuid}')
        self.assertEqual(response.status_code, 200)

        # Confirm plants key in group state matches number of plants
        state = response.context['state']
        self.assertEqual(state['group']['plants'], 1)

        # Confirm details state contains params for plant in group
        self.assertEqual(
            state['details'],
            [{
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
                'last_fertilized': None
            }]
        )

    def test_get_group_state(self):
        # Create second group, add plant2
        group2 = Group.objects.create(uuid=uuid4(), user=get_default_user())
        self.plant2.group = group2
        self.plant2.save()

        # Call get_group_state endpoint with UUID of existing group entry
        response = self.client.get(f'/get_group_state/{self.group1.uuid}')

        # Confirm returned full manage_group state
        # Confirm options list does NOT contain plant2 (already in a group)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {
                'group': {
                    'uuid': str(self.group1.uuid),
                    'name': self.group1.name,
                    'created': self.group1.created.isoformat(),
                    'archived': False,
                    'location': None,
                    'description': None,
                    'display_name': 'Unnamed group 1',
                    'plants': 0
                },
                'details': [],
                'options': [
                    {
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
                        'thumbnail': None
                    }
                ]
            }
        )

    def test_get_group_state_invalid(self):
        # Call get_group_state endpoint with UUID that doesn't exist in database
        response = self.client.get(f'/get_group_state/{uuid4()}')

        # Confirmer returned expected error
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json(), {'Error': 'Group not found'})

        # Call get_group_state endpoint with non-UUID string
        response = self.client.get('/get_group_state/group1')

        # Confirmer returned expected error
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {'Error': 'Requires group UUID'})


class ManagePlantEndpointTests(TestCase):
    def setUp(self):
        # Set default content_type for post requests (avoid long lines)
        self.client = JSONClient()

        # Create test plant and group
        self.plant = Plant.objects.create(uuid=uuid4(), user=get_default_user())
        self.group = Group.objects.create(uuid=uuid4(), user=get_default_user())

    def _refresh_test_models(self):
        self.plant.refresh_from_db()
        self.group.refresh_from_db()

    def test_edit_plant_details(self):
        # Confirm test plant has no name or species
        self.assertIsNone(self.plant.name)
        self.assertIsNone(self.plant.species)

        # Send edit_plant request with leading/trailing spaces on some params
        response = self.client.post('/edit_plant', {
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
            {"action": "repot", "plant": str(self.plant.uuid)}
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


class ManageGroupEndpointTests(TestCase):
    def setUp(self):
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

        # Send edit_group request with leading/trailing spaces on some params
        response = self.client.post('/edit_group', {
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


class ChangeQrCodeTests(TestCase):
    '''Separate test case to prevent leftover cache breaking other tests'''

    def setUp(self):
        # Set default content_type for post requests (avoid long lines)
        self.client = JSONClient()

        # Create test plants and groups
        self.default_user = get_default_user()
        self.plant1 = Plant.objects.create(uuid=uuid4(), user=self.default_user)
        self.plant2 = Plant.objects.create(uuid=uuid4(), user=self.default_user)
        self.group1 = Group.objects.create(uuid=uuid4(), user=self.default_user)

        # Create fake UUID that doesn't exist in database
        self.fake_id = uuid4()

    def tearDown(self):
        # Clear cache after each test
        cache.delete(f'old_uuid_{self.default_user.pk}')

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

        # Confirm status code, correct bundle and title
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'plant_tracker/index.html')
        self.assertEqual(
            response.context['js_files'],
            settings.PAGE_DEPENDENCIES['confirm_new_qr_code']['js']
        )
        self.assertEqual(response.context['title'], 'Confirm new QR code')

        # Confirm state contains plant details and new UUID
        self.assertEqual(
            response.context['state'],
            {
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
                    'last_fertilized': None
                },
                'new_uuid': str(self.fake_id)
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
        response = self.client.get(f'/manage/{self.fake_id}')

        # Confirm status code, correct bundle and title
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'plant_tracker/index.html')
        self.assertEqual(
            response.context['js_files'],
            settings.PAGE_DEPENDENCIES['confirm_new_qr_code']['js']
        )
        self.assertEqual(response.context['title'], 'Confirm new QR code')

        # Confirm state contains plant details and new UUID
        self.assertEqual(
            response.context['state'],
            {
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

        # Request management page with new UUID (should return confirmation page)
        response = self.client.get(f'/manage/{self.fake_id}')
        self.assertEqual(
            response.context['js_files'],
            settings.PAGE_DEPENDENCIES['confirm_new_qr_code']['js']
        )

        # Request management page with existing plant UUID (should return manage_plant)
        response = self.client.get(f'/manage/{self.plant2.uuid}')
        self.assertEqual(
            response.context['js_files'],
            settings.PAGE_DEPENDENCIES['manage_plant']['js']
        )

        # Request management page with existing group UUID (should return manage_group)
        response = self.client.get(f'/manage/{self.group1.uuid}')
        self.assertEqual(
            response.context['js_files'],
            settings.PAGE_DEPENDENCIES['manage_group']['js']
        )

        # Request management page with UUID of plant waiting for new QR code,
        # should return manage_plant page like normal
        response = self.client.get(f'/manage/{self.plant1.uuid}')
        self.assertEqual(
            response.context['js_files'],
            settings.PAGE_DEPENDENCIES['manage_plant']['js']
        )

    def test_target_plant_deleted_before_confirmation_page_loaded(self):
        # Simulate user deleting plant before loading confirmation page
        # (must delete before caching because schedule_cached_state_update_patch
        # will clear entire cache immediately when Plant.delete hook is
        # triggered. In production this wouldn't happen for 30 seconds.)
        self.plant1.delete()
        cache.set(f'old_uuid_{self.default_user.pk}', str(self.plant1.uuid))
        self.assertIsNotNone(cache.get(f'old_uuid_{self.default_user.pk}'))

        # Request management page with new UUID (simulate user scanning new QR)
        response = self.client.get(f'/manage/{self.fake_id}')

        # Confirm redirected to registration page (old_uuid no longer exists)
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'plant_tracker/index.html')
        self.assertEqual(
            response.context['js_files'],
            settings.PAGE_DEPENDENCIES['register']['js']
        )
        self.assertEqual(response.context['title'], 'Register New Plant')

        # Confirm old_id cache was cleared
        self.assertIsNone(cache.get(f'old_uuid_{self.default_user.pk}'))


class PlantEventEndpointTests(TestCase):
    def setUp(self):
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
            {"action": "water", "plant": str(self.plant1.uuid)}
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
            {"action": "fertilize", "plant": str(self.plant1.uuid)}
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
            {"action": "prune", "plant": str(self.plant1.uuid)}
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
            {"action": "repot", "plant": str(self.plant1.uuid)}
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

        # Call delete_plant_event endpoint, confirm response
        response = self.client.post('/delete_plant_event', {
            'plant_id': self.plant1.uuid,
            'event_type': 'water',
            'timestamp': timestamp.isoformat()
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {"deleted": "water", "plant": str(self.plant1.uuid)}
        )

        # Confirm WaterEvent was deleted
        self.assertEqual(len(self.plant1.waterevent_set.all()), 0)

    def test_delete_plant_event_timestamp_does_not_exist(self):
        # Call delete_plant_event endpoint with a timestamp that doesn't exist
        response = self.client.post('/delete_plant_event', {
            'plant_id': self.plant1.uuid,
            'event_type': 'water',
            'timestamp': timezone.now().isoformat()
        })

        # Confirm correct error
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json(), {"error": "event not found"})

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
            'events': [
                {'type': 'water', 'timestamp': timestamp.isoformat()},
                {'type': 'fertilize', 'timestamp': timestamp.isoformat()},
                {'type': 'prune', 'timestamp': timestamp.isoformat()},
                {'type': 'repot', 'timestamp': timestamp.isoformat()},
            ]
        })

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

    def test_bulk_delete_plant_events_does_not_exist(self):
        # Post payload containing event that does not exist
        response = self.client.post('/bulk_delete_plant_events', {
            'plant_id': self.plant1.uuid,
            'events': [
                {'type': 'water', 'timestamp': '2024-04-19T00:13:37+00:00'}
            ]
        })

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
        WaterEvent.objects.create(plant=self.plant1, timestamp=timestamp)
        self.assertEqual(len(self.plant1.waterevent_set.all()), 1)

        # Post incomplete event dict to backend with missing timestamp key
        response = self.client.post('/bulk_delete_plant_events', {
            'plant_id': self.plant1.uuid,
            'events': [
                {'type': 'water'}
            ]
        })

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
        self.assertEqual(len(self.plant1.waterevent_set.all()), 1)


class NoteEventEndpointTests(TestCase):
    def setUp(self):
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
            {'error': 'note with same timestamp already exists'}
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
        self.assertEqual(response.status_code, 411)
        self.assertEqual(
            response.json(),
            {'error': 'note cannot be empty'}
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
        self.assertEqual(response.status_code, 411)
        self.assertEqual(
            response.json(),
            {'error': 'note cannot be empty'}
        )
        self.assertEqual(len(NoteEvent.objects.all()), 1)
        self.assertEqual(NoteEvent.objects.get(timestamp=timestamp).text, 'note')

    def test_delete_note_event(self):
        # Create NoteEvent, confirm exists
        timestamp = timezone.now()
        NoteEvent.objects.create(plant=self.plant, timestamp=timestamp, text="note")
        self.assertEqual(len(self.plant.noteevent_set.all()), 1)

        # Send delete_plant_note request, confirm response + event deleted
        response = self.client.post('/delete_plant_note', {
            'plant_id': self.plant.uuid,
            'timestamp': timestamp.isoformat()
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {"deleted": "note", "plant": str(self.plant.uuid)}
        )

        # Confirm NoteEvent was created
        self.assertEqual(len(self.plant.noteevent_set.all()), 0)

    def test_delete_note_event_target_does_not_exist(self):
        # Call delete_plant_note endpoint with a timestamp that doesn't exist
        response = self.client.post('/delete_plant_note', {
            'plant_id': self.plant.uuid,
            'timestamp': timezone.now().isoformat()
        })

        # Confirm correct error
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json(), {"error": "note not found"})


class PlantPhotoEndpointTests(TestCase):
    def setUp(self):
        # Set default content_type for post requests (avoid long lines)
        self.client = JSONClient()

        # Create test plant
        self.plant = Plant.objects.create(uuid=uuid4(), user=get_default_user())

    def tearDown(self):
        # Delete mock photos between tests to prevent duplicate names (django
        # appends random string to keep unique, which makes testing difficult)
        for i in os.listdir(os.path.join(settings.TEST_DIR, 'data', 'images', 'images')):
            os.remove(os.path.join(settings.TEST_DIR, 'data', 'images', 'images', i))
        for i in os.listdir(os.path.join(settings.TEST_DIR, 'data', 'images', 'thumbnails')):
            os.remove(os.path.join(settings.TEST_DIR, 'data', 'images', 'thumbnails', i))
        for i in os.listdir(os.path.join(settings.TEST_DIR, 'data', 'images', 'previews')):
            os.remove(os.path.join(settings.TEST_DIR, 'data', 'images', 'previews', i))

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
                    "image": "/media/images/mock_photo.jpg",
                    "thumbnail": "/media/thumbnails/mock_photo_thumb.jpg",
                    "preview": "/media/previews/mock_photo_preview.jpg",
                    "key": 1
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

        # Confirm Photo was added to database
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
        self.assertEqual(
            response.json(),
            {"default_photo": photo.get_thumbnail_url()}
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
