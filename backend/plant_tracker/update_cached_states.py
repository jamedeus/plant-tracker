'''Functions that incrementally update cached states for the overview and
manage_plant pages (avoid full rebuilt when a single key changed).

Using cached states can reduce page load time when many database entries exist,
particularly the overview page (state takes 150-200ms to build with 60 plants).

Django database signals are used to create hooks that update cached states when
relevant models are created, deleted, or modified. In most cases cached states
are updated incrementally (overwrite 1 key instead of rebuilding whole state).
'''

from django.core.cache import cache

from .models import Plant
from .build_states import get_overview_state


def bulk_update_instance_details_keys(instance, update_dict):
    '''Takes plant or group instance and dict with a subset of their get_details
    dict keys with new values, writes new values to cached overview state.

    Cannot be used to add new plants/groups to cached overview state (only
    updates if uuid already exists).
    '''
    state = get_overview_state(instance.user)
    key = 'plants' if isinstance(instance, Plant) else 'groups'
    if str(instance.uuid) in state[key]:
        state[key][str(instance.uuid)].update(update_dict)
        cache.set(f'overview_state_{instance.user.pk}', state, None)


def update_instance_in_cached_overview_state(instance, key):
    '''Takes plant or group entry that was updated and key (plants or groups).
    Overwrites instance details under requested key in cached overview state.
    Removes instance from cached state if instance is archived.
    '''
    if instance.archived:
        remove_instance_from_cached_overview_state(instance, key)
    else:
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


def update_group_details_key_in_cached_states(group, key, value):
    '''Takes group, key from get_details() dict, and a new value for the key.
    Updates value of key in cached overview state.
    '''
    state = get_overview_state(group.user)
    state['groups'][str(group.uuid)][key] = value
    cache.set(f'overview_state_{group.user.pk}', state, None)


def update_plant_thumbnail_in_cached_overview_state(plant):
    '''Takes plant, updates thumbnail in cached overview state.'''
    update_plant_details_key_in_cached_states(
        plant,
        'thumbnail',
        plant.default_photo_details['thumbnail']
    )
