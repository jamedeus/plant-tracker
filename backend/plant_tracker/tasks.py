'''Async tasks run by celery worker to build and cache frontend states.

Using cached states can reduce page load time when many database entries exist,
particularly the overview page (state takes 150-200ms to build with 60 plants).

Django database signals are used to create hooks that update cached states when
relevant models are created, deleted, or modified.

In most cases the schedule_cached_state_update is used to update states after a
30 second delay, preventing the same state object being built multiple times as
the user logs events on the frontend.
'''

from celery import shared_task
from django.core.cache import cache
from django.dispatch import receiver
from django.contrib.auth import get_user_model
from django.db.models.signals import post_save, post_delete, pre_delete

from backend.celery import app
from .models import (
    Plant,
    Group,
    Photo,
    WaterEvent,
    FertilizeEvent,
    PruneEvent,
    RepotEvent,
    NoteEvent,
    DivisionEvent,
    get_plant_options,
    get_group_options,
    get_plant_species_options
)
from .disable_for_loaddata import disable_for_loaddata


def revoke_queued_task(task_id_cache_name):
    '''Revokes queued tasks'''
    task_id = cache.get(task_id_cache_name)
    if task_id:
        app.control.revoke(task_id, terminate=True)
        cache.delete(task_id_cache_name)


def schedule_cached_state_update(cache_name, callback_task, callback_kwargs=None, delay=0):
    '''Clears cache_name and schedules callback_task to run in delay seconds.

    Cache is cleared immediately to prevent serving outdated state if requested
    before delay seconds. If another task with same cache_name is queued before
    delay seconds the existing queued task is revoked to prevent duplicates.

    The callback_task arg must be a function that builds a state object and
    caches it as cache_name.

    The optional callback_kwargs must be a dict of kwargs passed to callback_task.
    '''

    # Clear existing cache (prevent loading outdated state)
    cache.delete(cache_name)
    print(f'Cleared {cache_name} cache (queueing rebuild task)')

    # Revoke queued duplicate tasks (resets delay timer)
    revoke_queued_task(f'rebuild_{cache_name}_task_id')

    # Schedule callback task to run after delay seconds
    result = callback_task.apply_async(kwargs=callback_kwargs, countdown=delay)

    # Store ID of queued task so it can be canceled if this is called again
    cache.set(f'rebuild_{cache_name}_task_id', result.id, delay)


def build_overview_state(user):
    '''Takes user, builds state parsed by overview page, caches, and returns.
    Contains all non-archived plants and groups owned by user.
    '''

    # Only show link to archived overview if at least 1 archived plant or group
    has_archived_plants = bool(Plant.objects.filter(archived=True, user=user))
    has_archived_groups = bool(Group.objects.filter(archived=True, user=user))
    show_archive = has_archived_plants or has_archived_groups

    state = {
        'plants': {
            str(plant.uuid): plant.get_details()
            for plant in Plant.objects.filter(archived=False, user=user)
        },
        'groups': {
            str(group.uuid): group.get_details()
            for group in Group.objects.filter(archived=False, user=user)
        },
        'show_archive': show_archive
    }

    # Cache state indefinitely (updates automatically when database changes)
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


@shared_task()
def update_cached_overview_state(user_pk):
    '''Takes user primary key, builds and caches overview state.'''
    user = get_user_model().objects.get(pk=user_pk)
    build_overview_state(user)
    print(f'Rebuilt overview state for {user_pk}')


def update_plant_in_cached_overview_state(plant):
    '''Takes plant entry that was updated. Loads cached overview state,
    overwrites plant details with current values, and re-caches.
    '''
    state = get_overview_state(plant.user)
    state['plants'][str(plant.uuid)] = plant.get_details()
    cache.set(f'overview_state_{plant.user.pk}', state, None)


def remove_plant_from_cached_overview_state(plant):
    '''Takes plant entry that was deleted. Loads cached overview state,
    removes plant from plants key, and re-caches.
    '''
    state = get_overview_state(plant.user)
    if str(plant.uuid) in state['plants']:
        del state['plants'][str(plant.uuid)]
        cache.set(f'overview_state_{plant.user.pk}', state, None)


def update_group_in_cached_overview_state(group):
    '''Takes group entry that was updated. Loads cached overview state,
    overwrites group details with current values, and re-caches.
    '''
    state = get_overview_state(group.user)
    state['groups'][str(group.uuid)] = group.get_details()
    cache.set(f'overview_state_{group.user.pk}', state, None)


