'''Async tasks run by celery worker to build and cache frontend states.

Using cached states can reduce page load time when many database entries exist,
particularly the overview page (state takes 150-200ms to build with 60 plants).

Django database signals are used to create hooks that update cached states when
relevant models are created, deleted, or modified. In most cases cached states
are updated incrementally (overwrite 1 key instead of rebuilding whole state).
'''

from celery import shared_task
from django.core.cache import cache
from django.dispatch import receiver
from django.contrib.auth import get_user_model
from django.db.models.signals import post_save, post_delete, pre_delete

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
)
from .disable_for_loaddata import disable_for_loaddata
from .update_cached_states import (
    remove_instance_from_cached_overview_state,
    update_plant_details_in_cached_states,
    update_child_plant_details_in_cached_manage_plant_state,
    update_parent_plant_details_in_cached_manage_plant_state,
    clear_cached_plant_lists,
    remove_plant_from_cached_plant_options,
    remove_deleted_group_from_cached_group_options,
    update_group_details_in_cached_states
)
from .build_states import build_overview_state, build_manage_plant_state


@shared_task()
def update_cached_overview_state(user_pk):
    '''Takes user primary key, builds and caches overview state.'''
    user = get_user_model().objects.get(pk=user_pk)
    build_overview_state(user)
    print(f'Rebuilt overview state for {user_pk}')


@shared_task()
def update_cached_manage_plant_state(uuid):
    '''Builds and caches manage_plant state.'''
    build_manage_plant_state(uuid)
    print(f'Rebuilt {uuid} state')


@receiver(post_save, sender=Plant)
@disable_for_loaddata
def update_plant_in_cached_states_hook(instance, **kwargs):
    '''Updates all relevant caches when a Plant entry is saved:
    - Updates `plant_details` key in plant's cached manage_plant state
    - Updates plant entry in cached plant_options dict
    - Updates plant entry in cached overview state (removes if plant archived)
    - If plant has parent updates `division_events` key in parent plant's cached
      manage_plant state (child name/uuid may be outdated)
    - If plant has children updates `divided_from` key in parent all child plant
      cached manage_plant state(s) (parent name/uuid may be outdated)
    - Deletes cached unnamed_plants and species_options lists
    - If plant is in group updates group details in cached overview state and
      cached group options (number of plants may have changed)
    '''
    # Clear cached lists (may contain outdated name/species)
    clear_cached_plant_lists(instance.user)
    update_plant_details_in_cached_states(instance)
    # Update parent plant state ("Divided into" outdated if plant name changed)
    if instance.divided_from:
        update_child_plant_details_in_cached_manage_plant_state(instance.divided_from)
    # Update child plant states ("Divided from" outdated if plant name changed)
    for child_plant in instance.children.all():
        update_parent_plant_details_in_cached_manage_plant_state(child_plant)
    # If plant in group: update cached group details (number of plants changed)
    if instance.group:
        update_group_details_in_cached_states(instance.group)


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
def remove_deleted_plant_from_cached_states_hook(instance, **kwargs):
    '''Deletes plant from all relevant caches when a Plant entry is deleted:
    - Deletes plant from cached overview state
    - Deletes plant from cached plant_options dict
    - Deletes plant's cached manage_plant state completely
    - Deletes cached unnamed_plants and species_options lists
    - If plant is in group updates group details in cached overview state and
      cached group options (number of plants may have changed)
    '''
    remove_instance_from_cached_overview_state(instance, 'plants')
    remove_plant_from_cached_plant_options(instance)
    cache.delete(f'{instance.uuid}_state')
    clear_cached_plant_lists(instance.user)
    # If plant in group: update cached group details (number of plants changed)
    if instance.group:
        update_group_details_in_cached_states(instance.group)


