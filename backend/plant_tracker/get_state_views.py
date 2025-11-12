'''Views that return initial states for frontend react apps.

Contains functions that build states and extra functions to get cached overview
state and incrementally update it (called by API views that update database).

Building the overview state on each request can add >50ms to page load, but
loading from cache is practically instant and incremental updates typically
take <1ms, so this is much more efficient in most scenarios (especially when
user goes back to overview after each plant).
'''

from django.conf import settings
from django.core.cache import cache
from django.http import JsonResponse
from django.db.models import Prefetch
from django.core.exceptions import ValidationError

from .models import Plant, Group
from .plant_species_options import PLANT_SPECIES_OPTIONS
from .view_decorators import get_user_token, find_model_type


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
        user_id=group.user_id,
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


def has_archived_entries(user_id):
    '''Takes user_id, returns True if user has at least 1 archived plant or group.'''
    plant_queryset = (
        Plant.objects
        .filter(user_id=user_id, archived=True)
        .values('uuid')[:1]
    )
    group_queryset = (
        Group.objects
        .filter(user_id=user_id, archived=True)
        .values('uuid')[:1]
    )
    return bool(plant_queryset.union(group_queryset))


def get_overview_page_title(user):
    '''Takes user, returns title for the overview page.'''
    if not settings.SINGLE_USER_MODE and user.first_name:
        return f"{user.first_name}'s Plants"
    return "Plant Overview"


def build_overview_state(user, archived=False):
    '''Takes user, builds state parsed by overview page and returns.

    If archived arg is False (default) builds main overview page (contains all
    non-archived plants and groups owned by user) and caches.

    If archived arg is True builds archive overview page (contains all archived
    plants and groups owned by user), does not cache.
    '''

    # Only show link to archived overview if at least 1 archived plant or group
    show_archive = has_archived_entries(user.pk)

    # Don't build archived overview state if no archived plants or groups
    if archived and not show_archive:
        return None

    groups = Group.objects.filter(
        user_id=user.pk,
        archived=archived
    ).with_overview_annotation()

    plants = (
        Plant.objects
            .filter(user_id=user.pk, archived=archived)
            .with_overview_annotation()
            # Prefetch Group entry if plant is in a group (copy from annotated
            # group queryset above, avoids extra queries)
            .prefetch_related(Prefetch('group', queryset=groups))
    )

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
        'title': 'Archived' if archived else get_overview_page_title(user)
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


def get_overview_state_from_instance(instance):
    '''Takes plant or group, returns overview state for user that owns entry.
    Loads state from cache if present, builds from database if not found.
    '''
    state = cache.get(f'overview_state_{instance.user_id}')
    if state is None:
        state = build_overview_state(instance.user)
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
    state = get_overview_state_from_instance(instance)
    key = get_instance_overview_state_key(instance)
    if str(instance.uuid) in state[key]:
        state[key][str(instance.uuid)].update(update_dict)
        cache.set(f'overview_state_{instance.user_id}', state, None)


def add_instance_to_cached_overview_state(instance):
    '''Takes plant or group entry, adds details to cached overview state.
    If entry is archived removes from cached overview state.
    '''
    if instance.archived:
        remove_instance_from_cached_overview_state(instance)
    else:
        key = get_instance_overview_state_key(instance)
        state = get_overview_state_from_instance(instance)
        state[key][str(instance.uuid)] = instance.get_details()
        cache.set(f'overview_state_{instance.user_id}', state, None)


def remove_instance_from_cached_overview_state(instance):
    '''Takes plant or group entry, removes from cached overview state.'''
    key = get_instance_overview_state_key(instance)
    state = get_overview_state_from_instance(instance)
    if str(instance.uuid) in state[key]:
        del state[key][str(instance.uuid)]
        cache.set(f'overview_state_{instance.user_id}', state, None)


def update_cached_overview_state_show_archive_bool(user):
    '''Updates show_archive bool in cached overview state.'''
    state = get_overview_state(user)
    state['show_archive'] = has_archived_entries(user.pk)
    cache.set(f'overview_state_{user.pk}', state, None)


@get_user_token
def get_overview_page_state(_, user):
    '''Returns current overview page state for the requesting user.
    Called by SPA to get initial state for overview bundle.
    '''
    return JsonResponse(
        get_overview_state(user),
        status=200
    )


@get_user_token
def get_archived_overview_state(_, user):
    '''Returns archived overview page state for the requesting user.
    Called by SPA to get initial state for overview bundle (archived route).
    '''
    state = build_overview_state(user, archived=True)
    if not state:
        return JsonResponse({'redirect': '/'}, status=302)
    return JsonResponse(state, status=200)


@get_user_token
def get_manage_state(request, uuid, user):
    '''Returns state, title, and bundle name for the requested UUID.
    If UUID is an existing plant returns manage_plant bundle initial state.
    If UUID is an existing group returns manage_group bundle initial state.
    If UUID does not exist in database returns register bundle initial state.
    Frontend react-router uses page key to determine which bundle to load.
    '''

    try:
        model_type = find_model_type(uuid)
    except ValidationError:
        return JsonResponse({'Error': 'Requires valid UUID'}, status=400)

    if model_type == 'plant':
        plant = Plant.objects.get_with_manage_plant_annotation(uuid)
        if plant.user_id != user.pk:
            return JsonResponse(
                {"error": "plant is owned by a different user"},
                status=403
            )
        return JsonResponse({
            'page': 'manage_plant',
            'title': 'Manage Plant',
            'state': build_manage_plant_state(plant)
        }, status=200)

    if model_type == 'group':
        group = Group.objects.get_with_manage_group_annotation(uuid)
        if group.user_id != user.pk:
            return JsonResponse(
                {"error": "group is owned by a different user"},
                status=403
            )
        return JsonResponse({
            'page': 'manage_group',
            'title': 'Manage Group',
            'state': build_manage_group_state(group)
        }, status=200)

    # UUID not found: return registration page state
    return JsonResponse({
        'page': 'register',
        'title': 'Register New Plant',
        'state': { 'new_id': uuid }
    }, status=200)


@get_user_token
def get_plant_species_options(request, user):
    '''Returns list used to populate plant species combobox suggestions.
    List contains species of all plants owned by user plus default options.
    '''
    options = set(Plant.objects.filter(
        user=user,
        species__isnull=False
    ).values_list('species', flat=True))
    options.update(PLANT_SPECIES_OPTIONS)
    return JsonResponse({'options': sorted(list(options))}, status=200)


@get_user_token
def get_plant_options(request, user):
    '''Returns dict of plants with no group (populates group add plants modal).'''
    return JsonResponse(
        {'options': Plant.objects.get_add_plants_to_group_modal_options(user)},
        status=200
    )


@get_user_token
def get_add_to_group_options(request, user):
    '''Returns dict of groups (populates plant add to group modal).'''
    return JsonResponse(
        {'options': Group.objects.get_add_to_group_modal_options(user)},
        status=200
    )