def remove_group_from_cached_overview_state(group):
    '''Takes group entry that was deleted. Loads cached overview state,
    removes group from groups key, and re-caches.
    '''
    state = get_overview_state(group.user)
    if str(group.uuid) in state['groups']:
        del state['groups'][str(group.uuid)]
        cache.set(f'overview_state_{group.user.pk}', state, None)


@receiver(post_save, sender=Plant)
def update_plant_details_in_cached_overview_state_hook(instance, **kwargs):
    '''Updates plant details in the cached overview state for the user who owns
    the updated plant. Removes plant from cached state if plant is archived.
    '''
    if instance.archived:
        remove_plant_from_cached_overview_state(instance)
    else:
        update_plant_in_cached_overview_state(instance)


@receiver(post_save, sender=Group)
def update_group_details_in_cached_overview_state_hook(instance, **kwargs):
    '''Updates group details in the cached overview state for the user who owns
    the updated group. Removes group from cached state if group is archived.
    '''
    if instance.archived:
        remove_group_from_cached_overview_state(instance)
    else:
        update_group_in_cached_overview_state(instance)


@receiver(post_delete, sender=Plant)
@receiver(post_delete, sender=Group)
@disable_for_loaddata
def remove_deleted_instance_from_cached_overview_state_hook(instance, **kwargs):
    '''Removes deleted plant or group details from the cached overview state for
    the user who owned the deleted plant or group.
    '''
    if isinstance(instance, Plant):
        remove_plant_from_cached_overview_state(instance)
    else:
        remove_group_from_cached_overview_state(instance)


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
    state['division_events'] = {
        event.timestamp.isoformat(): [
            {'name': child.get_display_name(), 'uuid': str(child.uuid)}
            for child in event.created_plants.all()
        ]
        for event in plant.divisionevent_set.all()
    }

    # Add object with parent plant details if divided from existing plant
    state['divided_from'] = {
        'name': plant.divided_from.get_display_name(),
        'uuid': str(plant.divided_from.uuid),
        'timestamp': plant.divided_from_event.timestamp.isoformat()
    } if plant.divided_from else False

    # Add group details if plant is in a group
    state['plant_details']['group'] = plant.get_group_details()

    # Cache state indefinitely (updates automatically when database changes)
    cache.set(f'{uuid}_state', state, None)

    # Revoke queued update tasks (prevent rebuilding again after manual call)
    revoke_queued_task(f'rebuild_{uuid}_state_task_id')

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

    # Overwrite cached group name if plant is in a group (may be outdated if
    # group was renamed since cache saved)
    if plant.group:
        state['plant_details']['group']['name'] = plant.group.get_display_name()

    # Add species and group options (cached separately)
    state['group_options'] = get_group_options(plant.user)
    state['species_options'] = get_plant_species_options()

    return state


@shared_task()
def update_cached_manage_plant_state(uuid):
    '''Builds and caches manage_plant state.'''
    build_manage_plant_state(uuid)
    print(f'Rebuilt {uuid} state')


def schedule_cached_manage_plant_state_update(uuid):
    '''Clears cached overview state immediately and schedules task to update
    it in 30 seconds (timer resets if called again within 30 seconds).
    '''
    schedule_cached_state_update(
        cache_name=f'{uuid}_state',
        callback_task=update_cached_manage_plant_state,
        callback_kwargs={'uuid': uuid},
        delay=30
    )


@receiver(post_save, sender=Plant)
@receiver(post_save, sender=DivisionEvent)
@receiver(post_delete, sender=DivisionEvent)
@disable_for_loaddata
def update_cached_manage_plant_state_hook(instance, **kwargs):
    '''Schedules task to update cached manage_plant state when Plant or events
    with reverse relation to Plant are modified
    '''
    if isinstance(instance, Plant):
        schedule_cached_manage_plant_state_update(instance.uuid)
        # Also rebuild parent plant state (outdated if plant name changed)
        if instance.divided_from:
            schedule_cached_manage_plant_state_update(instance.divided_from.uuid)
        # Also rebuild child plant states (outdated if plant name changed)
        for child_plant in instance.children.all():
            schedule_cached_manage_plant_state_update(child_plant.uuid)

    else:
        schedule_cached_manage_plant_state_update(instance.plant.uuid)


