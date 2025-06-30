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


def update_cached_details_keys(instance, update_dict):
    '''Updates Plant or Group get_details dict in cached overview state.

    Takes Plant or Group entry and dict with one or more keys from get_details
    dict and new values, writes new values to cached overview state.

    Cannot use to add new entries to cached state (only updates if uuid exists).
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
