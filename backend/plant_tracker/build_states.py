'''Functions that build (or load from cache) states used by frontend react apps.'''

from django.core.cache import cache
from django.db.models import F, Case, When, Value, Subquery, OuterRef, Count, Prefetch, Exists
from django.db.models.functions import RowNumber
from django.db.models import Window, JSONField
from django.contrib.postgres.expressions import ArraySubquery
from django.db.models.functions import JSONObject

from .models import (
    Plant,
    Group,
    Photo,
    WaterEvent,
    FertilizeEvent,
    PruneEvent,
    RepotEvent,
    DivisionEvent
)


def plant_is_unnamed_annotation():
    '''Adds is_unnamed attribute (True if no name or species, default False).'''
    return {'is_unnamed': Case(
        When(name__isnull=True, species__isnull=True, then=Value(True)),
        default=Value(False)
    )}


def group_is_unnamed_annotation():
    '''Adds is_unnamed attribute (True if no name or location, default False).'''
    return {'is_unnamed': Case(
        When(name__isnull=True, location__isnull=True, then=Value(True)),
        default=Value(False)
    )}


def unnamed_index_annotation():
    '''Adds unnamed_index attribute (sequential ints) to items with is_unnamed=True.'''
    return {'unnamed_index': Window(
        expression=RowNumber(),
        partition_by=[F('is_unnamed')],
        order_by=F('created').asc(),
    )}


def last_watered_time_annotation():
    '''Adds last_watered_time attribute (most-recent WaterEvent timestamp).'''
    return {'last_watered_time': Subquery(
        WaterEvent.objects
            .filter(plant_id=OuterRef("pk"))
            .values("timestamp")[:1]
    )}


def last_fertilized_time_annotation():
    '''Adds last_fertilized_time attribute (most-recent WaterEvent timestamp).'''
    return {'last_fertilized_time': Subquery(
        FertilizeEvent.objects
            .filter(plant_id=OuterRef("pk"))
            .values("timestamp")[:1]
    )}


def last_photo_thumbnail_annotation():
    '''Adds last_photo_thumbnail attribute with name of most-recent Photo entry.'''
    return {'last_photo_thumbnail': Subquery(
        Photo.objects
            .filter(plant_id=OuterRef("pk"))
            .order_by("-timestamp")
            .values("thumbnail")[:1]
    )}


def last_photo_details_annotation():
    '''Adds last_photo_details attribute with dict containing all relevant
    attributes of most-recent Photo entry.
    '''
    return {"last_photo_details": Subquery(
        Photo.objects
            .filter(plant_id=OuterRef("pk"))
            .order_by("-timestamp")
            .annotate(
                details=JSONObject(
                    key=F("pk"),
                    photo=F("photo"),
                    thumbnail=F("thumbnail"),
                    preview=F("preview"),
                    timestamp=F("timestamp"),
                )
            )
            .values("details")[:1],
            output_field=JSONField()
    )}


def group_plant_count_annotation():
    '''Adds plant_count attribute (number of plants in group).'''
    return {'plant_count': Count('plant')}


def get_plant_options(user):
    '''Takes user, returns dict with all of user's plants with no group (uuids
    as keys, details dicts as values). Populates options in add plants modal on
    manage_group page. Cached until Plant model changes (see hooks in tasks.py).
    '''
    plant_options = cache.get(f'plant_options_{user.pk}')
    if not plant_options:
        plant_options = {
            str(plant.uuid): plant.get_details()
            for plant in Plant.objects
                .filter(user=user)
                .order_by('created')
                .select_related('group')
                .annotate(**plant_is_unnamed_annotation())
                .annotate(**unnamed_index_annotation())
                .annotate(**last_watered_time_annotation())
                .annotate(**last_fertilized_time_annotation())
                .annotate(**last_photo_thumbnail_annotation())
                .select_related('default_photo')
            if plant.group is None
        }
        # cache.set(f'plant_options_{user.pk}', plant_options, None)
    return plant_options


def get_group_options(user):
    '''Takes user, returns dict with all of user's groups (uuids as keys,
    details) dicts as values). Populates options in add to group modal on
    manage_plant page. Cached until Group model changes (see hooks in tasks.py).
    '''
    group_options = cache.get(f'group_options_{user.pk}')
    if not group_options:
        group_options = {
            str(group.uuid): group.get_details()
            for group in Group.objects
                .filter(user=user)
                .order_by('created')
                .annotate(**group_is_unnamed_annotation())
                .annotate(**unnamed_index_annotation())
                .annotate(**group_plant_count_annotation())
        }
        # cache.set(f'group_options_{user.pk}', group_options, None)
    return group_options


