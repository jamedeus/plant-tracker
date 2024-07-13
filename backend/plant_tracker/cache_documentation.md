This document contains a comprehensive list of cache names, their contents, expiration times, and scenarios where they are deleted.

This should be updated when:
- New cache name is added
- Cache deleted in a new place
- Scheduled cache update tasks are added

## Cache names
* `rebuild_{cache_name}_task_id` - set by `tasks.schedule_cached_state_update`, stores queued celery task ID so that it can be canceled if the same task is queued again before it runs
  * Expires when queued task is scheduled to run
  * Deleted if the queued task is revoked (`tasks.revoke_queued_task`)
* `old_uuid` - set by `/change_qr_code`, stores UUID of plant/group expecting new UUID
  * Expires in 15 minutes
  * Deleted by `views.render_confirm_new_qr_code_page` if it receives a UUID that does not exist in the database
  * Deleted by `/change_uuid` after saving Plant.Group with new UUID
* `unnamed_plants` - set by `models.get_unnamed_plants`, stores list of primary key ints for each unnamed plant
  * Expires in 10 minutes
  * Deleted if Plant model saved or deleted (`models.clear_cached_plant_lists`)
* `unnamed_groups` - set by `models.get_unnamed_groups`, stores list of primary key ints for each unnamed group
  * Expires in 10 minutes
  * Deleted if Group model saved or deleted (`models.clear_cached_group_lists`)
* `plant_options` - set by `models.get_plant_options`, stores list of dicts with plant attributes used to populate add plants modal cards
  * Never expires
  * Deleted if Plant model saved or deleted (replaced after 30 second delay) (`models.update_cached_plant_options_hook`)
  * Deleted when server restarts (replaced immediately) (`tasks.update_all_cached_states`)
* `group_options` - set by `models.get_group_options`, stores list of dicts with group attributes used to populate add plant to group modal
  * Never expires
  * Deleted if Group model saved or deleted (`tasks.update_cached_group_options_hook`)
  * Deleted if Plant added or removed from group (`/add_plant_to_group`, `/remove_plant_from_group`, `/bulk_add_plants_to_group`, `/bulk_remove_plants_from_group`)
  * Deleted when server restarts (replaced immediately) (`tasks.update_all_cached_states`)
* `species_options` - set by `models.get_plant_species_options`, stores list of plant species with no duplicates
  * Expires in 10 minutes
  * Deleted if Plant model saved or deleted (`models.clear_cached_plant_lists`)
* `overview_state` - set by `tasks.build_overview_state` (only called when cache does not already exist), contains overview page state
  * Never expires
  * Deleted when Plant model saved or deleted (replaced after 30 second delay) (`tasks.update_cached_overview_state_hook`)
  * Deleted when Group model saved or deleted (replaced after 30 second delay) (`tasks.update_cached_overview_state_hook`)
  * Deleted when any Event created (replaced after 30 second delay) (`views.add_plant_event`, `views.bulk_add_plant_events`)
  * Deleted when any Event deleted (replaced after 30 second delay) (`views.delete_plant_event`, `views.bulk_delete_plant_events`)
  * Deleted when server restarts (replaced immediately) (`tasks.update_all_cached_states`)
* `{uuid}_state` - set by `tasks.build_manage_plant_state`, stores most of context used to render manage_plant page
  * Never expires
  * Deleted when associated Plant is saved (replaced after 30 second delay) (`tasks.update_cached_manage_plant_state_hook`)
  * Deleted when associated Plant is deleted
  * Deleted when WaterEvent, FertilizeEvent, PruneEvent, RepotEvent, NoteEvent, or Photo associated with Plant is saved or deleted (replaced after 30 second delay) (`tasks.update_cached_manage_plant_state_hook`)
  * Deleted when server restarts (replaced immediately) (`tasks.update_all_cached_states`)
