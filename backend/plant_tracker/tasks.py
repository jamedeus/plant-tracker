'''Async tasks run by celery worker to update cached frontend states.'''

from celery import shared_task
from django.core.cache import cache
from django.contrib.auth import get_user_model

from .models import Plant
from .build_states import build_overview_state


@shared_task()
def update_cached_overview_state(user_pk):
    '''Takes user primary key, builds and caches overview state.'''
    user = get_user_model().objects.get(pk=user_pk)
    build_overview_state(user)
    print(f'Rebuilt overview state for {user_pk}')


@shared_task()
def update_all_cached_states():
    '''Updates all cached overview states that have keys in redis store.
    Deletes all cached manage_plant states.
    Called when server starts to prevent serving outdated states.
    '''

    # Delete all cached plant states (potentially outdated)
    for plant in Plant.objects.all():
        cache.delete(f'{plant.uuid}_state')

    # Iterate existing keys, parse user primary key from cache name and pass
    # to correct function to rebuild
    for key in cache.keys('*'):
        if key.startswith('overview_state_'):
            update_cached_overview_state.delay(key.split('_')[-1])
