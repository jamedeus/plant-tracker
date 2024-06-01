import shutil
from uuid import uuid4
from unittest.mock import patch, MagicMock

from django.conf import settings
from django.test import TestCase
from django.core.cache import cache

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
from .tasks import (
    revoke_queued_task,
    schedule_cached_state_update,
    update_cached_overview_state,
    schedule_cached_overview_state_update,
    update_cached_manage_plant_state,
    schedule_cached_manage_plant_state_update
)
from .unit_test_helpers import (
    JSONClient,
    create_mock_photo,
    clear_cache
)


def tearDownModule():
    # Delete mock photo directory after tests
    print("\nDeleting mock photos...\n")
    shutil.rmtree(settings.TEST_DIR, ignore_errors=True)


class HelperFunctionTests(TestCase):
    '''Test helper functions that are used by multiple tasks'''

    def setUp(self):
        # Clear entire cache before each test
        clear_cache()

    def test_revoke_queued_task(self):
        with patch('plant_tracker.tasks.cache.get') as mock_cache_get, \
             patch('plant_tracker.tasks.app.control.revoke') as mock_revoke:
            # Simulate existing cached task ID
            mock_cache_get.return_value = 'mock_task_id'

            # Call function to revoke scheduled task
            revoke_queued_task('rebuild_overview_state_task_id')

            # Confirm correct cache key was looked up
            mock_cache_get.assert_called_once_with('rebuild_overview_state_task_id')

            # Confirm mock task ID was revoked
            mock_revoke.assert_called_once_with('mock_task_id', terminate=True)

    def test_revoke_queued_task_not_found(self):
        with patch('plant_tracker.tasks.cache.get') as mock_cache_get, \
             patch('plant_tracker.tasks.app.control.revoke') as mock_revoke:
            # Simulate no existing cached task
            mock_cache_get.return_value = None

            # Call function to revoke scheduled task
            revoke_queued_task('rebuild_overview_state_task_id')

            # Confirm correct cache key was looked up, revoke was not called
            mock_cache_get.assert_called_once_with('rebuild_overview_state_task_id')
            mock_revoke.assert_not_called()

    def test_schedule_cached_state_update(self):
        # Get test UUID, mock cached manage_plant state
        uuid = uuid4()
        cache.set(f'{uuid}_state', 'mock_manage_plant_state')

        # Mock methods called by schedule_cached_state_update
        with patch('plant_tracker.tasks.cache.get') as mock_cache_get, \
             patch('plant_tracker.tasks.cache.set') as mock_cache_set, \
             patch('plant_tracker.tasks.revoke_queued_task') as mock_revoke_queued_task, \
             patch('plant_tracker.tasks.update_cached_manage_plant_state.apply_async') as mock_apply_async:

            # Mock cache.get to return None (simulate no duplicate task in queue)
            mock_cache_get.return_value = None

            # Mock apply_async to return object with id param (scheduled task ID)
            mock_result = MagicMock()
            mock_result.id = "mock_task_id"
            mock_apply_async.return_value = mock_result

            # Call function to schedule cached state update
            schedule_cached_state_update(
                cache_name=f'{uuid}_state',
                callback_task=update_cached_manage_plant_state,
                callback_kwargs={'uuid': uuid},
                delay=30
            )

            # Confirm existing cache was deleted
            self.assertIsNone(cache.get(f'{uuid}_state'))

            # Confirm revoke_queued_task was called with cache key containing
            # ID of duplicate task (revokes duplicate if present)
            mock_revoke_queued_task.assert_called_once_with(f'rebuild_{uuid}_state_task_id')

            # Confirm apply_async was called with correct args
            mock_apply_async.assert_called_once_with(kwargs={'uuid': uuid}, countdown=30)

            # Confirm ID of newly queued task was cached so it can be canceled if needed
            mock_cache_set.assert_called_once_with(f'rebuild_{uuid}_state_task_id', 'mock_task_id')


class TaskTests(TestCase):
    '''Test task functions'''

    def setUp(self):
        # Clear entire cache before each test
        clear_cache()

    def test_update_cached_overview_state(self):
        # Confirm overview_state cache is not set
        self.assertIsNone(cache.get('overview_state'))

        # Run task immediately
        update_cached_overview_state.delay()

        # Confirm overview state was generated and cached
        self.assertTrue(isinstance(cache.get('overview_state'), dict))

    def test_schedule_cached_overview_state_update(self):
        # Mock existing cached overview state (should be replaced)
        cache.set('overview_state', 'mock_state')

        # Call function to schedule rebuild task (runs immediately in tests)
        schedule_cached_overview_state_update()

        # Confirm ID of rebuild task was cached
        self.assertIsNotNone(cache.get('rebuild_overview_state_task_id'))

        # Confirm existing cached state was replaced (not just cleared)
        self.assertIsNotNone(cache.get('overview_state'))
        self.assertTrue(isinstance(cache.get('overview_state'), dict))

    def test_update_cached_manage_plant_state(self):
        # Create test Plant, confirm state is automatically generated + cached
        plant = Plant.objects.create(uuid=uuid4())
        self.assertIsNotNone(cache.get(f'{plant.uuid}_state'))
        self.assertTrue(isinstance(cache.get(f'{plant.uuid}_state'), dict))

        # Clear automatically-generated state
        cache.delete(f'{plant.uuid}_state')
        self.assertIsNone(cache.get(f'{plant.uuid}_state'))

        # Run task immediately
        update_cached_manage_plant_state.delay(plant.uuid)

        # Confirm manage_plant cache was generated and cached
        self.assertIsNotNone(cache.get(f'{plant.uuid}_state'))
        self.assertTrue(isinstance(cache.get(f'{plant.uuid}_state'), dict))

    def test_schedule_cached_manage_plant_state_update(self):
        # Create test plant, replace autogenerated state with mock string
        plant = Plant.objects.create(uuid=uuid4())
        cache.set(f'{plant.uuid}_state', 'mock_state')

        # Call function to schedule rebuild task (runs immediately in tests)
        schedule_cached_manage_plant_state_update(plant.uuid)

        # Confirm ID of rebuild task was cached
        self.assertIsNotNone(cache.get(f'rebuild_{plant.uuid}_state_task_id'))

        # Confirm existing cached state was replaced (not just cleared)
        self.assertIsNotNone(cache.get('overview_state'))
        self.assertTrue(isinstance(cache.get('overview_state'), dict))