# Maps string retrieved with instance._meta.model_name to correct key in
# manage_plant state events dict
event_types_map = {
    'waterevent': 'water',
    'fertilizeevent': 'fertilize',
    'pruneevent': 'prune',
    'repotevent': 'repot',
}


@receiver(post_save, sender=WaterEvent)
@receiver(post_save, sender=FertilizeEvent)
@receiver(post_save, sender=PruneEvent)
@receiver(post_save, sender=RepotEvent)
def add_new_event_to_cached_manage_plant_state_hook(instance, **kwargs):
    '''Adds saved event timestamp to associated plant's cached manage_plant
    state and re-caches.
    '''
    cached_state = cache.get(f'{instance.plant.uuid}_state')
    if cached_state:
        event_type = event_types_map[instance._meta.model_name]
        cached_state['events'][event_type].append(instance.timestamp.isoformat())
        cache.set(f'{instance.plant.uuid}_state', cached_state, None)


@receiver(post_delete, sender=WaterEvent)
@receiver(post_delete, sender=FertilizeEvent)
@receiver(post_delete, sender=PruneEvent)
@receiver(post_delete, sender=RepotEvent)
def remove_deleted_event_from_cached_manage_plant_state(instance, **kwargs):
    '''Removes deleted WaterEvent timestamp from associated plant's cached
    manage_plant state and re-caches.
    '''
    cached_state = cache.get(f'{instance.plant.uuid}_state')
    if cached_state:
        event_type = event_types_map[instance._meta.model_name]
        try:
            cached_state['events'][event_type].remove(
                instance.timestamp.isoformat()
            )
            cache.set(f'{instance.plant.uuid}_state', cached_state, None)
        except ValueError:
            # Cached state did not contain event, nothing to remove
            pass


@receiver(post_save, sender=WaterEvent)
@receiver(post_save, sender=FertilizeEvent)
@receiver(post_delete, sender=WaterEvent)
@receiver(post_delete, sender=FertilizeEvent)
def update_last_event_times_in_cached_states_hook(instance, **kwargs):
    '''Updates last_watered and last_fertilized times for the associated plant
    in cached overview state and cached manage_plant state when a WaterEvent or
    FertilizeEvent is saved or deleted.
    '''
    update_plant_in_cached_overview_state(instance.plant)
    # Update last_watered/fertilized
    cached_state = cache.get(f'{instance.plant.uuid}_state')
    if cached_state:
        cached_state['plant_details'] = instance.plant.get_details()
        cache.set(f'{instance.plant.uuid}_state', cached_state, None)


@receiver(post_save, sender=Photo)
def add_photo_to_cached_states_hook(instance, **kwargs):
    '''Adds saved photo to associated plant's cached manage_plant state, updates
    associated plant details in cached overview state and plant_options.
    '''
    cached_state = cache.get(f'{instance.plant.uuid}_state')
    if cached_state:
        cached_state['photos'][instance.pk] = instance.get_details()
        cache.set(f'{instance.plant.uuid}_state', cached_state, None)
    # Update thumbnail in cached overview state if plant is not archived
    if not instance.plant.archived:
        update_plant_in_cached_overview_state(instance.plant)
    # Update thumbnail in cached plant_options dict
    update_plant_details_in_cached_plant_options(instance.plant)


@receiver(post_delete, sender=Photo)
def remove_photo_from_cached_states_hook(instance, **kwargs):
    '''Removes deleted photo from associated plant's cached manage_plant state,
    updates associated plant details in cached overview state and plant_options.
    '''
    cached_state = cache.get(f'{instance.plant.uuid}_state')
    if cached_state and instance.pk in cached_state['photos']:
        del cached_state['photos'][instance.pk]
        cache.set(f'{instance.plant.uuid}_state', cached_state, None)
    # Update thumbnail in cached overview state if plant is not archived
    if not instance.plant.archived:
        update_plant_in_cached_overview_state(instance.plant)
    # Update thumbnail in cached plant_options dict
    update_plant_details_in_cached_plant_options(instance.plant)


@receiver(post_save, sender=NoteEvent)
def update_note_in_cached_manage_plant_state_hook(instance, **kwargs):
    '''Adds note to cached manage_plant state when the note is saved.'''
    cached_state = cache.get(f'{instance.plant.uuid}_state')
    if cached_state:
        cached_state['notes'][instance.timestamp.isoformat()] = instance.text
        cache.set(f'{instance.plant.uuid}_state', cached_state, None)


