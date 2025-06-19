'''Functions that incrementally update cached states for the overview and
manage_plant pages (avoid full rebuilt when a single key changed).
'''

from django.core.cache import cache

from .models import get_plant_options, get_group_options
from .build_states import get_overview_state


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


def update_plant_details_in_cached_states(plant):
    '''Takes plant, updates all states that contain plant details:
      - Updates plant details in cached manage_plant state
      - Updates plant details in cached overview state
      - Updates plant details in cached plant_options
    '''
    cached_state = cache.get(f'{plant.uuid}_state')
    if cached_state:
        cached_state['plant_details'] = plant.get_details()
        cache.set(f'{plant.uuid}_state', cached_state, None)
    update_instance_in_cached_overview_state(plant, 'plants')
    update_plant_details_in_cached_plant_options(plant)


def update_child_plant_details_in_cached_manage_plant_state(plant):
    '''Takes plant, updates division_events key in cached state, re-caches.'''
    cached_state = cache.get(f'{plant.uuid}_state')
    if cached_state:
        cached_state['division_events'] = plant.get_division_event_details()
        cache.set(f'{plant.uuid}_state', cached_state, None)


def update_parent_plant_details_in_cached_manage_plant_state(plant):
    '''Takes plant, updates divided_from key in cached state, re-caches.'''
    cached_state = cache.get(f'{plant.uuid}_state')
    if cached_state:
        cached_state['divided_from'] = plant.get_parent_plant_details()
        cache.set(f'{plant.uuid}_state', cached_state, None)


def clear_cached_plant_lists(user):
    '''Takes user, clears cached unnamed_plants list (used to get sequential
    "Unnamed plant <num>" names) and species_options list.
    '''
    cache.delete(f'unnamed_plants_{user.pk}')
    cache.delete('species_options')


def update_plant_details_in_cached_plant_options(plant):
    '''Takes Plant entry, updates details in cached plant_options dict (used for
    manage_group add plants modal options) for the user who owns updated plant.

    If plant is not in a group: add to options dict (or update details).
    If plant was just added to a group: remove from options dict.
    If plant was already in a group (isn't in options dict): do nothing.
    '''
    options = get_plant_options(plant.user)
    # Plant not in group
    if not plant.group:
        options[str(plant.uuid)] = plant.get_details()
        cache.set(f'plant_options_{plant.user.pk}', options, None)
    # Plant was just added to group
    elif str(plant.uuid) in options:
        del options[str(plant.uuid)]
        cache.set(f'plant_options_{plant.user.pk}', options, None)


def remove_plant_from_cached_plant_options(plant):
    '''Takes Plant entry, removes from cached plant options dict (used for
    manage_group add plants modal options) for user who owns plant.
    '''
    options = get_plant_options(plant.user)
    if str(plant.uuid) in options:
        del options[str(plant.uuid)]
        cache.set(f'plant_options_{plant.user.pk}', options, None)


def update_group_details_in_cached_group_options(group):
    '''Takes Group entry, updates details in cached group_options dict (used for
    manage_plant add to group modal options) for the user who owns updated group.
    '''
    options = get_group_options(group.user)
    options[str(group.uuid)] = group.get_details()
    cache.set(f'group_options_{group.user.pk}', options, None)


def remove_deleted_group_from_cached_group_options(instance, **kwargs):
    '''Takes group entry, removes from cached group_options dict (used for
    manage_plant add to group modal options) for the user who owns deleted group.
    '''
    options = get_group_options(instance.user)
    if str(instance.uuid) in options:
        del options[str(instance.uuid)]
        cache.set(f'group_options_{instance.user.pk}', options, None)


def update_group_details_in_cached_states(group):
    '''Takes group, updates all states that contain group details:
      - Updates group details in cached overview state
      - Updates group details in cached group_options
    '''
    update_instance_in_cached_overview_state(group, 'groups')
    update_group_details_in_cached_group_options(group)
