'''Async tasks run by celery worker to update cached frontend states.'''

from celery import shared_task
from django.core.cache import cache
from django.contrib.auth import get_user_model

from .models import Plant
from .build_states import (
    build_overview_state,
    build_manage_plant_state,
    get_plant_options,
    get_group_options,
)


@shared_task()
def update_cached_overview_state(user_pk):
    '''Takes user primary key, builds and caches overview state.'''
    user = get_user_model().objects.get(pk=user_pk)
    build_overview_state(user)
    print(f'Rebuilt overview state for {user_pk}')


@shared_task()
def update_cached_manage_plant_state(uuid):
    '''Builds and caches manage_plant state.'''
    build_manage_plant_state(uuid)
    print(f'Rebuilt {uuid} state')


@shared_task()
def update_cached_plant_options(user_pk):
    '''Takes user primary key, builds and caches plant options for manage_group
    add plants modal.'''
    cache.delete(f'plant_options_{user_pk}')
    get_plant_options(get_user_model().objects.get(pk=user_pk))
    print(f'Rebuilt plant_options for {user_pk} (manage_group add plants modal)')


@shared_task()
def update_cached_group_options(user_pk):
    '''Takes user primary key, builds and caches group options for manage_plant
    add group modal.'''
    cache.delete(f'group_options_{user_pk}')
    get_group_options(get_user_model().objects.get(pk=user_pk))
    print(f'Rebuilt group_options for {user_pk} (manage_plant add group modal)')


@shared_task()
def update_all_cached_states():
    '''Updates all cached overview, plant_options, and group_options states
    that have keys in redis store. Updates and caches manage_plant state for
    all plants in database regardless of whether they have existing keys.
    Called when server starts to prevent serving outdated states.
    '''

    # Build states for all plants in database
    for plant in Plant.objects.all():
        update_cached_manage_plant_state.delay(plant.uuid)

    # Iterate existing keys, parse user primary key from cache name and pass
    # to correct function to rebuild
    for key in cache.keys('*'):
        if key.startswith('overview_state_'):
            update_cached_overview_state.delay(key.split('_')[-1])
        elif key.startswith('plant_options_'):
            update_cached_plant_options.delay(key.split('_')[-1])
        elif key.startswith('group_options_'):
            update_cached_group_options.delay(key.split('_')[-1])
