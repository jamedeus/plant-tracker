'''Functions that build (or load from cache) states used by frontend react apps.'''

from django.core.cache import cache
from django.db.models import F, Case, When, Value
from django.db.models.functions import RowNumber
from django.db.models import Window

from .models import (
    Plant,
    Group,
    get_group_options,
    get_plant_species_options
)


def build_overview_state(user):
    '''Takes user, builds state parsed by overview page, caches, and returns.
    Contains all non-archived plants and groups owned by user.
    '''

    # Only show link to archived overview if at least 1 archived plant or group
    has_archived_plants = bool(Plant.objects.filter(archived=True, user=user))
    has_archived_groups = bool(Group.objects.filter(archived=True, user=user))
    show_archive = has_archived_plants or has_archived_groups

    plants = (
        Plant.objects
            .filter(user=user, archived=False)
            .order_by('created')
            # Label unnamed plants with no species (gets sequential name)
            .annotate(
                is_unnamed=Case(
                    When(name__isnull=True, species__isnull=True, then=Value(True)),
                    default=Value(False)
                )
            )
            # Add unnamed_index (used to build "Unnamed plant <index>" names)
            .annotate(
                unnamed_index=Window(
                    expression=RowNumber(),
                    partition_by=[F('is_unnamed')],
                    order_by=F('created').asc(),
                )
            )
    )

    groups = (
        Group.objects
            .filter(user=user, archived=False)
            .order_by('created')
            # Label unnamed groups with no location (gets sequential name)
            .annotate(
                is_unnamed=Case(
                    When(name__isnull=True, location__isnull=True, then=Value(True)),
                    default=Value(False)
                )
            )
            # Add unnamed_index (used to build "Unnamed group <index>" names)
            .annotate(
                unnamed_index=Window(
                    expression=RowNumber(),
                    partition_by=[F('is_unnamed')],
                    order_by=F('created').asc(),
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
    plant = Plant.objects.get(uuid=uuid)

    state = {
        'plant_details': plant.get_details(),
        'photos': plant.get_photos(),
        'default_photo': plant.get_default_photo_details()
    }

    # Add all water, fertilize, prune, and repot timestamps
    state['events'] = {
        'water': plant.get_water_timestamps(),
        'fertilize': plant.get_fertilize_timestamps(),
        'prune': plant.get_prune_timestamps(),
        'repot': plant.get_repot_timestamps()
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

    # Add species and group options (cached separately)
    state['group_options'] = get_group_options(plant.user)
    state['species_options'] = get_plant_species_options()

    return state
