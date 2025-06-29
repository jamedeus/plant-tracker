'''Functions that incrementally update cached states for the overview and
manage_plant pages (avoid full rebuilt when a single key changed).

Using cached states can reduce page load time when many database entries exist,
particularly the overview page (state takes 150-200ms to build with 60 plants).

Django database signals are used to create hooks that update cached states when
relevant models are created, deleted, or modified. In most cases cached states
are updated incrementally (overwrite 1 key instead of rebuilding whole state).
'''

from django.core.cache import cache
from django.dispatch import receiver
from django.db.models.signals import post_save, post_delete, pre_delete

from .models import (
    Plant,
    Group,
    WaterEvent,
    FertilizeEvent,
    PruneEvent,
    RepotEvent,
    NoteEvent,
    DivisionEvent,
)
from .build_states import get_overview_state
from .disable_for_loaddata import disable_for_loaddata


def update_instance_in_cached_overview_state(instance, key):
    '''Takes plant or group entry that was updated and key (plants or groups).
    Overwrites instance details under requested key in cached overview state.
    Removes instance from cached state if instance is archived.
    '''
    if instance.archived:
        remove_instance_from_cached_overview_state(instance, key)
    else:
        # Clear cached property (in case name changed)
        try:
            del instance.display_name
        except AttributeError:
            pass
        state = get_overview_state(instance.user)
        state[key][str(instance.uuid)] = instance.get_details()
        cache.set(f'overview_state_{instance.user.pk}', state, None)


def remove_instance_from_cached_overview_state(instance, key):
    '''Takes plant or group entry that was deleted and key (plants or groups).
    Removes instance details from requested key in cached overview state.
    '''
    state = get_overview_state(instance.user)
    if str(instance.uuid) in state[key]:
        del state[key][str(instance.uuid)]
        cache.set(f'overview_state_{instance.user.pk}', state, None)


def update_plant_details_key_in_cached_states(plant, key, value):
    '''Takes plant, key from get_details() dict, and a new value for the key.
    Updates value of key in cached overview state.
    '''
    state = get_overview_state(plant.user)
    state['plants'][str(plant.uuid)][key] = value
    cache.set(f'overview_state_{plant.user.pk}', state, None)


def update_plant_thumbnail_in_cached_overview_state(plant):
    '''Takes plant, updates thumbnail in cached overview state.'''
    update_plant_details_key_in_cached_states(
        plant,
        'thumbnail',
        plant.default_photo_details['thumbnail']
    )


@receiver(post_save, sender=Plant)
@disable_for_loaddata
def update_plant_in_cached_states_hook(instance, **kwargs):
    '''Updates all relevant caches when a Plant entry is saved:
    - Updates plant entry in cached overview state (removes if plant archived)
    - If plant is in group updates group details in cached overview state
      (number of plants in group may have changed)
    '''
    update_instance_in_cached_overview_state(instance, 'plants')
    # If plant in group: update cached group details (number of plants changed)
    if instance.group:
        update_instance_in_cached_overview_state(instance.group, 'groups')


@receiver(post_delete, sender=Plant)
def remove_deleted_plant_from_cached_states_hook(instance, **kwargs):
    '''Deletes plant from all relevant caches when a Plant entry is deleted:
    - Deletes plant from cached overview state
    - If plant is in group updates group details in cached overview state and
      cached group options (number of plants may have changed)
    '''
    remove_instance_from_cached_overview_state(instance, 'plants')
    # If plant in group: update cached group details (number of plants changed)
    if instance.group:
        update_instance_in_cached_overview_state(instance.group, 'groups')


@receiver(post_save, sender=Group)
@disable_for_loaddata
def update_group_in_cached_states_hook(instance, **kwargs):
    '''Updates group details in cached overview state when Group entry is saved.'''
    update_instance_in_cached_overview_state(instance, 'groups')


@receiver(post_delete, sender=Group)
def remove_deleted_group_from_cached_states_hook(instance, **kwargs):
    '''Deletes group from cached overview state when a Group entry is deleted.
    '''
    remove_instance_from_cached_overview_state(instance, 'groups')
