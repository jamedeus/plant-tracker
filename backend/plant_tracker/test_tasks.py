# pylint: disable=missing-docstring,line-too-long,R0801,too-many-lines

import shutil
from uuid import uuid4

from django.conf import settings
from django.test import TestCase
from django.core.cache import cache

from .models import Plant
from .unit_test_helpers import JSONClient
from .view_decorators import get_default_user
from .build_states import build_overview_state
from .tasks import update_cached_overview_state, update_all_cached_states


def tearDownModule():
    # Delete mock photo directory after tests
    print("\nDeleting mock photos...\n")
    shutil.rmtree(settings.TEST_DIR, ignore_errors=True)


class HelperFunctionTests(TestCase):
    '''Test helper functions that are used by multiple tasks'''

    def setUp(self):
        # Clear entire cache before each test
        cache.clear()

    def test_update_all_cached_states(self):
        default_user = get_default_user()
        # Replace cached overview state with dummy strings
        cache.set(f'overview_state_{default_user.pk}', 'foo')

        # Call update_all_cached_states method
        update_all_cached_states()

        # Confirm cached overview state was rebuilt (no longer dummy strings)
        self.assertIsInstance(cache.get(f'overview_state_{default_user.pk}'), dict)


class TaskTests(TestCase):
    '''Test task functions'''

    def setUp(self):
        # Clear entire cache before each test
        cache.clear()

    def test_update_cached_overview_state(self):
        # Confirm overview_state cache is not set
        user_id = get_default_user().pk
        self.assertIsNone(cache.get(f'overview_state_{user_id}'))

        # Run task immediately
        update_cached_overview_state.delay(user_id)

        # Confirm overview state was generated and cached
        self.assertTrue(isinstance(cache.get(f'overview_state_{user_id}'), dict))


class OverviewStateUpdateTests(TestCase):
    '''Test that cached overview states update correctly when database changes'''

    def setUp(self):
        # Clear entire cache before each test
        cache.clear()

        # Set default content_type for post requests (avoid long lines)
        self.client = JSONClient()

        # Generate UUID to use in tests
        self.uuid = uuid4()
