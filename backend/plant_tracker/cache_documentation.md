This document contains a comprehensive list of cache names, their contents, expiration times, and scenarios where they are deleted.

This should be updated when:
- New cache name is added
- Cache deleted in a new place
- Scheduled cache update tasks are added

## Cache names

### `rebuild_{cache_name}_task_id`
- Stores queued celery task ID so that it can be canceled if the same task is queued again before it runs
- Set by `tasks.schedule_cached_state_update`
  * Expires when queued task is scheduled to run
  * Deleted if the queued task is revoked (`tasks.revoke_queued_task`)

### `old_uuid`
- Stores UUID of plant/group expecting new UUID
- Set by `/change_qr_code`
  * Expires in 15 minutes
  * Deleted by `views.render_confirm_new_qr_code_page` if it receives a UUID that does not exist in the database
  * Deleted by `/change_uuid` after saving Plant.Group with new UUID

### `unnamed_plants`
- Stores list of primary key ints for each unnamed plant
- Set by `models.get_unnamed_plants`
  * Expires in 10 minutes
  * Deleted if Plant model saved or deleted (`models.clear_cached_plant_lists`)

### `unnamed_groups`
- Stores list of primary key ints for each unnamed group
- Set by `models.get_unnamed_groups`
  * Expires in 10 minutes
  * Deleted if Group model saved or deleted (`models.clear_cached_group_lists`)

### `plant_options`
- Stores list of dicts with plant attributes used to populate add plants modal cards
- Set by `models.get_plant_options`,
  * Never expires
  * Deleted if Plant model saved or deleted (replaced after 30 second delay) (`models.update_cached_plant_options_hook`)
  * Deleted when server restarts (replaced immediately) (`tasks.update_all_cached_states`)

### `group_options`
- Stores list of dicts with group attributes used to populate add plant to group modal
- Set by `models.get_group_options`
  * Never expires
  * Deleted if Group model saved or deleted (`tasks.update_cached_group_options_hook`)
  * Deleted if Plant added or removed from group (`/add_plant_to_group`, `/remove_plant_from_group`, `/bulk_add_plants_to_group`, `/bulk_remove_plants_from_group`)
  * Deleted when server restarts (replaced immediately) (`tasks.update_all_cached_states`)

### `species_options`
- Stores list of plant species with no duplicates
- Set by `models.get_plant_species_options`
  * Expires in 10 minutes
  * Deleted if Plant model saved or deleted (`models.clear_cached_plant_lists`)

### `overview_state`
- Stores overview page state
- Set by `tasks.build_overview_state` (only called when cache does not already exist)
  * Never expires
  * Deleted when Plant model saved or deleted (replaced after 30 second delay) (`tasks.update_cached_overview_state_hook`)
  * Deleted when Group model saved or deleted (replaced after 30 second delay) (`tasks.update_cached_overview_state_hook`)
  * Deleted when any Event created (replaced after 30 second delay) (`views.add_plant_event`, `views.bulk_add_plant_events`)
  * Deleted when any Event deleted (replaced after 30 second delay) (`views.delete_plant_event`, `views.bulk_delete_plant_events`)
  * Deleted when server restarts (replaced immediately) (`tasks.update_all_cached_states`)

### `{uuid}_state`
- Stores manage_plant page state for the plant matching UUID (excluding the `group_options` and `species_options` keys which are cached separately)
- Set by `tasks.build_manage_plant_state` (only called when cache does not already exist)
  * Never expires
  * Deleted when associated Plant is saved (replaced after 30 second delay) (`tasks.update_cached_manage_plant_state_hook`)
  * Deleted when associated Plant is deleted
  * Deleted when WaterEvent, FertilizeEvent, PruneEvent, RepotEvent, NoteEvent, or Photo associated with Plant is saved or deleted (replaced after 30 second delay) (`tasks.update_cached_manage_plant_state_hook`)
  * Deleted when server restarts (replaced immediately) (`tasks.update_all_cached_states`)
