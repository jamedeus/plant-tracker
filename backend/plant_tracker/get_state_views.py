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
from .view_decorators import get_user_token, find_model_type, get_plant_or_group_by_uuid


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


def build_register_state(new_uuid, user):
    '''Returns initial state for register page. Called by /get_manage_state
    endpoint if UUID does not exist in database.

    If the old_uuid cache is set (see /change_qr_code endpoint) context includes
    information used by frontend to show change QR prompt (calls /change_uuid
    and redirects if confirmed, shows normal registration form if rejected).

    If the dividing_from cache is set (see /divide_plant endpoint) context
    includes information used by frontend to show confirm dividing prompt (shows
    plant form with pre-filled details if confirmed, shows normal registration
    form if rejected).
    '''
    state = { 'new_id': new_uuid }

    # Include context for changing QR code if present
    old_uuid = cache.get(f'old_uuid_{user.pk}')
    if old_uuid:
        instance = get_plant_or_group_by_uuid(old_uuid, annotate=True)
        if instance:
            state['changing_qr_code'] = {
                'type': instance._meta.model_name,
                'instance': instance.get_details(),
                'new_uuid': new_uuid
            }
            if state['changing_qr_code']['type'] == 'plant':
                preview_url = instance.get_default_photo_details()['preview']
                state['changing_qr_code']['preview'] = preview_url
        else:
            cache.delete(f'old_uuid_{user.pk}')

    # Include context for dividing plant if present
    division_in_progress = cache.get(f'division_in_progress_{user.pk}')
    if division_in_progress:
        plant = Plant.objects.get_with_overview_annotation(
            uuid=division_in_progress['divided_from_plant_uuid']
        )
        if plant:
            state['dividing_from'] = {
                'plant_details': plant.get_details(),
                'default_photo': plant.get_default_photo_details(),
                'plant_key': str(plant.pk),
                'event_key': division_in_progress['division_event_key']
            }

    return state


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
        if plant.user != user:
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
        if group.user != user:
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
        'state': build_register_state(uuid, user)
    }, status=200)


def get_plant_species_options(request):
    '''Returns list used to populate plant species combobox suggestions.'''
    species = Plant.objects.all().values_list('species', flat=True)
    options = sorted(list(set(i for i in species if i is not None)))
    return JsonResponse({'options': options}, status=200)


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
