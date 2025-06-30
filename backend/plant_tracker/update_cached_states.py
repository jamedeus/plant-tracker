'''Functions that incrementally update cached overview state.

Using cached state reduces page load time (building the overview state alone
takes 5-20ms depending on number of entries, with serialization overhead this
can add >50ms to page load - loading from cache is practically instance). Since
updates typically take less than 1ms this is more efficient in most scenarios
(especially when user goes back to overview after each plant).
'''

from django.core.cache import cache

from .build_states import get_overview_state


def get_overview_state_key(instance):
    '''Returns overview state key for a Plant (plants) or Group (groups).'''
    return f'{instance._meta.model_name}s'


def update_cached_details_keys(instance, update_dict):
    '''Updates keys in Plant or Group get_details dict in cached overview state.

    Takes Plant or Group entry and dict with one or more keys from get_details
    dict and new values, writes new values to cached overview state.

    Cannot use to add new entries to cached state (only updates if uuid exists).
    '''
    state = get_overview_state(instance.user)
    key = get_overview_state_key(instance)
    if str(instance.uuid) in state[key]:
        state[key][str(instance.uuid)].update(update_dict)
        cache.set(f'overview_state_{instance.user.pk}', state, None)


def add_instance_to_cached_overview_state(instance):
    '''Takes plant or group entry, adds details to cached overview state.
    If entry is archved removes from cached overview state.
    '''
    if instance.archived:
        remove_instance_from_cached_overview_state(instance)
    else:
        key = get_overview_state_key(instance)
        state = get_overview_state(instance.user)
        state[key][str(instance.uuid)] = instance.get_details()
        cache.set(f'overview_state_{instance.user.pk}', state, None)


def remove_instance_from_cached_overview_state(instance):
    '''Takes plant or group entry, removes from cached overview state.'''
    key = get_overview_state_key(instance)
    state = get_overview_state(instance.user)
    if str(instance.uuid) in state[key]:
        del state[key][str(instance.uuid)]
        cache.set(f'overview_state_{instance.user.pk}', state, None)
