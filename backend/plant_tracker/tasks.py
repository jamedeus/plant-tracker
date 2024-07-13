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
from django.db.models.signals import post_save, post_delete

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
    get_plant_options,
    get_group_options,
    get_plant_species_options
)


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


def build_overview_state():
    '''Builds state parsed by overview react app and returns'''
    state = {
        'plants': [],
        'groups': []
    }

    for plant in Plant.objects.all():
        state['plants'].append(plant.get_details())

    for group in Group.objects.all():
        state['groups'].append(group.get_details())

    # Cache state indefinitely (updates automatically when database changes)
    cache.set('overview_state', state, None)

    # Revoke queued update tasks (prevent rebuilding again after manual call)
    revoke_queued_task('rebuild_overview_state_task_id')

    return state


def get_overview_state():
    '''Returns the state object parsed by the overview page react app.
    Loads state from cache if present, builds from database if not found.
    '''
    state = cache.get('overview_state')
    if state is None:
        state = build_overview_state()
    return state


@shared_task()
def update_cached_overview_state():
    '''Builds and caches overview state'''
    build_overview_state()
    print('Rebuilt overview state')


def schedule_cached_overview_state_update():
    '''Clears cached overview state immediately and schedules task to update
    it in 30 seconds (timer resets if called again within 30 seconds).
    '''
    schedule_cached_state_update(
        cache_name='overview_state',
        callback_task=update_cached_overview_state,
        delay=30
    )


@receiver(post_save, sender=Plant)
@receiver(post_save, sender=Group)
@receiver(post_delete, sender=Plant)
@receiver(post_delete, sender=Group)
def update_cached_overview_state_hook(**kwargs):
    '''Schedules task to update cached overview state when Plant or Group model
    is saved or deleted.
    '''
    schedule_cached_overview_state_update()


def build_manage_plant_state(uuid):
    '''Builds state parsed by manage_plant react app and returns'''

    # Look up Plant by uuid (can't pass model entry to task, not serializable)
    plant = Plant.objects.get(uuid=uuid)

    state = {
        'plant': plant.get_details(),
        'photo_urls': plant.get_photo_urls()
    }

    # Add all water and fertilize timestamps
    state['plant']['events'] = {
        'water': plant.get_water_timestamps(),
        'fertilize': plant.get_fertilize_timestamps(),
        'prune': plant.get_prune_timestamps(),
        'repot': plant.get_repot_timestamps()
    }

    # Add timestamps and text of all notes
    state['notes'] = [
        {'timestamp': note.timestamp.isoformat(), 'text': note.text}
        for note in plant.noteevent_set.all()
    ]

    # Add group details if plant is in a group
    if plant.group:
        state['plant']['group'] = {
            'name': plant.group.get_display_name(),
            'uuid': str(plant.group.uuid)
        }
    else:
        state['plant']['group'] = None

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
        state['plant']['display_name'] = plant.get_display_name()

    # Overwrite cached group name if plant is in a group (may be outdated if
    # group was renamed since cache saved)
    if plant.group:
        state['plant']['group']['name'] = plant.group.get_display_name()

    # Add species and group options (cached separately)
    state['group_options'] = get_group_options()
    state['species_options'] = get_plant_species_options()

    return state


@shared_task()
def update_cached_manage_plant_state(uuid):
    '''Builds and caches manage_plant state'''
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
@receiver(post_save, sender=WaterEvent)
@receiver(post_save, sender=FertilizeEvent)
@receiver(post_save, sender=PruneEvent)
@receiver(post_save, sender=RepotEvent)
@receiver(post_save, sender=NoteEvent)
@receiver(post_save, sender=Photo)
@receiver(post_delete, sender=WaterEvent)
@receiver(post_delete, sender=FertilizeEvent)
@receiver(post_delete, sender=PruneEvent)
@receiver(post_delete, sender=RepotEvent)
@receiver(post_delete, sender=NoteEvent)
@receiver(post_delete, sender=Photo)
def update_cached_manage_plant_state_hook(instance, **kwargs):
    '''Schedules task to update cached manage_plant state when Plant or events
    with reverse relation to Plant are modified
    '''
    if isinstance(instance, Plant):
        schedule_cached_manage_plant_state_update(instance.uuid)
    else:
        schedule_cached_manage_plant_state_update(instance.plant.uuid)


@receiver(post_delete, sender=Plant)
def delete_cached_manage_plant_state_hook(instance, **kwargs):
    '''Deletes cached manage_plant state when plant is deleted from database'''
    cache.delete(f'{instance.uuid}_state')


@shared_task()
def update_cached_plant_options():
    '''Builds and caches plant options for manage_group add plants modal'''
    get_plant_options()
    print('Rebuilt plant_options (manage_group add plants modal)')


def schedule_cached_plant_options_update():
    '''Clears cached plant_options immediately and schedules task to update it
    in 30 seconds (timer resets if called again within 30 seconds)'''
    schedule_cached_state_update(
        cache_name='plant_options',
        callback_task=update_cached_plant_options,
        delay=30
    )


@receiver(post_save, sender=Plant)
@receiver(post_delete, sender=Plant)
def update_cached_plant_options_hook(**kwargs):
    '''Schedules task to update cached plant_options when Plant is saved/deleted'''
    schedule_cached_plant_options_update()


@shared_task()
def update_cached_group_options():
    '''Builds and caches group options for manage_plant add group modal'''
    get_group_options()
    print('Rebuilt group_options (manage_plant add group modal)')


def schedule_cached_group_options_update():
    '''Clears cached group_options immediately and schedules task to update it
    in 30 seconds (timer resets if called again within 30 seconds)'''
    schedule_cached_state_update(
        cache_name='group_options',
        callback_task=update_cached_group_options,
        delay=30
    )


@receiver(post_save, sender=Group)
@receiver(post_delete, sender=Group)
def update_cached_group_options_hook(**kwargs):
    '''Schedules task to update cached group_options when Group is saved/deleted'''
    schedule_cached_group_options_update()


@shared_task()
def update_all_cached_states():
    '''Updates cached overview state and all cached manage_plant states
    Called when server starts to prevent serving outdated states
    '''
    update_cached_overview_state.delay()
    update_cached_plant_options.delay()
    update_cached_group_options.delay()
    for plant in Plant.objects.all():
        update_cached_manage_plant_state.delay(plant.uuid)