@receiver(post_delete, sender=NoteEvent)
def delete_note_from_cached_manage_plant_state_hook(instance, **kwargs):
    '''Removes note from cached manage_plant state when the note is deleted.'''
    cached_state = cache.get(f'{instance.plant.uuid}_state')
    if cached_state:
        del cached_state['notes'][instance.timestamp.isoformat()]
        cache.set(f'{instance.plant.uuid}_state', cached_state, None)


@receiver(pre_delete, sender=Plant)
def delete_parent_or_child_cached_manage_plant_state_hook(instance, **kwargs):
    '''Deletes cached manage_plant state before a plant's child or parent is
    deleted from the database (prevent references to non-existing plant).
    '''
    if instance.divided_from:
        cache.delete(f'{instance.divided_from.uuid}_state')
    for child_plant in instance.children.all():
        cache.delete(f'{child_plant.uuid}_state')


@receiver(post_delete, sender=Plant)
def delete_cached_manage_plant_state_hook(instance, **kwargs):
    '''Deletes cached manage_plant state when plant is deleted from database.'''
    cache.delete(f'{instance.uuid}_state')
    # Cancel scheduled state update if present (will fail, plant doesn't exist)
    revoke_queued_task(f'rebuild_{instance.uuid}_state_task_id')


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


@receiver(post_save, sender=Plant)
def update_plant_details_in_cached_plant_options_hook(instance, **kwargs):
    '''Updates plant details in cached plant_options dict (used for manage_group
    add plants modal options) for the user who owns the updated plant.
    '''
    update_plant_details_in_cached_plant_options(instance)


@receiver(post_delete, sender=Plant)
def remove_deleted_instance_from_cached_plant_options_hook(instance, **kwargs):
    '''Removes deleted plant from the cached plant options dict for the user who
    owned the deleted plant (used for manage_group add plants modal options).
    '''
    options = get_plant_options(instance.user)
    if str(instance.uuid) in options:
        del options[str(instance.uuid)]
        cache.set(f'plant_options_{instance.user.pk}', options, None)


@shared_task()
def update_cached_plant_options(user_pk):
    '''Takes user primary key, builds and caches plant options for manage_group
    add plants modal.'''
    cache.delete(f'plant_options_{user_pk}')
    get_plant_options(get_user_model().objects.get(pk=user_pk))
    print(f'Rebuilt plant_options for {user_pk} (manage_group add plants modal)')


@shared_task()
def update_cached_group_options(user_pk):
    '''Takes user primary key, builds and caches group options for manage_plant
    add group modal.'''
    cache.delete(f'group_options_{user_pk}')
    get_group_options(get_user_model().objects.get(pk=user_pk))
    print(f'Rebuilt group_options for {user_pk} (manage_plant add group modal)')


def schedule_cached_group_options_update(user):
    '''Takes user, clears cached group_options immediately and schedules task
    to update it in 30 seconds (timer resets if called again within 30 seconds).'''
    schedule_cached_state_update(
        cache_name=f'group_options_{user.pk}',
        callback_task=update_cached_group_options,
        callback_kwargs={'user_pk': user.pk},
        delay=30
    )


@receiver(post_save, sender=Group)
@receiver(post_delete, sender=Group)
@disable_for_loaddata
def update_cached_group_options_hook(instance, **kwargs):
    '''Schedules task to update cached group_options when Group is saved/deleted.'''
    schedule_cached_group_options_update(instance.user)


@shared_task()
def update_all_cached_states():
    '''Updates all cached overview, plant_options, and group_options states
    that have keys in redis store. Updates and caches manage_plant state for
    all plants in database regardless of whether they have existing keys.
    Called when server starts to prevent serving outdated states.
    '''

    # Build states for all plants in database
    for plant in Plant.objects.all():
        update_cached_manage_plant_state.delay(plant.uuid)

    # Iterate existing keys, parse user primary key from cache name and pass
    # to correct function to rebuild
    for key in cache.keys('*'):
        if key.startswith('overview_state_'):
            update_cached_overview_state.delay(key.split('_')[-1])
        elif key.startswith('plant_options_'):
            update_cached_plant_options.delay(key.split('_')[-1])
        elif key.startswith('group_options_'):
            update_cached_group_options.delay(key.split('_')[-1])
