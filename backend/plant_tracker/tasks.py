# feedback/tasks.py

from celery import shared_task
from backend.celery import app
from django.core.cache import cache
from django.dispatch import receiver
from django.db.models.signals import post_save, post_delete

from .models import Plant, Group


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

    # Revoked queued update tasks (prevent rebuilding again after manual call)
    task_id = cache.get('rebuild_task_id')
    if task_id:
        app.control.revoke(task_id, terminate=True)

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

    # Clear cache immediately (prevent outdated state if user loads overview
    # before scheduled task updates state)
    cache.delete('overview_state')

    # Revoke queued update tasks (reset timer, prevent duplicates)
    task_id = cache.get('rebuild_task_id')
    if task_id:
        app.control.revoke(task_id, terminate=True)

    # Schedule rebuild task to run in 30 seconds
    result = update_cached_overview_state.apply_async(countdown=30)

    # Store ID of queued task so it can be canceled if another is queued
    cache.set('rebuild_task_id', result.id)


@receiver(post_save, sender=Plant)
@receiver(post_save, sender=Group)
@receiver(post_delete, sender=Plant)
@receiver(post_delete, sender=Group)
def update_cached_overview_state_hook(**kwargs):
    '''Schedules task to update cached overview state when Plant or Group model
    is saved or deleted.
    '''
    schedule_cached_overview_state_update()