@receiver(post_save, sender=DivisionEvent)
@receiver(post_delete, sender=DivisionEvent)
@disable_for_loaddata
def update_division_events_in_cached_manage_plant_state_hook(instance, **kwargs):
    '''Updates division_events key in cached manage_plant state when a
    DivisionEvent is created or deleted.
    '''
    update_child_plant_details_in_cached_manage_plant_state(instance.plant)


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
@disable_for_loaddata
def add_new_event_to_cached_manage_plant_state_hook(instance, **kwargs):
    '''Adds saved event timestamp to associated plant's cached manage_plant
    state and re-caches.
    '''
    cached_state = cache.get(f'{instance.plant.uuid}_state')
    if cached_state:
        event_type = event_types_map[instance._meta.model_name]
        cached_state['events'][event_type].append(instance.timestamp.isoformat())
        cached_state['events'][event_type].sort()
        cached_state['events'][event_type].reverse()
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
@disable_for_loaddata
def update_last_event_times_in_cached_states_hook(instance, **kwargs):
    '''Updates last_watered and last_fertilized times for the associated plant
    in cached overview state, cached manage_plant state, and cached plant
    options when a WaterEvent or FertilizeEvent is saved or deleted.
    '''
    update_plant_details_in_cached_states(instance.plant)


@receiver(post_save, sender=Photo)
@disable_for_loaddata
def add_photo_to_cached_states_hook(instance, **kwargs):
    '''Adds saved photo to associated plant's cached manage_plant state, updates
    default_photo in cached manage_plant state, overview state, and cached
    plant_options when a photo is saved.
    '''
    cached_state = cache.get(f'{instance.plant.uuid}_state')
    if cached_state:
        cached_state['photos'][instance.pk] = instance.get_details()
        default_photo = instance.plant.get_default_photo_details()
        cached_state['default_photo'] = default_photo
        cache.set(f'{instance.plant.uuid}_state', cached_state, None)
    update_plant_details_in_cached_states(instance.plant)


@receiver(post_delete, sender=Photo)
def remove_photo_from_cached_states_hook(instance, **kwargs):
    '''Removes deleted photo from associated plant's cached manage_plant state,
    updates default_photo in cached manage_plant state, overview state, and
    cached plant_options when a photo is deleted.
    '''
    cached_state = cache.get(f'{instance.plant.uuid}_state')
    if cached_state and instance.pk in cached_state['photos']:
        del cached_state['photos'][instance.pk]
        default_photo = instance.plant.get_default_photo_details()
        cached_state['default_photo'] = default_photo
        cache.set(f'{instance.plant.uuid}_state', cached_state, None)
    update_plant_details_in_cached_states(instance.plant)


@receiver(post_save, sender=NoteEvent)
@disable_for_loaddata
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


@shared_task()
def update_cached_plant_options(user_pk):
    '''Takes user primary key, builds and caches plant options for manage_group
    add plants modal.'''
    cache.delete(f'plant_options_{user_pk}')
    get_plant_options(get_user_model().objects.get(pk=user_pk))
    print(f'Rebuilt plant_options for {user_pk} (manage_group add plants modal)')


@receiver(post_save, sender=Group)
@disable_for_loaddata
def update_group_in_cached_states_hook(instance, **kwargs):
    '''Updates all relevant caches when a Group entry is saved:
    - Updates plant entry in cached group_options dict
    - Updates group entry in cached overview state (removes if group archived)
    - Deletes cached unnamed_groups list (used to get sequential names)
    '''
    cache.delete(f'unnamed_groups_{instance.user.pk}')
    update_group_details_in_cached_states(instance)


@receiver(post_delete, sender=Group)
def remove_deleted_group_from_cached_states_hook(instance, **kwargs):
    '''Deletes group from all relevant caches when a Group entry is deleted:
    - Deletes group from cached group_options dict
    - Deletes group from cached overview state
    - Deletes cached unnamed_groups list (used to get sequential names)
    '''
    remove_deleted_group_from_cached_group_options(instance)
    remove_instance_from_cached_overview_state(instance, 'groups')
    cache.delete(f'unnamed_groups_{instance.user.pk}')


@shared_task()
def update_cached_group_options(user_pk):
    '''Takes user primary key, builds and caches group options for manage_plant
    add group modal.'''
    cache.delete(f'group_options_{user_pk}')
    get_group_options(get_user_model().objects.get(pk=user_pk))
    print(f'Rebuilt group_options for {user_pk} (manage_plant add group modal)')


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
