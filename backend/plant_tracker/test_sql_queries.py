'''Tests to confirm each endpoint makes the expected number of database queries.

The point of this is to detect when a commit causes dramatically more queries,
not to enforce a specific number (that can change during development as long as
it doesn't get out of control).
'''

# pylint: disable=missing-docstring,too-many-lines,R0801,too-many-public-methods

import shutil
from uuid import uuid4
from datetime import datetime
from contextlib import contextmanager

from django.conf import settings
from django.test import TestCase
from django.utils import timezone
from django.db import connections
from django.core.cache import cache
from django.contrib.auth import get_user_model
from django.test.client import MULTIPART_CONTENT
from django.test.utils import CaptureQueriesContext

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
from .build_states import build_overview_state
from .view_decorators import get_default_user, events_map
from .unit_test_helpers import JSONClient, create_mock_photo

user_model = get_user_model()


def tearDownModule():
    # Delete mock photo directory after tests
    print("\nDeleting mock photos...\n")
    shutil.rmtree(settings.TEST_DIR, ignore_errors=True)


class SqlQueriesPerPageTests(TestCase):
    fixtures = ['fixtures/unnamed_plants_and_groups_fixture.json']

    @classmethod
    def setUpClass(cls):
        super().setUpClass()

        # Save default user to use in tests
        cls.default_user = get_default_user()

    def setUp(self):
        # Clear cache before each test
        cache.clear()

    @contextmanager
    def assertNumQueries(self, *args, **kwargs):
        '''Clears get_default_user cache to avoid unpredictable number of
        queries if get_default_user was called during setup, then calls upstream
        assertNumQueries.
        '''
        get_default_user.cache_clear()
        with super().assertNumQueries(*args, **kwargs):
            yield

    def test_overview_page(self):
        '''Loading the overview should make:
        - 4 queries when no Plants are in Groups (and no cached state exists)
        - 5 queries when >=1 Plant is in a Group (and no cached state exists)
        - 1 query if a cached state exists
        '''

        # Load with no cache and no plants in groups, confirm 4 queries
        cache.clear()
        with self.assertNumQueries(4):
            response = self.client.get('/')
            self.assertEqual(response.status_code, 200)

        # Add plant to group, load again, confirm 5 queries
        plant = Plant.objects.all()[0]
        plant.group = Group.objects.all()[0]
        plant.save()
        cache.clear()
        with self.assertNumQueries(5):
            response = self.client.get('/')
            self.assertEqual(response.status_code, 200)

        # Load again (cached state now exists), confirm 1 query
        with self.assertNumQueries(1):
            response = self.client.get('/')
            self.assertEqual(response.status_code, 200)

    def test_get_overview_page_state(self):
        '''Requesting the overview page state should make:
        - 4 queries when no Plants are in Groups (and no cached state exists)
        - 5 queries when >=1 Plant is in a Group (and no cached state exists)
        - 1 query if a cached state exists
        '''

        # Load with no cache and no plants in groups, confirm 4 queries
        cache.clear()
        with self.assertNumQueries(4):
            response = self.client.get('/get_overview_state')
            self.assertEqual(response.status_code, 200)

        # Add plant to group, load again, confirm 5 queries
        plant = Plant.objects.all()[0]
        plant.group = Group.objects.all()[0]
        plant.save()
        cache.clear()
        with self.assertNumQueries(5):
            response = self.client.get('/get_overview_state')
            self.assertEqual(response.status_code, 200)

        # Load again (cached state now exists), confirm 1 query
        with self.assertNumQueries(1):
            response = self.client.get('/get_overview_state')
            self.assertEqual(response.status_code, 200)

    def test_archived_overview_page(self):
        '''Loading the archived overview should make:
        - 4 queries when no archived Plants are in Groups
        - 5 queries when >=1 archived Plant is in a Group
        '''

        # Archive 1 plant and 1 group
        plant = Plant.objects.all()[0]
        group = Group.objects.all()[0]
        plant.archived = True
        group.archived = True
        plant.save()
        group.save()

        # Load with no cache and no plants in groups, confirm 4 queries
        with self.assertNumQueries(4):
            response = self.client.get('/archived')
            self.assertEqual(response.status_code, 200)

        # Add plant to group, load again, confirm 5 queries
        plant.group = group
        plant.save()
        with self.assertNumQueries(5):
            response = self.client.get('/archived')
            self.assertEqual(response.status_code, 200)

    def test_manage_plant_page(self):
        '''Loading a manage_plant page should make:
        - 7 queries if Plant is unnamed (has to get unnamed_index)
        - 6 queries if Plant is named (no extra query for name)
        '''
        plant = Plant.objects.all()[0]

        with self.assertNumQueries(7):
            response = self.client.get(f'/manage/{plant.uuid}')
            self.assertEqual(response.status_code, 200)

        plant.name = 'has name'
        plant.save()

        with self.assertNumQueries(6):
            response = self.client.get(f'/manage/{plant.uuid}')
            self.assertEqual(response.status_code, 200)

    def test_get_plant_state(self):
        '''Requesting the manage plant state should make:
        - 6 queries if Plant is unnamed (has to get unnamed_index)
        - 5 queries if Plant is named (no extra query for name)
        '''
        plant = Plant.objects.all()[0]

        with self.assertNumQueries(6):
            response = self.client.get(f'/get_plant_state/{plant.uuid}')
            self.assertEqual(response.status_code, 200)

        plant.name = 'has name'
        plant.save()

        with self.assertNumQueries(5):
            response = self.client.get(f'/get_plant_state/{plant.uuid}')
            self.assertEqual(response.status_code, 200)

    def test_manage_group_page(self):
        '''Loading a manage_group page should make:
        - 5 queries if Group is unnamed (has to get unnamed_index)
        - 4 queries if Group is named (no extra query for name)
        '''
        group = Group.objects.all()[0]
        with self.assertNumQueries(5):
            response = self.client.get(f'/manage/{group.uuid}')
            self.assertEqual(response.status_code, 200)

        group.name = 'has name'
        group.save()

        with self.assertNumQueries(4):
            response = self.client.get(f'/manage/{group.uuid}')
            self.assertEqual(response.status_code, 200)

    def test_get_group_state(self):
        '''Requesting the manage group state should make:
        - 4 queries if Group is unnamed (has to get unnamed_index)
        - 3 queries if Group is named (no extra query for name)
        '''
        group = Group.objects.all()[0]

        with self.assertNumQueries(4):
            response = self.client.get(f'/get_group_state/{group.uuid}')
            self.assertEqual(response.status_code, 200)

        group.name = 'has name'
        group.save()

        with self.assertNumQueries(3):
            response = self.client.get(f'/get_group_state/{group.uuid}')
            self.assertEqual(response.status_code, 200)

    def test_registration_page(self):
        '''Requesting the registration page should make 2 database queries.'''
        with self.assertNumQueries(2):
            response = self.client.get(f'/manage/{uuid4()}')
            self.assertEqual(response.status_code, 200)

    def test_registration_page_changing_plant_qr_code(self):
        '''Requesting the registration page should make 5 database queries when
        changing Plant QR code is in progress.
        '''
        cache.set(
            f'old_uuid_{get_default_user().pk}',
            str(Plant.objects.all()[0].uuid)
        )
        with self.assertNumQueries(5):
            response = self.client.get(f'/manage/{uuid4()}')
            self.assertEqual(response.status_code, 200)

    def test_registration_page_changing_group_qr_code(self):
        '''Requesting the registration page should make 4 database queries when
        changing Group QR code is in progress.
        '''
        cache.set(
            f'old_uuid_{get_default_user().pk}',
            str(Group.objects.all()[0].uuid)
        )
        with self.assertNumQueries(4):
            response = self.client.get(f'/manage/{uuid4()}')
            self.assertEqual(response.status_code, 200)

    def test_registration_page_dividing_plant(self):
        '''Requesting the registration page should make 4 database queries when
        dividing Plant is in progress.
        '''
        plant = Plant.objects.all()[0]
        event = DivisionEvent.objects.create(
            plant=plant,
            timestamp=timezone.now()
        )
        cache.set(f'division_in_progress_{get_default_user().pk}', {
            'divided_from_plant_uuid': str(plant.uuid),
            'division_event_key': str(event.pk)
        })
        with self.assertNumQueries(4):
            response = self.client.get(f'/manage/{uuid4()}')
            self.assertEqual(response.status_code, 200)

    def test_registration_page_dividing_plant_and_changing_qr_code(self):
        '''Requesting the registration page should make 7 database queries when
        dividing Plant and changing Plant QR code are both in progress.
        '''
        plant = Plant.objects.all()[0]
        event = DivisionEvent.objects.create(
            plant=plant,
            timestamp=timezone.now()
        )
        cache.set(f'division_in_progress_{get_default_user().pk}', {
            'divided_from_plant_uuid': str(plant.uuid),
            'division_event_key': str(event.pk)
        })
        cache.set(f'old_uuid_{get_default_user().pk}', str(plant.uuid))
        with self.assertNumQueries(7):
            response = self.client.get(f'/manage/{uuid4()}')
            self.assertEqual(response.status_code, 200)

    def test_get_plant_species_options_endpoint(self):
        '''/get_plant_species_options should make 1 database query.'''
        with self.assertNumQueries(1):
            response = self.client.get('/get_plant_species_options')
            self.assertEqual(response.status_code, 200)

    def test_get_plant_options_endpoint(self):
        '''/get_plant_options should make 2 database queries.'''
        with self.assertNumQueries(2):
            response = self.client.get('/get_plant_options')
            self.assertEqual(response.status_code, 200)

    def test_get_add_to_group_options_endpoint(self):
        '''/get_add_to_group_options should make 2 database queries.'''
        with self.assertNumQueries(2):
            response = self.client.get('/get_add_to_group_options')
            self.assertEqual(response.status_code, 200)


