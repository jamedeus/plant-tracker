'''Functions that build (or load from cache) states used by frontend react apps.'''

from django.core.cache import cache

from .models import Plant, Group


def get_plant_options(user):
    '''Takes user, returns dict with all of user's plants with no group (uuids
    as keys, details dicts as values). Populates options in add plants modal on
    manage_group page. Cached until Plant model changes (see hooks in tasks.py).
    '''
    return {
        str(plant.uuid): plant.get_details()
        for plant in Plant.objects.with_overview_annotation(
            user=user,
            filters={'archived': False}
        )
        if plant.group is None
    }


def get_group_options(user):
    '''Takes user, returns dict with all of user's groups (uuids as keys,
    details) dicts as values). Populates options in add to group modal on
    manage_plant page. Cached until Group model changes (see hooks in tasks.py).
    '''
    return {
        str(group.uuid): group.get_details()
        for group in Group.objects.with_overview_annotation(
            user=user,
            filters={'archived': False}
        )
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

    groups = Group.objects.with_overview_annotation(
        user=user,
        filters={'archived': archived}
    )

    plants = Plant.objects.with_overview_annotation(
        user=user,
        group_queryset=groups,
        filters={'archived': archived}
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
        'show_archive': show_archive
    }

    # Cache state indefinitely (updates automatically when database changes)
    # if not archived:
    #     cache.set(f'overview_state_{user.pk}', state, None)

    return state


def get_overview_state(user):
    '''Takes user, returns state object parsed by the overview page react app.
    Loads state from cache if present, builds from database if not found.
    '''
    state = cache.get(f'overview_state_{user.pk}')
    if state is None:
        state = build_overview_state(user)
    return state


def build_manage_plant_state(plant):
    '''Takes plant, builds state parsed by manage_plant react app and returns.'''

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

    # Cache state indefinitely (updates automatically when database changes)
    # cache.set(f'{uuid}_state', state, None)

    return state


def get_manage_plant_state(plant):
    '''Returns the state object parsed by the manage_plant page react app.
    Loads state from cache if present, builds from database if not found.
    Updates params that can't be reliably cached with values from database.
    Plant should be queried with Plant.objects.with_manage_plant_annotation to
    pre-annotate all data used (much more efficient, avoids dozens of queries).
    '''
    state = cache.get(f'{plant.uuid}_state')

    # Build state if cache not found
    if state is None:
        state = build_manage_plant_state(plant)

    # If loaded from cache overwrite potentially outdated properties
    else:
        # Overwrite display_name if plant has no name (sequential names like)
        # "Unnamed plant 3" may be outdated if other unnamed plants were named)
        if not plant.name:
            state['plant_details']['display_name'] = plant.display_name

        # Overwrite group details if plant is in a group (may be outdated if
        # group was renamed or QR code changed since cache saved)
        if plant.group:
            state['plant_details']['group'] = plant.get_group_details()

    return state


def build_manage_group_state(group):
    '''Builds state parsed by manage_group react app and returns.'''

    plants = Plant.objects.with_overview_annotation(
        user=group.user,
        filters={'group_id': group.pk}
    )

    # Overwrite group with already-loaded entry (avoids database query for each
    # plant, more efficient than select_related since same instance is reused)
    for plant in plants:
        plant.group = group

    return {
        'group': group.get_details(),
        'details': {
            str(plant.uuid): plant.get_details() for plant in plants
        }
    }
