# feedback/tasks.py

from celery import shared_task
from backend.celery import app
from django.core.cache import cache
from django.dispatch import receiver
from django.db.models.signals import post_save, post_delete

from .models import Plant, Group


def revoke_queued_task(task_id_cache_name):
    '''Revokes queued tasks'''
    task_id = cache.get(task_id_cache_name)
    if task_id:
        app.control.revoke(task_id, terminate=True)


def schedule_cached_state_update(cache_name, callback_task, callback_kwargs={}, delay=0):
    '''Clears cache_name and schedules callback_task to run in delay seconds.

    Cache is cleared immediately to prevent serving outdated state if requested
    before delay seconds. If another task with same cache_name is queued before
    delay seconds the existing queued task is revoked to prevent duplicates.

    The callback_task arg must be a function that builds a state object and
    caches it as cache_name.

    The optional callback_kwargs must be a dict of kwargs passed to callback_task.
    '''

    # Clear existing cache (prevent loading outdated state)
    cache.delete(cache_name)
    print(f'Cleared {cache_name} cache (queueing rebuild task)')

    # Revoke queued duplicate tasks (resets delay timer)
    revoke_queued_task(f'rebuild_{cache_name}_task_id')

    # Schedule callback task to run after delay seconds
    result = callback_task.apply_async(kwargs=callback_kwargs, countdown=delay)

    # Store ID of queued task so it can be canceled if this is called again
    cache.set(f'rebuild_{cache_name}_task_id', result.id)


def build_overview_state():
    '''Builds state parsed by overview react app and returns'''
    state = {
        'plants': [],
        'groups': []
    }

    for plant in Plant.objects.all():
        state['plants'].append(plant.get_details())

    for group in Group.objects.all():
        state['groups'].append(group.get_details())

    # Cache state for up to 24 hours
    cache.set('overview_state', state, 86400)

    # Revoke queued update tasks (prevent rebuilding again after manual call)
    revoke_queued_task('rebuild_overview_state_task_id')

    return state


@shared_task()
def update_cached_overview_state():
    '''Builds overview state and caches for up to 24 hours'''
    build_overview_state()
    print('Rebuilt overview state')


def schedule_cached_overview_state_update():
    '''Clears cached overview state immediately and schedules task to update
    it in 30 seconds (timer resets if called again within 30 seconds).
    '''
    schedule_cached_state_update(
        cache_name='overview_state',
        callback_task=update_cached_overview_state,
        delay=30
    )


@receiver(post_save, sender=Plant)
@receiver(post_save, sender=Group)
@receiver(post_delete, sender=Plant)
@receiver(post_delete, sender=Group)
def update_cached_overview_state_hook(**kwargs):
    '''Schedules task to update cached overview state when Plant or Group model
    is saved or deleted.
    '''
    schedule_cached_overview_state_update()
