# feedback/tasks.py

from celery import shared_task
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

    return state


@shared_task()
def update_cached_overview_state():
    '''Builds overview state and caches for up to 24 hours'''
    state = build_overview_state()
    cache.set('overview_state', state, 86400)
    print('Rebuilt overview state')


@receiver(post_save, sender=Plant)
@receiver(post_save, sender=Group)
@receiver(post_delete, sender=Plant)
@receiver(post_delete, sender=Group)
def update_cached_overview_state_hook(**kwargs):
    '''Update the cached overview state when Plant and Group models are saved
    or deleted (cache may be outdated)
    '''
    update_cached_overview_state.delay()
