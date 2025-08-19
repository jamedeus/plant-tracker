'''Functions that build states used by frontend react apps.

Contains extra functions to get cached overview state and incrementally update
cached overview state.

Building the overview state on each request can add >50ms to page load, but
loading from cache is practically instant and incremental updates typically
take <1ms, so this is much more efficient in most scenarios (especially when
user goes back to overview after each plant).
'''

from django.conf import settings
from django.core.cache import cache
from django.db.models import Prefetch

from .models import Plant, Group


def build_manage_plant_state(plant):
    '''Takes plant, builds state parsed by manage_plant react app and returns.

    Plant should be queried with Plant.objects.get_with_manage_plant_annotation
    to annotate all data used (much more efficient, avoids dozens of queries).
    '''

    state = {
        'plant_details': plant.get_details(),
        'photos': plant.get_photos(),
        'default_photo': plant.default_photo_details
    }

    # Add all water, fertilize, prune, and repot timestamps
    state['events'] = {
        'water': [e.isoformat() for e in plant.water_timestamps],
        'fertilize': [e.isoformat() for e in plant.fertilize_timestamps],
        'prune': [e.isoformat() for e in plant.prune_timestamps],
        'repot': [e.isoformat() for e in plant.repot_timestamps],
    }

    # Add notes dict with timestamps as keys and text as values
    state['notes'] = {
        note.timestamp.isoformat(): note.text
        for note in plant.noteevent_set.all()
    }

    # Add object with DivisionEvent timestamps as keys, list of child plant
    # objects as values (adds events to timeline with links to children)
    state['division_events'] = plant.get_division_event_details()

    # Add object with parent plant details if divided from existing plant
    state['divided_from'] = plant.get_parent_plant_details()

    return state


def build_manage_group_state(group):
    '''Builds state parsed by manage_group react app and returns.'''

    plants = Plant.objects.filter(
        user=group.user,
        group_id=group.pk
    ).with_overview_annotation()

    # Overwrite group with already-loaded entry (avoids database query for each
    # plant, more efficient than select_related since same instance is reused)
    for plant in plants:
        plant.group = group

    return {
        'group_details': group.get_details(),
        'plants': {
            str(plant.uuid): plant.get_details() for plant in plants
        }
    }


def has_archived_entries(user):
    '''Takes user, returns True if user has at least 1 archived plant or group.'''
    plant_queryset = (
        Plant.objects
        .filter(user=user, archived=True)
        .values('uuid')[:1]
    )
    group_queryset = (
        Group.objects
        .filter(user=user, archived=True)
        .values('uuid')[:1]
    )
    return bool(plant_queryset.union(group_queryset))


def build_overview_state(user, archived=False):
    '''Takes user, builds state parsed by overview page and returns.

    If archived arg is False (default) builds main overview page (contains all
    non-archived plants and groups owned by user) and caches.

    If archived arg is True builds archive overview page (contains all archived
    plants and groups owned by user), does not cache.
    '''

    # Only show link to archived overview if at least 1 archived plant or group
    show_archive = has_archived_entries(user)

    # Don't build archived overview state if no archived plants or groups
    if archived and not show_archive:
        return None

    groups = Group.objects.filter(
        user=user,
        archived=archived
    ).with_overview_annotation()

    plants = (
        Plant.objects
            .filter(user=user, archived=archived)
            .with_overview_annotation()
            # Prefetch Group entry if plant is in a group (copy from annotated
            # group queryset above, avoids extra queries)
            .prefetch_related(Prefetch('group', queryset=groups))
    )

    # Add title for navbar
    if archived:
        title = "Archived"
    elif not settings.SINGLE_USER_MODE and user.first_name:
        title = f"{user.first_name}'s Plants"
    else:
        title = "Plant Overview"

    state = {
        'plants': {
            str(plant.uuid): plant.get_details()
            for plant in plants
        },
        'groups': {
            str(group.uuid): group.get_details()
            for group in groups
        },
        'show_archive': show_archive,
        'title': title
    }

    # Cache state indefinitely (updates automatically when database changes)
    if not archived:
        cache.set(f'overview_state_{user.pk}', state, None)

    return state


def get_overview_state(user):
    '''Takes user, returns state object parsed by the overview page react app.
    Loads state from cache if present, builds from database if not found.
    '''
    state = cache.get(f'overview_state_{user.pk}')
    if state is None:
        state = build_overview_state(user)
    return state


def get_instance_overview_state_key(instance):
    '''Returns overview state key for a Plant (plants) or Group (groups).'''
    return f'{instance._meta.model_name}s'


def update_cached_overview_details_keys(instance, update_dict):
    '''Updates keys in Plant or Group get_details dict in cached overview state.

    Takes Plant or Group entry and dict with one or more keys from get_details
    dict and new values, writes new values to cached overview state.

    Cannot use to add new entries to cached state (only updates if uuid exists).
    '''
    state = get_overview_state(instance.user)
    key = get_instance_overview_state_key(instance)
    if str(instance.uuid) in state[key]:
        state[key][str(instance.uuid)].update(update_dict)
        cache.set(f'overview_state_{instance.user.pk}', state, None)


def add_instance_to_cached_overview_state(instance):
    '''Takes plant or group entry, adds details to cached overview state.
    If entry is archived removes from cached overview state.
    '''
    if instance.archived:
        remove_instance_from_cached_overview_state(instance)
    else:
        key = get_instance_overview_state_key(instance)
        state = get_overview_state(instance.user)
        state[key][str(instance.uuid)] = instance.get_details()
        cache.set(f'overview_state_{instance.user.pk}', state, None)


def remove_instance_from_cached_overview_state(instance):
    '''Takes plant or group entry, removes from cached overview state.'''
    key = get_instance_overview_state_key(instance)
    state = get_overview_state(instance.user)
    if str(instance.uuid) in state[key]:
        del state[key][str(instance.uuid)]
        cache.set(f'overview_state_{instance.user.pk}', state, None)


def update_cached_overview_state_show_archive_bool(user):
    '''Updates show_archive bool in cached overview state.'''
    state = get_overview_state(user)
    state['show_archive'] = has_archived_entries(user)
    cache.set(f'overview_state_{user.pk}', state, None)
