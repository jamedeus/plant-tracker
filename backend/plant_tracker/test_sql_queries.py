'''Tests to confirm each endpoint makes the expected number of database queries.

The point of this is to detect when a commit causes dramatically more queries,
not to enforce a specific number (that can change during development as long as
it doesn't get out of control).
'''

# pylint: disable=missing-docstring,too-many-lines,R0801,too-many-public-methods,too-few-public-methods,global-statement

from uuid import uuid4
from datetime import datetime
from urllib.parse import urlencode
from contextlib import contextmanager

from django.conf import settings
from django.test import TestCase
from django.utils import timezone
from django.db import connections
from django.core.cache import cache
from django.contrib.auth import get_user_model
from django.test.client import MULTIPART_CONTENT
from django.test.utils import CaptureQueriesContext
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from .models import (
    Group,
    Plant,
    WaterEvent,
    FertilizeEvent,
    PruneEvent,
    RepotEvent,
    Photo,
    NoteEvent,
    UserEmailVerification
)
from .get_state_views import build_overview_state
from .view_decorators import get_default_user, events_map
from .auth_views import email_verification_token_generator
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
    cleanup_isolated_media_root(OVERRIDE, MODULE_MEDIA_ROOT)


class AssertNumQueriesMixin:
    @contextmanager
    # pylint: disable-next=invalid-name
    def assertNumQueries(self, *args, **kwargs):
        '''Emulates upstream assertNumQueries but filters out savepoint queries
        added by test test framework (doesn't exist in production). Clears
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
            # Build error message with actual recorded queries
            lines = ["Captured queries were:"]
            for i, q in enumerate(filtered, start=1):
                lines.append(f"{i}. {q['sql']}")
            raise self.failureException(
                f"{actual} != {expected} : {actual} queries executed, {expected} expected\n"
                + "\n".join(lines)
            )


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
        '''Loading the overview should make 1 database query.

        Requesting the overview state should make:
        - 4 queries when no Plants are in Groups (and no cached state exists)
        - 5 queries when >=1 Plant is in a Group (and no cached state exists)
        '''

        # Load with no cache and no plants in groups, confirm 1 query
        cache.clear()
        with self.assertNumQueries(1):
            response = self.client.get('/')
            self.assertEqual(response.status_code, 200)

        # Request state with no cache and no plants in groups, confirm 4 queries
        cache.clear()
        with self.assertNumQueries(4):
            response = self.client.get('/get_overview_state')
            self.assertEqual(response.status_code, 200)

        # Add plant to group, request state again, confirm 5 queries
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
        '''Loading the archived overview should make 1 database query.

        Requesting the archived overview state should make:
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

        # Load with no cache and no plants in groups, confirm 1 query
        with self.assertNumQueries(1):
            response = self.client.get('/archived')
            self.assertEqual(response.status_code, 200)

        # Request state with no cache and no plants in groups, confirm 4 queries
        with self.assertNumQueries(4):
            response = self.client.get('/get_archived_overview_state')
            self.assertEqual(response.status_code, 200)

        # Add plant to group, request state again, confirm 5 queries
        plant.group = group
        plant.save()
        with self.assertNumQueries(5):
            response = self.client.get('/get_archived_overview_state')
            self.assertEqual(response.status_code, 200)

    def test_manage_plant_page(self):
        '''Loading a manage_plant page should make 1 database query.

        Requesting the manage plant state should make:
        - 7 queries if Plant is unnamed (has to get unnamed_index + photo)
        - 6 queries if Plant is named (no extra query for name, query for photo)
        - 4 queries if Plant is named and has photos (no query for photo)
        - 4 queries if Plant is named and has default_photo (no query for photo)
        '''
        plant = Plant.objects.all()[0]

        with self.assertNumQueries(1):
            response = self.client.get(f'/manage/{plant.uuid}')
            self.assertEqual(response.status_code, 200)

        # Request state, confirm 7 queries
        with self.assertNumQueries(7):
            response = self.client.get(
                f'/get_manage_state/{plant.uuid}',
                HTTP_ACCEPT='application/json'
            )
            self.assertEqual(response.status_code, 200)

        plant.name = 'has name'
        plant.save()

        with self.assertNumQueries(6):
            response = self.client.get(
                f'/get_manage_state/{plant.uuid}',
                HTTP_ACCEPT='application/json'
            )
            self.assertEqual(response.status_code, 200)

        # Add photo, confirm 5 queries (no most-recent query, has annotation)
        photo = Photo.objects.create(
            photo=create_mock_photo('2024:03:21 10:52:03'), plant=plant
        )
        with self.assertNumQueries(5):
            response = self.client.get(
                f'/get_manage_state/{plant.uuid}',
                HTTP_ACCEPT='application/json'
            )
            self.assertEqual(response.status_code, 200)

        # Set default, confirm 5 queries (no most-recent query, has annotation)
        plant.default_photo = photo
        with self.assertNumQueries(5):
            response = self.client.get(
                f'/get_manage_state/{plant.uuid}',
                HTTP_ACCEPT='application/json'
            )
            self.assertEqual(response.status_code, 200)

    def test_manage_group_page(self):
        '''Loading a manage_group page should make 1 database query.

        Requesting the manage group state should make:
        - 5 queries if Group is unnamed (has to get unnamed_index)
        - 4 queries if Group is named (no extra query for name)
        '''
        group = Group.objects.all()[0]
        with self.assertNumQueries(1):
            response = self.client.get(f'/manage/{group.uuid}')
            self.assertEqual(response.status_code, 200)

        # Request state, confirm 5 queries
        with self.assertNumQueries(5):
            response = self.client.get(
                f'/get_manage_state/{group.uuid}',
                HTTP_ACCEPT='application/json'
            )
            self.assertEqual(response.status_code, 200)

        # Set name, request state again, confirm 4 queries
        group.name = 'has name'
        group.save()
        with self.assertNumQueries(4):
            response = self.client.get(
                f'/get_manage_state/{group.uuid}',
                HTTP_ACCEPT='application/json'
            )
            self.assertEqual(response.status_code, 200)

    def test_registration_page(self):
        '''Requesting the registration page should make 1 database query.

        Requesting the registration state should make 2 database queries.
        '''
        with self.assertNumQueries(1):
            response = self.client.get(f'/manage/{uuid4()}')
            self.assertEqual(response.status_code, 200)

        with self.assertNumQueries(2):
            response = self.client.get(
                f'/get_manage_state/{uuid4()}',
                HTTP_ACCEPT='application/json'
            )
            self.assertEqual(response.status_code, 200)

    def test_get_plant_species_options_endpoint(self):
        '''/get_plant_species_options should make 2 database queries.'''
        with self.assertNumQueries(2):
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