def build_overview_state(user):
    '''Takes user, builds state parsed by overview page, caches, and returns.
    Contains all non-archived plants and groups owned by user.
    '''

    # Only show link to archived overview if at least 1 archived plant or group
    has_archived_plants = bool(Plant.objects.filter(archived=True, user=user))
    has_archived_groups = bool(Group.objects.filter(archived=True, user=user))
    show_archive = has_archived_plants or has_archived_groups

    groups = (
        Group.objects
            .filter(user=user, archived=False)
            .order_by('created')
            # Label unnamed groups with no location (gets sequential name)
            .annotate(**group_is_unnamed_annotation())
            # Add unnamed_index (used to build "Unnamed group <index>" names)
            .annotate(**unnamed_index_annotation())
            # Add plant_count (number of plants in group)
            .annotate(**group_plant_count_annotation())
    )

    plants = (
        Plant.objects
            .filter(user=user, archived=False)
            .order_by('created')
            # Label unnamed plants with no species (gets sequential name)
            .annotate(**plant_is_unnamed_annotation())
            # Add unnamed_index (used to build "Unnamed plant <index>" names)
            .annotate(**unnamed_index_annotation())
            # Add last_watered_time
            .annotate(**last_watered_time_annotation())
            # Add last_fertilized_time
            .annotate(**last_fertilized_time_annotation())
            # Add last_photo_details (used as default photo if not set)
            .annotate(**last_photo_thumbnail_annotation())
            # Include default_photo if set (avoid extra query for thumbnail)
            .select_related('default_photo')
            # Include Group entry if plant in a group (copy from groups queryset
            # with unnamed annotated to avoid extra get_display_name queries)
            .prefetch_related(
                Prefetch(
                    'group',
                    queryset=groups
                )
            )
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
    # cache.set(f'overview_state_{user.pk}', state, None)

    return state


def get_overview_state(user):
    '''Takes user, returns state object parsed by the overview page react app.
    Loads state from cache if present, builds from database if not found.
    '''
    state = cache.get(f'overview_state_{user.pk}')
    if state is None:
        state = build_overview_state(user)
    return state


def build_manage_plant_state(uuid):
    '''Builds state parsed by manage_plant react app and returns.'''

    # Look up Plant by uuid (can't pass model entry to task, not serializable)
    plant = (
        Plant.objects
            .filter(uuid=uuid)
            # Add last_watered_time
            .annotate(**last_watered_time_annotation())
            # Add last_fertilized_time
            .annotate(**last_fertilized_time_annotation())
            # Add last_photo_details (used as default photo if not set)
            .annotate(**last_photo_details_annotation())
            # Include default_photo if set (avoid extra query for thumbnail)
            .select_related('default_photo')
            # Include Group entry if plant in a group
            .select_related('group')
            # Include parent plant + division event if plant was divided
            .select_related('divided_from', 'divided_from_event')
            # Add <event_type>_timetamps attributes containing lists of event
            # timestamps (sorted chronologically at database level)
            .annotate(
                water_timestamps=ArraySubquery(
                    WaterEvent.objects
                        .filter(plant_id=OuterRef('pk'))
                        .values_list('timestamp', flat=True)
                ),
                fertilize_timestamps=ArraySubquery(
                    FertilizeEvent.objects
                        .filter(plant_id=OuterRef('pk'))
                        .values_list('timestamp', flat=True)
                ),
                prune_timestamps=ArraySubquery(
                    PruneEvent.objects
                        .filter(plant_id=OuterRef('pk'))
                        .values_list('timestamp', flat=True)
                ),
                repot_timestamps=ArraySubquery(
                    RepotEvent.objects
                        .filter(plant_id=OuterRef('pk'))
                        .values_list('timestamp', flat=True)
                ),
            )
            # Annotate whether DivisionEvents exist (skips extra query if not)
            .annotate(
                has_divisions=Exists(
                    DivisionEvent.objects.filter(plant=OuterRef('pk'))
                )
            )
            .first()
    )

    state = {
        'plant_details': plant.get_details(),
        'photos': plant.get_photos(),
        'default_photo': plant.get_default_photo_details()
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
    '''
    state = cache.get(f'{plant.uuid}_state')
    if state is None:
        state = build_manage_plant_state(plant.uuid)

    # Overwrite cached display_name if plant has no name (sequential names like)
    # "Unnamed plant 3" may be outdated if other unnamed plants were named)
    if not plant.name:
        state['plant_details']['display_name'] = plant.get_display_name()

    # Overwrite cached group details if plant is in a group (may be outdated if
    # group was renamed or QR code changed since cache saved)
    if plant.group:
        state['plant_details']['group'] = plant.get_group_details()

    # Add group options (cached separately)
    state['group_options'] = get_group_options(plant.user)

    return state


def build_manage_group_state(group):
    '''Builds state parsed by manage_group react app and returns.'''

    plants = (
        Plant.objects
            .filter(group_id=group.pk)
            .order_by('created')
            # Label unnamed plants with no species (gets sequential name)
            .annotate(**plant_is_unnamed_annotation())
            # Add unnamed_index (used to build "Unnamed plant <index>" names)
            .annotate(**unnamed_index_annotation())
            # Add last_watered_time
            .annotate(**last_watered_time_annotation())
            # Add last_fertilized_time
            .annotate(**last_fertilized_time_annotation())
            # Add last_photo_details (used as default photo if not set)
            .annotate(**last_photo_thumbnail_annotation())
            # Include default_photo if set (avoid extra query for thumbnail)
            .select_related('default_photo')
    )

    # Overwrite group with already-loaded entry (avoids database query for each
    # plant, more efficient than select_related since same instance is reused)
    for plant in plants:
        plant.group = group

    return {
        'group': group.get_details(),
        'details': {
            str(plant.uuid): plant.get_details() for plant in plants
        },
        'options': get_plant_options(group.user)
    }