class SqlQueriesPerViewTests(TestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()

        # Save default user to use in tests
        cls.default_user = get_default_user()

        # Make sure overview state is cached (avoid full build when updated)
        build_overview_state(cls.default_user)

    def setUp(self):
        # Clear cached user instance
        get_default_user.cache_clear()

        # Set default content_type for post requests (avoid long lines)
        self.client = JSONClient()

    @contextmanager
    def assertNumQueries(self, *args, **kwargs):
        '''Emulates upstream assertNumQueries but filters out savepoint queries
        added by thest test framework (doesn't exist in production). Clears
        get_default_user cache to avoid unpredictable number of queries if
        get_default_user was called during setup.
        '''
        get_default_user.cache_clear()

        # Measure queries
        conn = connections[kwargs.pop('using', None) or 'default']
        with CaptureQueriesContext(conn) as ctx:
            yield

        # Filter out savepoint/release queries
        filtered = [
            q for q in ctx.captured_queries
            if not (
                q['sql'].startswith('SAVEPOINT') or
                q['sql'].startswith('RELEASE SAVEPOINT') or
                q['sql'].startswith('ROLLBACK TO SAVEPOINT')
            )
        ]

        # Raise exception if unexpected number of queries
        expected = args[0] if args else kwargs.get('num')
        actual = len(filtered)
        if actual != expected:
            # Build error message qith actual recorded queries
            lines = ["Captured queries were:"]
            for i, q in enumerate(filtered, start=1):
                lines.append(f"{i}. {q['sql']}")
            raise self.failureException(
                f"{actual} != {expected} : {actual} queries executed, {expected} expected\n"
                + "\n".join(lines)
            )

    def test_get_qr_codes(self):
        '''/get_qr_codes should not query the database.'''
        with self.assertNumQueries(0):
            settings.URL_PREFIX = 'mysite.com'
            response = self.client.post('/get_qr_codes', {'qr_per_row': 8})
            self.assertEqual(response.status_code, 200)

    def test_register_plant_endpoint(self):
        '''/register_plant should make 2 database queries.'''
        with self.assertNumQueries(2):
            response = self.client.post('/register_plant', {
                'uuid': uuid4(),
                'name': 'test plant',
                'species': 'Giant Sequoia',
                'description': '300 feet and a few thousand years old',
                'pot_size': '4'
            })
            self.assertEqual(response.status_code, 302)

    def test_register_group_endpoint(self):
        '''/register_group should make 2 database queries.'''
        with self.assertNumQueries(2):
            response = self.client.post('/register_group', {
                'uuid': uuid4(),
                'name': '    test group',
                'location': 'top shelf    ',
                'description': 'This group is used for propagation'
            })
            self.assertEqual(response.status_code, 302)

    def test_change_qr_code_endpoint_plant(self):
        '''/change_qr_code should make 3 database queries when target is Plant.'''
        plant = Plant.objects.create(uuid=uuid4(), user=get_default_user())
        with self.assertNumQueries(3):
            response = self.client.post('/change_qr_code', {
                'uuid': str(plant.uuid)
            })
            self.assertEqual(response.status_code, 200)

    def test_change_qr_code_endpoint_group(self):
        '''/change_qr_code should make 3 database queries when target is Group.'''
        group = Group.objects.create(uuid=uuid4(), user=get_default_user())
        with self.assertNumQueries(3):
            response = self.client.post('/change_qr_code', {
                'uuid': str(group.uuid)
            })
            self.assertEqual(response.status_code, 200)

    def test_change_uuid_endpoint_plant(self):
        '''/change_uuid should make 4 database queries when target is Plant.'''
        plant = Plant.objects.create(uuid=uuid4(), user=get_default_user())
        cache.set(f'old_uuid_{plant.user.pk}', str(plant.uuid))
        with self.assertNumQueries(4):
            response = self.client.post('/change_uuid', {
                'uuid': str(plant.uuid),
                'new_id': str(uuid4())
            })
            self.assertEqual(response.status_code, 200)

    def test_change_uuid_endpoint_group(self):
        '''/change_uuid should make 4 database queries when target is Group.'''
        group = Group.objects.create(uuid=uuid4(), user=get_default_user())
        cache.set(f'old_uuid_{group.user.pk}', str(group.uuid))
        with self.assertNumQueries(4):
            response = self.client.post('/change_uuid', {
                'uuid': str(group.uuid),
                'new_id': str(uuid4())
            })
            self.assertEqual(response.status_code, 200)

    def test_edit_plant_endpoint(self):
        '''/edit_plant should make 3 database queries.'''
        plant = Plant.objects.create(uuid=uuid4(), user=get_default_user())
        with self.assertNumQueries(3):
            response = self.client.post('/edit_plant', {
                'plant_id': plant.uuid,
                'name': 'test plant',
                'species': 'Giant Sequoia',
                'description': '300 feet and a few thousand years old',
                'pot_size': '4'
            })
            self.assertEqual(response.status_code, 200)

    def test_edit_group_endpoint(self):
        '''/edit_group should make 3 database queries.'''
        group = Group.objects.create(uuid=uuid4(), user=get_default_user())
        with self.assertNumQueries(3):
            response = self.client.post('/edit_group', {
                'group_id': group.uuid,
                'name': 'test group    ',
                'location': '    middle shelf',
                'description': 'This group is used for propagation'
            })
            self.assertEqual(response.status_code, 200)

    def test_bulk_delete_plants_and_groups_endpoint_1_plant(self):
        '''/bulk_delete_plants_and_groups should make 13 database queries when
        deleting a single Plant instance.
        '''
        plant = Plant.objects.create(uuid=uuid4(), user=get_default_user())
        with self.assertNumQueries(13):
            response = self.client.post('/bulk_delete_plants_and_groups', {
                'uuids': [str(plant.uuid)]
            })
            self.assertEqual(response.status_code, 200)

    def test_bulk_delete_plants_and_groups_endpoint_3_plants(self):
        '''/bulk_delete_plants_and_groups should make 13 database queries when
        deleting 3 Plant instances.
        '''
        plant1 = Plant.objects.create(uuid=uuid4(), user=get_default_user())
        plant2 = Plant.objects.create(uuid=uuid4(), user=get_default_user())
        plant3 = Plant.objects.create(uuid=uuid4(), user=get_default_user())
        with self.assertNumQueries(13):
            response = self.client.post('/bulk_delete_plants_and_groups', {
                'uuids': [
                    str(plant1.uuid),
                    str(plant2.uuid),
                    str(plant3.uuid)
                ]
            })
            self.assertEqual(response.status_code, 200)

    def test_bulk_delete_plants_and_groups_endpoint_1_group(self):
        '''/bulk_delete_plants_and_groups should make 6 database queries when
        deleting a single Group instance.
        '''
        group = Group.objects.create(uuid=uuid4(), user=get_default_user())
        with self.assertNumQueries(6):
            response = self.client.post('/bulk_delete_plants_and_groups', {
                'uuids': [str(group.uuid)]
            })
            self.assertEqual(response.status_code, 200)

    def test_bulk_delete_plants_and_groups_endpoint_3_groups(self):
        '''/bulk_delete_plants_and_groups should make 6 database queries when
        deleting 3 Group instances.
        '''
        group1 = Group.objects.create(uuid=uuid4(), user=get_default_user())
        group2 = Group.objects.create(uuid=uuid4(), user=get_default_user())
        group3 = Group.objects.create(uuid=uuid4(), user=get_default_user())
        with self.assertNumQueries(6):
            response = self.client.post('/bulk_delete_plants_and_groups', {
                'uuids': [
                    str(group1.uuid),
                    str(group2.uuid),
                    str(group3.uuid)
                ]
            })
            self.assertEqual(response.status_code, 200)

    def test_bulk_delete_plants_and_groups_endpoint_3_plants_3_groups(self):
        '''/bulk_delete_plants_and_groups should make 16 database queries when
        deleting 3 plant instances and 3 Group instances.
        '''
        plant1 = Plant.objects.create(uuid=uuid4(), user=get_default_user())
        plant2 = Plant.objects.create(uuid=uuid4(), user=get_default_user())
        plant3 = Plant.objects.create(uuid=uuid4(), user=get_default_user())
        group1 = Group.objects.create(uuid=uuid4(), user=get_default_user())
        group2 = Group.objects.create(uuid=uuid4(), user=get_default_user())
        group3 = Group.objects.create(uuid=uuid4(), user=get_default_user())
        with self.assertNumQueries(16):
            response = self.client.post('/bulk_delete_plants_and_groups', {
                'uuids': [
                    str(plant1.uuid),
                    str(plant2.uuid),
                    str(plant3.uuid),
                    str(group1.uuid),
                    str(group2.uuid),
                    str(group3.uuid)
                ]
            })
            self.assertEqual(response.status_code, 200)

    def test_bulk_archive_plants_and_groups_endpoint_1_plant(self):
        '''/bulk_archive_plants_and_groups should make 4 database queries when
        archiving a single Plant instance.
        '''
        plant = Plant.objects.create(uuid=uuid4(), user=get_default_user())
        with self.assertNumQueries(4):
            response = self.client.post('/bulk_archive_plants_and_groups', {
                'uuids': [str(plant.uuid)],
                'archived': True
            })
            self.assertEqual(response.status_code, 200)

    def test_bulk_archive_plants_and_groups_endpoint_3_plants(self):
        '''/bulk_archive_plants_and_groups should make 4 database queries when
        archiving 3 Plant instances.
        '''
        plant1 = Plant.objects.create(uuid=uuid4(), user=get_default_user())
        plant2 = Plant.objects.create(uuid=uuid4(), user=get_default_user())
        plant3 = Plant.objects.create(uuid=uuid4(), user=get_default_user())
        with self.assertNumQueries(4):
            response = self.client.post('/bulk_archive_plants_and_groups', {
                'uuids': [
                    str(plant1.uuid),
                    str(plant2.uuid),
                    str(plant3.uuid)
                ],
                'archived': True
            })
            self.assertEqual(response.status_code, 200)

    def test_bulk_archive_plants_and_groups_endpoint_1_group(self):
        '''/bulk_archive_plants_and_groups should make 4 database queries when
        archiving a single Group instance.
        '''
        group = Group.objects.create(uuid=uuid4(), user=get_default_user())
        with self.assertNumQueries(4):
            response = self.client.post('/bulk_archive_plants_and_groups', {
                'uuids': [str(group.uuid)],
                'archived': True
            })
            self.assertEqual(response.status_code, 200)

    def test_bulk_archive_plants_and_groups_endpoint_3_groups(self):
        '''/bulk_archive_plants_and_groups should make 4 database queries when
        archiving 3 Group instances.
        '''
        group1 = Group.objects.create(uuid=uuid4(), user=get_default_user())
        group2 = Group.objects.create(uuid=uuid4(), user=get_default_user())
        group3 = Group.objects.create(uuid=uuid4(), user=get_default_user())
        with self.assertNumQueries(4):
            response = self.client.post('/bulk_archive_plants_and_groups', {
                'uuids': [
                    str(group1.uuid),
                    str(group2.uuid),
                    str(group3.uuid)
                ],
                'archived': True
            })
            self.assertEqual(response.status_code, 200)

    def test_bulk_archive_plants_and_groups_endpoint_3_plants_3_groups(self):
        '''/bulk_archive_plants_and_groups should make 5 database queries when
        archiving 3 plant instances and 3 Group instances.
        '''
        plant1 = Plant.objects.create(uuid=uuid4(), user=get_default_user())
        plant2 = Plant.objects.create(uuid=uuid4(), user=get_default_user())
        plant3 = Plant.objects.create(uuid=uuid4(), user=get_default_user())
        group1 = Group.objects.create(uuid=uuid4(), user=get_default_user())
        group2 = Group.objects.create(uuid=uuid4(), user=get_default_user())
        group3 = Group.objects.create(uuid=uuid4(), user=get_default_user())
        with self.assertNumQueries(5):
            response = self.client.post('/bulk_archive_plants_and_groups', {
                'uuids': [
                    str(plant1.uuid),
                    str(plant2.uuid),
                    str(plant3.uuid),
                    str(group1.uuid),
                    str(group2.uuid),
                    str(group3.uuid)
                ],
                'archived': True
            })
            self.assertEqual(response.status_code, 200)

    def test_add_plant_event_endpoint_water(self):
        '''/add_plant_event should make 5 database queries when creating WaterEvent.'''
        plant = Plant.objects.create(uuid=uuid4(), user=get_default_user())
        with self.assertNumQueries(4):
            response = self.client.post('/add_plant_event', {
                'plant_id': plant.uuid,
                'event_type': 'water',
                'timestamp': '2024-02-06T03:06:26.000Z'
            })
            self.assertEqual(response.status_code, 200)

    def test_add_plant_event_endpoint_fertilize(self):
        '''/add_plant_event should make 4 database queries when creating FertilizeEvent.'''
        plant = Plant.objects.create(uuid=uuid4(), user=get_default_user())
        with self.assertNumQueries(4):
            response = self.client.post('/add_plant_event', {
                'plant_id': plant.uuid,
                'event_type': 'fertilize',
                'timestamp': '2024-02-06T03:06:26.000Z'
            })
            self.assertEqual(response.status_code, 200)

    def test_add_plant_event_endpoint_prune(self):
        '''/add_plant_event should make 3 database queries when creating PruneEvent.'''
        plant = Plant.objects.create(uuid=uuid4(), user=get_default_user())
        with self.assertNumQueries(3):
            response = self.client.post('/add_plant_event', {
                'plant_id': plant.uuid,
                'event_type': 'prune',
                'timestamp': '2024-02-06T03:06:26.000Z'
            })
            self.assertEqual(response.status_code, 200)

    def test_add_plant_event_endpoint_repot(self):
        '''/add_plant_event should make 3 database queries when creating RepotEvent.'''
        plant = Plant.objects.create(uuid=uuid4(), user=get_default_user())
        with self.assertNumQueries(3):
            response = self.client.post('/add_plant_event', {
                'plant_id': plant.uuid,
                'event_type': 'repot',
                'timestamp': '2024-02-06T03:06:26.000Z'
            })
            self.assertEqual(response.status_code, 200)

    def test_bulk_add_plant_events_endpoint_water(self):
        '''/bulk_add_plant_events should make 3 database queries when creating
        WaterEvents regardless of the number of events.
        '''
        plant1 = Plant.objects.create(uuid=uuid4(), user=get_default_user())
        plant2 = Plant.objects.create(uuid=uuid4(), user=get_default_user())
        plant3 = Plant.objects.create(uuid=uuid4(), user=get_default_user())

        # Confirm 3 queries with just 1 plant
        with self.assertNumQueries(3):
            response = self.client.post('/bulk_add_plant_events', {
                'plants': [
                    str(plant1.uuid),
                ],
                'event_type': 'water',
                'timestamp': '2024-02-06T03:06:26.000Z'
            })
            self.assertEqual(response.status_code, 200)

        # Confirm 5 queries with all 3 plants
        with self.assertNumQueries(3):
            response = self.client.post('/bulk_add_plant_events', {
                'plants': [
                    str(plant1.uuid),
                    str(plant2.uuid),
                    str(plant3.uuid),
                ],
                'event_type': 'water',
                'timestamp': '2024-02-06T03:06:26.000Z'
            })
            self.assertEqual(response.status_code, 200)

    def test_bulk_add_plant_events_endpoint_fertilize(self):
        '''/bulk_add_plant_events should make 3 database queries when creating
        FertilizeEvents regardless of the number of events.
        '''
        plant1 = Plant.objects.create(uuid=uuid4(), user=get_default_user())
        plant2 = Plant.objects.create(uuid=uuid4(), user=get_default_user())
        plant3 = Plant.objects.create(uuid=uuid4(), user=get_default_user())

        # Confirm 3 queries with just 1 plant
        with self.assertNumQueries(3):
            response = self.client.post('/bulk_add_plant_events', {
                'plants': [
                    str(plant1.uuid),
                ],
                'event_type': 'fertilize',
                'timestamp': '2024-02-06T03:06:26.000Z'
            })
            self.assertEqual(response.status_code, 200)

        # Confirm 5 queries with all 3 plants
        with self.assertNumQueries(3):
            response = self.client.post('/bulk_add_plant_events', {
                'plants': [
                    str(plant1.uuid),
                    str(plant2.uuid),
                    str(plant3.uuid),
                ],
                'event_type': 'fertilize',
                'timestamp': '2024-02-06T03:06:26.000Z'
            })
            self.assertEqual(response.status_code, 200)

    def test_bulk_add_plant_events_endpoint_prune(self):
        '''/bulk_add_plant_events should make 3 database queries when creating
        PruneEvents regardless of the number of events.
        '''
        plant1 = Plant.objects.create(uuid=uuid4(), user=get_default_user())
        plant2 = Plant.objects.create(uuid=uuid4(), user=get_default_user())
        plant3 = Plant.objects.create(uuid=uuid4(), user=get_default_user())

        # Confirm 2 queries with just 1 plant
        with self.assertNumQueries(3):
            response = self.client.post('/bulk_add_plant_events', {
                'plants': [
                    str(plant1.uuid),
                ],
                'event_type': 'prune',
                'timestamp': '2024-02-06T03:06:26.000Z'
            })
            self.assertEqual(response.status_code, 200)

        # Confirm 3 queries with all 3 plants
        with self.assertNumQueries(3):
            response = self.client.post('/bulk_add_plant_events', {
                'plants': [
                    str(plant1.uuid),
                    str(plant2.uuid),
                    str(plant3.uuid),
                ],
                'event_type': 'prune',
                'timestamp': '2024-02-06T03:06:26.000Z'
            })
            self.assertEqual(response.status_code, 200)

    def test_bulk_delete_plant_events_endpoint_water(self):
        '''/bulk_delete_plant_events should make 5 database queries when
        deleting any number of WaterEvents.
        '''
        plant = Plant.objects.create(uuid=uuid4(), user=get_default_user())
        timestamp1 = '2024-04-19T00:13:37+00:00'
        timestamp2 = '2024-04-20T00:13:37+00:00'
        timestamp3 = '2024-04-21T00:13:37+00:00'
        WaterEvent.objects.create(plant=plant, timestamp=datetime.fromisoformat(
            timestamp1
        ))
        WaterEvent.objects.create(plant=plant, timestamp=datetime.fromisoformat(
            timestamp2
        ))
        WaterEvent.objects.create(plant=plant, timestamp=datetime.fromisoformat(
            timestamp3
        ))

        # Confirm 5 database queries when 1 WaterEvent deleted
        with self.assertNumQueries(5):
            response = self.client.post('/bulk_delete_plant_events', {
                'plant_id': plant.uuid,
                'events': {
                    'water': [timestamp1],
                    'fertilize': [],
                    'prune': [],
                    'repot': [],
                }
            })
            self.assertEqual(response.status_code, 200)

        # Confirm 5 database queries when 2 WaterEvents deleted
        with self.assertNumQueries(5):
            response = self.client.post('/bulk_delete_plant_events', {
                'plant_id': plant.uuid,
                'events': {
                    'water': [
                        timestamp2,
                        timestamp3
                    ],
                    'fertilize': [],
                    'prune': [],
                    'repot': [],
                }
            })
            self.assertEqual(response.status_code, 200)

    def test_bulk_delete_plant_events_endpoint_fertilize(self):
        '''/bulk_delete_plant_events should make 5 database queries when
        deleting any number of FertilizeEvents.
        '''
        plant = Plant.objects.create(uuid=uuid4(), user=get_default_user())
        timestamp1 = '2024-04-19T00:13:37+00:00'
        timestamp2 = '2024-04-20T00:13:37+00:00'
        timestamp3 = '2024-04-21T00:13:37+00:00'
        FertilizeEvent.objects.create(plant=plant, timestamp=datetime.fromisoformat(
            timestamp1
        ))
        FertilizeEvent.objects.create(plant=plant, timestamp=datetime.fromisoformat(
            timestamp2
        ))
        FertilizeEvent.objects.create(plant=plant, timestamp=datetime.fromisoformat(
            timestamp3
        ))

        # Confirm 5 database queries when 1 FertilizeEvent deleted
        with self.assertNumQueries(5):
            response = self.client.post('/bulk_delete_plant_events', {
                'plant_id': plant.uuid,
                'events': {
                    'water': [],
                    'fertilize': [timestamp1],
                    'prune': [],
                    'repot': [],
                }
            })
            self.assertEqual(response.status_code, 200)

        # Confirm 5 database queries when 2 FertilizeEvents deleted
        with self.assertNumQueries(5):
            response = self.client.post('/bulk_delete_plant_events', {
                'plant_id': plant.uuid,
                'events': {
                    'water': [],
                    'fertilize': [
                        timestamp2,
                        timestamp3
                    ],
                    'prune': [],
                    'repot': [],
                }
            })
            self.assertEqual(response.status_code, 200)

    def test_bulk_delete_plant_events_endpoint_prune(self):
        '''/bulk_delete_plant_events should make 4 database queries when
        deleting any number of PruneEvents.
        '''
        plant = Plant.objects.create(uuid=uuid4(), user=get_default_user())
        timestamp1 = '2024-04-19T00:13:37+00:00'
        timestamp2 = '2024-04-20T00:13:37+00:00'
        timestamp3 = '2024-04-21T00:13:37+00:00'
        PruneEvent.objects.create(plant=plant, timestamp=datetime.fromisoformat(
            timestamp1
        ))
        PruneEvent.objects.create(plant=plant, timestamp=datetime.fromisoformat(
            timestamp2
        ))
        PruneEvent.objects.create(plant=plant, timestamp=datetime.fromisoformat(
            timestamp3
        ))

        # Confirm 4 database queries when 1 PruneEvent deleted
        with self.assertNumQueries(4):
            response = self.client.post('/bulk_delete_plant_events', {
                'plant_id': plant.uuid,
                'events': {
                    'water': [],
                    'fertilize': [],
                    'prune': [timestamp1],
                    'repot': [],
                }
            })
            self.assertEqual(response.status_code, 200)

        # Confirm 4 database queries when 2 PruneEvents deleted
        with self.assertNumQueries(4):
            response = self.client.post('/bulk_delete_plant_events', {
                'plant_id': plant.uuid,
                'events': {
                    'water': [],
                    'fertilize': [],
                    'prune': [
                        timestamp2,
                        timestamp3
                    ],
                    'repot': [],
                }
            })
            self.assertEqual(response.status_code, 200)

    def test_bulk_delete_plant_events_endpoint_repot(self):
        '''/bulk_delete_plant_events should make 4 database queries when
        deleting any number of RepotEvents.
        '''
        plant = Plant.objects.create(uuid=uuid4(), user=get_default_user())
        timestamp1 = '2024-04-19T00:13:37+00:00'
        timestamp2 = '2024-04-20T00:13:37+00:00'
        timestamp3 = '2024-04-21T00:13:37+00:00'
        RepotEvent.objects.create(plant=plant, timestamp=datetime.fromisoformat(
            timestamp1
        ))
        RepotEvent.objects.create(plant=plant, timestamp=datetime.fromisoformat(
            timestamp2
        ))
        RepotEvent.objects.create(plant=plant, timestamp=datetime.fromisoformat(
            timestamp3
        ))

        # Confirm 4 database queries when 1 RepotEvent deleted
        with self.assertNumQueries(4):
            response = self.client.post('/bulk_delete_plant_events', {
                'plant_id': plant.uuid,
                'events': {
                    'water': [],
                    'fertilize': [],
                    'prune': [],
                    'repot': [timestamp1],
                }
            })
            self.assertEqual(response.status_code, 200)

        # Confirm 4 database queries when 2 RepotEvents deleted
        with self.assertNumQueries(4):
            response = self.client.post('/bulk_delete_plant_events', {
                'plant_id': plant.uuid,
                'events': {
                    'water': [],
                    'fertilize': [],
                    'prune': [],
                    'repot': [
                        timestamp2,
                        timestamp3
                    ],
                }
            })
            self.assertEqual(response.status_code, 200)

    def test_bulk_delete_plant_events_endpoint_all_event_types(self):
        '''/bulk_delete_plant_events should make 12 database queries when
        deleting any number of all 4 event types.
        '''
        plant = Plant.objects.create(uuid=uuid4(), user=get_default_user())
        timestamp1 = '2024-04-19T00:13:37+00:00'
        timestamp2 = '2024-04-20T00:13:37+00:00'
        timestamp3 = '2024-04-21T00:13:37+00:00'
        for _, EventClass in events_map.items():
            EventClass.objects.create(plant=plant, timestamp=datetime.fromisoformat(
                timestamp1
            ))
            EventClass.objects.create(plant=plant, timestamp=datetime.fromisoformat(
                timestamp2
            ))
            EventClass.objects.create(plant=plant, timestamp=datetime.fromisoformat(
                timestamp3
            ))

        # Confirm 12 queries when deleting 1 of each
        with self.assertNumQueries(12):
            response = self.client.post('/bulk_delete_plant_events', {
                'plant_id': plant.uuid,
                'events': {
                    'water': [timestamp1],
                    'fertilize': [timestamp1],
                    'prune': [timestamp1],
                    'repot': [timestamp1],
                }
            })
            self.assertEqual(response.status_code, 200)

        # Confirm 12 queries when deletng 2 of each
        with self.assertNumQueries(12):
            response = self.client.post('/bulk_delete_plant_events', {
                'plant_id': plant.uuid,
                'events': {
                    'water': [timestamp2, timestamp3],
                    'fertilize': [timestamp2, timestamp3],
                    'prune': [timestamp2, timestamp3],
                    'repot': [timestamp2, timestamp3],
                }
            })
            self.assertEqual(response.status_code, 200)

    def test_add_plant_note_endpoint(self):
        '''/add_plant_note should make 3 database queries.'''
        plant = Plant.objects.create(uuid=uuid4(), user=get_default_user())
        with self.assertNumQueries(3):
            response = self.client.post('/add_plant_note', {
                'plant_id': plant.uuid,
                'timestamp': '2024-02-06T03:06:26.000Z',
                'note_text': '  plant is looking healthier than last week  '
            })
            self.assertEqual(response.status_code, 200)

    def test_edit_plant_note_endpoint(self):
        '''/edit_plant_note should make 4 database queries.'''
        timestamp = timezone.now()
        plant = Plant.objects.create(uuid=uuid4(), user=get_default_user())
        NoteEvent.objects.create(plant=plant, timestamp=timestamp, text="note")
        with self.assertNumQueries(4):
            response = self.client.post('/edit_plant_note', {
                'plant_id': plant.uuid,
                'timestamp': timestamp.isoformat(),
                'note_text': '   This is the text I forgot to add   '
            })
            self.assertEqual(response.status_code, 200)

    def test_delete_plant_note_endpoint(self):
        '''/delete_plant_note should make 4 database queries.'''
        timestamp = timezone.now()
        plant = Plant.objects.create(uuid=uuid4(), user=get_default_user())
        NoteEvent.objects.create(plant=plant, timestamp=timestamp, text="note")
        with self.assertNumQueries(4):
            response = self.client.post('/delete_plant_note', {
                'plant_id': plant.uuid,
                'timestamp': timestamp.isoformat()
            })
            self.assertEqual(response.status_code, 200)

    def test_add_plant_to_group_endpoint(self):
        '''/add_plant_to_group should make 5 database queries if Group is named,
        7 queries if Group is unnamed (must get unnamed index).'''
        user = get_default_user()
        plant = Plant.objects.create(uuid=uuid4(), user=user)
        group = Group.objects.create(uuid=uuid4(), user=user, name='Outside')
        with self.assertNumQueries(5):
            response = self.client.post('/add_plant_to_group', {
                'plant_id': plant.uuid,
                'group_id': group.uuid
            })
            self.assertEqual(response.status_code, 200)

        group.name = None
        group.save()
        plant.group = None
        plant.save()
        with self.assertNumQueries(7):
            response = self.client.post('/add_plant_to_group', {
                'plant_id': plant.uuid,
                'group_id': group.uuid
            })
            self.assertEqual(response.status_code, 200)

    def test_remove_plant_from_group_endpoint(self):
        '''/remove_plant_from_group should make 4 database queries.'''
        user = get_default_user()
        group = Group.objects.create(uuid=uuid4(), user=user)
        plant = Plant.objects.create(uuid=uuid4(), user=user, group=group)
        with self.assertNumQueries(4):
            response = self.client.post('/remove_plant_from_group', {
                'plant_id': plant.uuid
            })
            self.assertEqual(response.status_code, 200)

    def test_bulk_add_plants_to_group_endpoint(self):
        '''/bulk_add_plants_to_group should make 5 database queries regardless
        of the number of plants added to group.
        '''
        user = get_default_user()
        plant1 = Plant.objects.create(uuid=uuid4(), user=user)
        plant2 = Plant.objects.create(uuid=uuid4(), user=user)
        plant3 = Plant.objects.create(uuid=uuid4(), user=user)
        group = Group.objects.create(uuid=uuid4(), user=user, name='Outside')

        # Confirm makes 5 queries when 1 Plant added to Group
        with self.assertNumQueries(5):
            response = self.client.post('/bulk_add_plants_to_group', {
                'group_id': group.uuid,
                'plants': [
                    plant1.uuid
                ]
            })
            self.assertEqual(response.status_code, 200)

        # Confirm makes 5 queries when 2 Plants added to Group
        with self.assertNumQueries(5):
            response = self.client.post('/bulk_add_plants_to_group', {
                'group_id': group.uuid,
                'plants': [
                    plant2.uuid,
                    plant3.uuid
                ]
            })
            self.assertEqual(response.status_code, 200)

    def test_bulk_remove_plants_from_group_endpoint(self):
        '''/bulk_remove_plants_from_group should make 5 database queries
        regardless of the number of plants removed from group.
        '''
        user = get_default_user()
        group = Group.objects.create(uuid=uuid4(), user=user)
        plant1 = Plant.objects.create(uuid=uuid4(), user=user, group=group)
        plant2 = Plant.objects.create(uuid=uuid4(), user=user, group=group)
        plant3 = Plant.objects.create(uuid=uuid4(), user=user, group=group)

        # Confirm makes 5 queries when 1 Plant removed from Group
        with self.assertNumQueries(5):
            response = self.client.post('/bulk_remove_plants_from_group', {
                'group_id': group.uuid,
                'plants': [
                    plant1.uuid
                ]
            })
            self.assertEqual(response.status_code, 200)

        # Confirm makes 5 queries when 2 Plants removed from Group
        with self.assertNumQueries(5):
            response = self.client.post('/bulk_remove_plants_from_group', {
                'group_id': group.uuid,
                'plants': [
                    plant2.uuid,
                    plant3.uuid
                ]
            })
            self.assertEqual(response.status_code, 200)

    def test_repot_plant_endpoint(self):
        '''/repot_plant should make 4 database queries.'''
        plant = Plant.objects.create(uuid=uuid4(), user=get_default_user())
        with self.assertNumQueries(4):
            response = self.client.post('/repot_plant', {
                'plant_id': plant.uuid,
                'timestamp': '2024-02-06T03:06:26.000Z',
                'new_pot_size': 6
            })
            self.assertEqual(response.status_code, 200)

    def test_divide_plant_endpoint(self):
        '''/divide_plant should make 3 database queries.'''
        plant = Plant.objects.create(uuid=uuid4(), user=get_default_user())
        with self.assertNumQueries(3):
            response = self.client.post('/divide_plant', {
                'plant_id': plant.uuid,
                'timestamp': '2024-02-06T03:06:26.000Z'
            })
            self.assertEqual(response.status_code, 200)

    def test_add_plant_photos_endpoint(self):
        '''/add_plant_photos should make 3 database queries plus the number of
        photos uploaded (1 INSERT per photo).
        '''
        plant = Plant.objects.create(uuid=uuid4(), user=get_default_user())

        # Confirm makes 4 queries when 1 photo uploaded
        with self.assertNumQueries(4):
            response = self.client.post(
                '/add_plant_photos',
                data={
                    'plant_id': str(plant.uuid),
                    'photo_0': create_mock_photo('2024:03:22 10:52:03')
                },
                content_type=MULTIPART_CONTENT
            )
            self.assertEqual(response.status_code, 200)

        # Confirm makes 6 queries when 3 photos uploaded
        with self.assertNumQueries(6):
            response = self.client.post(
                '/add_plant_photos',
                data={
                    'plant_id': str(plant.uuid),
                    'photo_0': create_mock_photo('2024:03:22 10:52:04'),
                    'photo_1': create_mock_photo('2024:03:22 10:52:05'),
                    'photo_2': create_mock_photo('2024:03:22 10:52:06'),
                },
                content_type=MULTIPART_CONTENT
            )
            self.assertEqual(response.status_code, 200)

    def test_delete_plant_photos_endpoint(self):
        '''/delete_plant_photos should make 7 database queries regardless of the
        number of photos deleted.
        '''
        plant = Plant.objects.create(uuid=uuid4(), user=get_default_user())
        photo1 = Photo.objects.create(
            photo=create_mock_photo('2024:03:21 10:52:03'), plant=plant
        )
        photo2 = Photo.objects.create(
            photo=create_mock_photo('2024:03:22 10:52:03'), plant=plant
        )
        photo3 = Photo.objects.create(
            photo=create_mock_photo('2024:03:23 10:52:03'), plant=plant
        )

        # Confirm makes 6 queries when 1 photo deleted
        with self.assertNumQueries(7):
            response = self.client.post('/delete_plant_photos', {
                'plant_id': str(plant.uuid),
                'delete_photos': [
                    photo1.pk,
                ]
            })
            self.assertEqual(response.status_code, 200)

        # Confirm makes 7 queries when 2 photos deleted
        with self.assertNumQueries(7):
            response = self.client.post('/delete_plant_photos', {
                'plant_id': str(plant.uuid),
                'delete_photos': [
                    photo2.pk,
                    photo3.pk,
                ]
            })
            self.assertEqual(response.status_code, 200)

    def test_set_plant_default_photo_endpoint(self):
        '''/set_plant_default_photo should make 4 database queries.'''
        plant = Plant.objects.create(uuid=uuid4(), user=get_default_user())
        mock_photo = create_mock_photo('2024:03:21 10:52:03')
        photo = Photo.objects.create(photo=mock_photo, plant=plant)
        with self.assertNumQueries(4):
            response = self.client.post('/set_plant_default_photo', {
                'plant_id': str(plant.uuid),
                'photo_key': photo.pk
            })
            self.assertEqual(response.status_code, 200)