class SqlQueriesPerViewTests(AssertNumQueriesMixin, TestCase):
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
            self.assertEqual(response.status_code, 200)

    def test_register_group_endpoint(self):
        '''/register_group should make 2 database queries.'''
        with self.assertNumQueries(2):
            response = self.client.post('/register_group', {
                'uuid': uuid4(),
                'name': '    test group',
                'location': 'top shelf    ',
                'description': 'This group is used for propagation'
            })
            self.assertEqual(response.status_code, 200)

    def test_change_uuid_endpoint_plant(self):
        '''/change_uuid should make 4 database queries when target is Plant.'''
        plant = Plant.objects.create(uuid=uuid4(), user=get_default_user())
        with self.assertNumQueries(4):
            response = self.client.post('/change_uuid', {
                'uuid': str(plant.uuid),
                'new_id': str(uuid4())
            })
            self.assertEqual(response.status_code, 200)

    def test_change_uuid_endpoint_group(self):
        '''/change_uuid should make 4 database queries when target is Group.'''
        group = Group.objects.create(uuid=uuid4(), user=get_default_user())
        with self.assertNumQueries(4):
            response = self.client.post('/change_uuid', {
                'uuid': str(group.uuid),
                'new_id': str(uuid4())
            })
            self.assertEqual(response.status_code, 200)

    def test_edit_plant_details_endpoint(self):
        '''/edit_plant_details should make 3 database queries.'''
        plant = Plant.objects.create(uuid=uuid4(), user=get_default_user())
        with self.assertNumQueries(3):
            response = self.client.post('/edit_plant_details', {
                'plant_id': plant.uuid,
                'name': 'test plant',
                'species': 'Giant Sequoia',
                'description': '300 feet and a few thousand years old',
                'pot_size': '4'
            })
            self.assertEqual(response.status_code, 200)

    def test_edit_group_details_endpoint(self):
        '''/edit_group_details should make 3 database queries.'''
        group = Group.objects.create(uuid=uuid4(), user=get_default_user())
        with self.assertNumQueries(3):
            response = self.client.post('/edit_group_details', {
                'group_id': group.uuid,
                'name': 'test group    ',
                'location': '    middle shelf',
                'description': 'This group is used for propagation'
            })
            self.assertEqual(response.status_code, 200)

    def test_bulk_delete_plants_and_groups_endpoint_1_plant(self):
        '''/bulk_delete_plants_and_groups should make 14 database queries when
        deleting a single Plant instance.
        '''
        plant = Plant.objects.create(uuid=uuid4(), user=get_default_user())
        with self.assertNumQueries(14):
            response = self.client.post('/bulk_delete_plants_and_groups', {
                'uuids': [str(plant.uuid)]
            })
            self.assertEqual(response.status_code, 200)

    def test_bulk_delete_plants_and_groups_endpoint_3_plants(self):
        '''/bulk_delete_plants_and_groups should make 14 database queries when
        deleting 3 Plant instances.
        '''
        plant1 = Plant.objects.create(uuid=uuid4(), user=get_default_user())
        plant2 = Plant.objects.create(uuid=uuid4(), user=get_default_user())
        plant3 = Plant.objects.create(uuid=uuid4(), user=get_default_user())
        with self.assertNumQueries(14):
            response = self.client.post('/bulk_delete_plants_and_groups', {
                'uuids': [
                    str(plant1.uuid),
                    str(plant2.uuid),
                    str(plant3.uuid)
                ]
            })
            self.assertEqual(response.status_code, 200)

    def test_bulk_delete_plants_and_groups_endpoint_1_group(self):
        '''/bulk_delete_plants_and_groups should make 7 database queries when
        deleting a single Group instance.
        '''
        group = Group.objects.create(uuid=uuid4(), user=get_default_user())
        with self.assertNumQueries(7):
            response = self.client.post('/bulk_delete_plants_and_groups', {
                'uuids': [str(group.uuid)]
            })
            self.assertEqual(response.status_code, 200)

    def test_bulk_delete_plants_and_groups_endpoint_3_groups(self):
        '''/bulk_delete_plants_and_groups should make 7 database queries when
        deleting 3 Group instances.
        '''
        group1 = Group.objects.create(uuid=uuid4(), user=get_default_user())
        group2 = Group.objects.create(uuid=uuid4(), user=get_default_user())
        group3 = Group.objects.create(uuid=uuid4(), user=get_default_user())
        with self.assertNumQueries(7):
            response = self.client.post('/bulk_delete_plants_and_groups', {
                'uuids': [
                    str(group1.uuid),
                    str(group2.uuid),
                    str(group3.uuid)
                ]
            })
            self.assertEqual(response.status_code, 200)

    def test_bulk_delete_plants_and_groups_endpoint_3_plants_3_groups(self):
        '''/bulk_delete_plants_and_groups should make 17 database queries when
        deleting 3 plant instances and 3 Group instances.
        '''
        plant1 = Plant.objects.create(uuid=uuid4(), user=get_default_user())
        plant2 = Plant.objects.create(uuid=uuid4(), user=get_default_user())
        plant3 = Plant.objects.create(uuid=uuid4(), user=get_default_user())
        group1 = Group.objects.create(uuid=uuid4(), user=get_default_user())
        group2 = Group.objects.create(uuid=uuid4(), user=get_default_user())
        group3 = Group.objects.create(uuid=uuid4(), user=get_default_user())
        with self.assertNumQueries(17):
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

    def test_bulk_delete_plants_and_groups_endpoint_plant_in_group(self):
        '''/bulk_delete_plants_and_groups should make 18 database queries when
        deleting 3 plant instances and 3 Group instances when 2 plants are in
        a group (extra UPDATE query for related group object).
        '''
        user = get_default_user()
        group1 = Group.objects.create(uuid=uuid4(), user=user)
        group2 = Group.objects.create(uuid=uuid4(), user=user)
        group3 = Group.objects.create(uuid=uuid4(), user=user)
        plant1 = Plant.objects.create(uuid=uuid4(), user=user)
        plant2 = Plant.objects.create(uuid=uuid4(), user=user, group=group1)
        plant3 = Plant.objects.create(uuid=uuid4(), user=user, group=group1)
        with self.assertNumQueries(18):
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
        '''/bulk_archive_plants_and_groups should make 5 database queries when
        archiving a single Plant instance.
        '''
        plant = Plant.objects.create(uuid=uuid4(), user=get_default_user())
        with self.assertNumQueries(5):
            response = self.client.post('/bulk_archive_plants_and_groups', {
                'uuids': [str(plant.uuid)],
                'archived': True
            })
            self.assertEqual(response.status_code, 200)

    def test_bulk_archive_plants_and_groups_endpoint_3_plants(self):
        '''/bulk_archive_plants_and_groups should make 5 database queries when
        archiving 3 Plant instances.
        '''
        plant1 = Plant.objects.create(uuid=uuid4(), user=get_default_user())
        plant2 = Plant.objects.create(uuid=uuid4(), user=get_default_user())
        plant3 = Plant.objects.create(uuid=uuid4(), user=get_default_user())
        with self.assertNumQueries(5):
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
        '''/bulk_archive_plants_and_groups should make 5 database queries when
        archiving a single Group instance.
        '''
        group = Group.objects.create(uuid=uuid4(), user=get_default_user())
        with self.assertNumQueries(5):
            response = self.client.post('/bulk_archive_plants_and_groups', {
                'uuids': [str(group.uuid)],
                'archived': True
            })
            self.assertEqual(response.status_code, 200)

    def test_bulk_archive_plants_and_groups_endpoint_3_groups(self):
        '''/bulk_archive_plants_and_groups should make 5 database queries when
        archiving 3 Group instances.
        '''
        group1 = Group.objects.create(uuid=uuid4(), user=get_default_user())
        group2 = Group.objects.create(uuid=uuid4(), user=get_default_user())
        group3 = Group.objects.create(uuid=uuid4(), user=get_default_user())
        with self.assertNumQueries(5):
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
        '''/bulk_archive_plants_and_groups should make 6 database queries when
        archiving 3 plant instances and 3 Group instances.
        '''
        plant1 = Plant.objects.create(uuid=uuid4(), user=get_default_user())
        plant2 = Plant.objects.create(uuid=uuid4(), user=get_default_user())
        plant3 = Plant.objects.create(uuid=uuid4(), user=get_default_user())
        group1 = Group.objects.create(uuid=uuid4(), user=get_default_user())
        group2 = Group.objects.create(uuid=uuid4(), user=get_default_user())
        group3 = Group.objects.create(uuid=uuid4(), user=get_default_user())
        with self.assertNumQueries(6):
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

    def test_delete_plant_events_endpoint_water(self):
        '''/delete_plant_events should make 5 database queries when deleting
        any number of WaterEvents.
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
            response = self.client.post('/delete_plant_events', {
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
            response = self.client.post('/delete_plant_events', {
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

    def test_delete_plant_events_endpoint_fertilize(self):
        '''/delete_plant_events should make 5 database queries when deleting
        any number of FertilizeEvents.
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
            response = self.client.post('/delete_plant_events', {
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
            response = self.client.post('/delete_plant_events', {
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

    def test_delete_plant_events_endpoint_prune(self):
        '''/delete_plant_events should make 4 database queries when deleting
        any number of PruneEvents.
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
            response = self.client.post('/delete_plant_events', {
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
            response = self.client.post('/delete_plant_events', {
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

    def test_delete_plant_events_endpoint_repot(self):
        '''/delete_plant_events should make 4 database queries when deleting
        any number of RepotEvents.
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
            response = self.client.post('/delete_plant_events', {
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
            response = self.client.post('/delete_plant_events', {
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

    def test_delete_plant_events_endpoint_all_event_types(self):
        '''/delete_plant_events should make 12 database queries when deleting
        any number of all 4 event types.
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
            response = self.client.post('/delete_plant_events', {
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
            response = self.client.post('/delete_plant_events', {
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

    def test_delete_plant_notes_endpoint(self):
        '''/delete_plant_notes should make 4 database queries regardless of the
        number of notes deleted.
        '''
        timestamp1 = timezone.now()
        timestamp2 = timezone.now()
        timestamp3 = timezone.now()
        plant = Plant.objects.create(uuid=uuid4(), user=get_default_user())
        NoteEvent.objects.create(plant=plant, timestamp=timestamp1, text="note1")
        NoteEvent.objects.create(plant=plant, timestamp=timestamp2, text="note2")
        NoteEvent.objects.create(plant=plant, timestamp=timestamp3, text="note3")

        # Confirm makes 4 queries when deleting 1 note
        with self.assertNumQueries(4):
            response = self.client.post('/delete_plant_notes', {
                'plant_id': plant.uuid,
                'timestamps': [timestamp1.isoformat()]
            })
            self.assertEqual(response.status_code, 200)

        # Confirm makes 4 queries when deleting 2 notes
        with self.assertNumQueries(4):
            response = self.client.post('/delete_plant_notes', {
                'plant_id': plant.uuid,
                'timestamps': [timestamp2.isoformat(), timestamp3.isoformat()]
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
        photos uploaded (1 INSERT per photo), or 2+n if default_photo not set.
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

        # Set plant default photo
        plant.default_photo = plant.photo_set.all()[0]
        plant.save()

        # Confirm makes 3 queries when 1 photo uploaded
        with self.assertNumQueries(3):
            response = self.client.post(
                '/add_plant_photos',
                data={
                    'plant_id': str(plant.uuid),
                    'photo_0': create_mock_photo('2024:03:22 10:52:03')
                },
                content_type=MULTIPART_CONTENT
            )
            self.assertEqual(response.status_code, 200)

    def test_delete_plant_photos_endpoint(self):
        '''/delete_plant_photos should make 7 database queries regardless of the
        number of photos deleted (or 6 if default_photo is set).
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

        # Confirm makes 7 queries when 1 photo deleted
        with self.assertNumQueries(7):
            response = self.client.post('/delete_plant_photos', {
                'plant_id': str(plant.uuid),
                'photos': [
                    photo1.pk,
                ]
            })
            self.assertEqual(response.status_code, 200)

        # Confirm makes 7 queries when 2 photos deleted
        with self.assertNumQueries(7):
            response = self.client.post('/delete_plant_photos', {
                'plant_id': str(plant.uuid),
                'photos': [
                    photo2.pk,
                    photo3.pk,
                ]
            })
            self.assertEqual(response.status_code, 200)

        # Create 2 more photos, set default_photo
        photo1 = Photo.objects.create(
            photo=create_mock_photo('2024:03:21 10:52:03'), plant=plant
        )
        photo2 = Photo.objects.create(
            photo=create_mock_photo('2024:03:22 10:52:03'), plant=plant
        )
        plant.default_photo = photo2
        plant.save()

        # Confirm makes 6 queries when 1 photo deleted
        with self.assertNumQueries(6):
            response = self.client.post('/delete_plant_photos', {
                'plant_id': str(plant.uuid),
                'photos': [
                    photo1.pk,
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


class SqlQueriesPerUserAuthenticationEndpoint(AssertNumQueriesMixin, TestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.test_user = user_model.objects.create_user(
            username='unittest',
            password='12345',
            first_name='Bob',
            last_name='Smith',
            email='bob.smith@hotmail.com'
        )
        UserEmailVerification.objects.create(user=cls.test_user)

        # Ensure SINGLE_USER_MODE is disabled
        settings.SINGLE_USER_MODE = False

    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        # Ensure SINGLE_USER_MODE is enabled for other test suites
        settings.SINGLE_USER_MODE = True

    def setUp(self):
        # Clear entire cache before each test
        cache.clear()

        # Set default content_type for post requests (avoid long lines)
        self.client = JSONClient()

    def tearDown(self):
        # Ensure user logged out between tests
        self.client.logout()

    def test_login_page(self):
        '''Loading the login page should not query the database.'''
        with self.assertNumQueries(0):
            response = self.client.get('/accounts/login/')
            self.assertEqual(response.status_code, 200)

    def test_user_profile_page(self):
        '''Loading the profile page should make 1 database query.

        Requesting the profile state should make 2 database queries.
        '''
        self.client.login(username='unittest', password='12345')
        with self.assertNumQueries(1):
            response = self.client.get('/accounts/profile/')
            self.assertEqual(response.status_code, 200)
        with self.assertNumQueries(2):
            response = self.client.get('/accounts/get_user_details/')
            self.assertEqual(response.status_code, 200)

    def test_login_endpoint(self):
        '''/accounts/login/ should make 5 database queries.'''
        with self.assertNumQueries(5):
            response = self.client.post(
                "/accounts/login/",
                urlencode({"username": "unittest", "password": "12345"}),
                content_type="application/x-www-form-urlencoded"
            )
            self.assertEqual(response.status_code, 200)

    def test_create_user_endpoint(self):
        '''/accounts/create_user/ should make 9 database queries.'''
        with self.assertNumQueries(9):
            response = self.client.post('/accounts/create_user/', {
                'username': 'newuser',
                'password': 'acceptablepasswordlength',
                'email': 'myfirstemail@hotmail.com',
                'first_name': '',
                'last_name': ''
            })
            self.assertEqual(response.status_code, 200)

    def test_verify_email_endpoint(self):
        '''/accounts/verify/ should make 3 database queries when email is not verified.'''

        # Simulate pending verification
        verification = UserEmailVerification.objects.get(user=self.test_user)
        verification.is_email_verified = False
        verification.save()

        # Get parameters for verification URL
        uidb64 = urlsafe_base64_encode(force_bytes(self.test_user.pk))
        token = email_verification_token_generator.make_token(self.test_user)

        # Confirm makes 3 queries and redirects to overview page
        with self.assertNumQueries(3):
            response = self.client.get(f'/accounts/verify/{uidb64}/{token}/')
            self.assertEqual(response.status_code, 302)

    def test_verify_email_endpoint_already_verified(self):
        '''/accounts/verify/ should make 2 database queries when email is already verified.'''

        # Simulate already verified
        verification = UserEmailVerification.objects.get(user=self.test_user)
        verification.is_email_verified = True
        verification.save()

        # Get parameters for verification URL
        self.test_user.refresh_from_db()
        uidb64 = urlsafe_base64_encode(force_bytes(self.test_user.pk))
        token = email_verification_token_generator.make_token(self.test_user)

        # Confirm makes 2 queries and redirects to overview page
        with self.assertNumQueries(2):
            response = self.client.get(f'/accounts/verify/{uidb64}/{token}/')
            self.assertEqual(response.status_code, 302)

    def test_edit_user_details_endpoint(self):
        '''/accounts/edit_user_details/ should make 2 database queries'''
        self.client.login(username='unittest', password='12345')
        with self.assertNumQueries(2):
            response = self.client.post('/accounts/edit_user_details/', {
                'first_name': 'Anthony',
                'last_name': 'Weiner',
                'email': 'carlosdanger@hotmail.com'
            })
            self.assertEqual(response.status_code, 200)

    def test_change_password_endpoint(self):
        '''/accounts/change_password/ should make 7 database queries.'''
        self.client.login(username='unittest', password='12345')
        with self.assertNumQueries(7):
            response = self.client.post('/accounts/change_password/',
                urlencode({
                    'old_password': '12345',
                    'new_password1': 'more secure password',
                    'new_password2': 'more secure password',
                }),
                content_type="application/x-www-form-urlencoded"
            )
            self.assertEqual(response.status_code, 200)

    def test_logout_endpoint(self):
        '''/accounts/logout/ should make 3 database queries.'''
        self.client.login(username='unittest', password='12345')
        with self.assertNumQueries(3):
            response = self.client.get('/accounts/logout/')
            self.assertEqual(response.status_code, 302)
