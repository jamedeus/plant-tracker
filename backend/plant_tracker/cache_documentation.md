This document contains a comprehensive list of cache names, their contents, expiration times, and scenarios where they are updated or deleted.

This should be updated when:
- New cache name is added
- Cache updated in a new place
- Cache deleted in a new place
- Scheduled cache update tasks are added

## Cache names

### `rebuild_{cache_name}_task_id`
- Stores queued celery task ID so that it can be canceled if the same task is queued again before it runs
- Set by `tasks.schedule_cached_state_update`
  * Expires when queued task is scheduled to run
  * Deleted if the queued task is revoked (`tasks.revoke_queued_task`)

### `old_uuid_{user_primary_key}`
- Stores UUID of plant/group expecting new UUID
- Name includes database primary key of user that requested to change QR code (avoid collisions)
- Set by `/change_qr_code`
  * Expires in 15 minutes
  * Deleted by `views.render_registration_page` if it receives a request from same user containing a UUID that does not exist in the database
  * Deleted by `/change_uuid` after updating UUID of a Plant/Group owned by same user

### `division_in_progress_{user_primary_key}`
- Stores object with `divided_from_plant_uuid` (uuid) and `division_event_key` (DivisionEvent primary key) keys
- Used by `views.render_registration_page` (adds values to context so frontend can post `/register_plant` payload that creates database relations between parent plant, new child plant, and DivisionEvent)
- Name includes database primary key of user that divided plant (avoid collisions)
- Set by `/divide_plant`
  * Expires in 15 minutes

### `unnamed_plants_{user_primary_key}`
- Stores list of primary key ints for each unnamed plant owned by a user
- Name includes database primary key of user account that owns plants
- Set by `models.get_unnamed_plants`
  * Expires in 10 minutes
  * Deleted if Plant model owned by same user is saved or deleted (`models.clear_cached_plant_lists`)

### `unnamed_groups_{user_primary_key}`
- Stores list of primary key ints for each unnamed group owned by a user
- Name includes database primary key of user account that owns groups
- Set by `models.get_unnamed_groups`
  * Expires in 10 minutes
  * Deleted if Group model owned by same user is saved or deleted (`models.clear_cached_group_lists`)

### `plant_options_{user_primary_key}`
- Stores dict with plant uuids as keys and plant details dict as values
- Contains all plants that are not in a group, used to populate add plants modal cards
- Name includes database primary key of user account that owns plants
- Set by `models.get_plant_options`,
  * Never expires
  * Updated if Plant model owned by same user saved (`tasks.update_plant_in_cached_states_hook`)
  * Updated if Plant model owned by same user deleted (`tasks.remove_deleted_instance_from_cached_plant_options_hook`)
  * Updated if Photo model associated with Plant owned by same user saved (`tasks.add_photo_to_cached_states_hook`)
  * Updated if Photo model associated with Plant owned by same user deleted (`tasks.remove_photo_from_cached_states_hook`)
  * Updated when WaterEvent or FertilizeEvent owned by same user saved or deleted (`tasks.update_last_event_times_in_cached_states_hook`)
  * Deleted when server restarts (replaced immediately) (`tasks.update_all_cached_states`)

### `group_options_{user_primary_key}`
- Stores list of dicts with group attributes used to populate add plant to group modal
- Name includes database primary key of user account that owns groups
- Set by `models.get_group_options`
  * Never expires
  * Deleted if Group model owned by same user saved or deleted (replaced after 30 second delay) (`tasks.update_cached_group_options_hook`)
  * Deleted if Plant added or removed from group owned by same user (`/add_plant_to_group`, `/remove_plant_from_group`, `/bulk_add_plants_to_group`, `/bulk_remove_plants_from_group`)
  * Deleted when server restarts (replaced immediately) (`tasks.update_all_cached_states`)

### `species_options`
- Stores list of plant species with no duplicates
- Set by `models.get_plant_species_options`
  * Expires in 10 minutes
  * Deleted if Plant model saved or deleted (`models.clear_cached_plant_lists`)

### `overview_state_{user_primary_key}`
- Stores overview page state
- Name includes database primary key of user account that owns plants/groups in state
- Set by `tasks.build_overview_state` (only called when cache does not already exist)
  * Never expires
  * Updated when Plant model owned by same user saved (`tasks.update_plant_details_in_cached_overview_state_hook`)
  * Updated when Group model owned by same user saved (`tasks.update_group_details_in_cached_overview_state_hook`)
  * Updated when Plant model owned by same user deleted (`tasks.remove_deleted_instance_from_cached_overview_state_hook`)
  * Updated when Group model owned by same user deleted (`tasks.remove_deleted_instance_from_cached_overview_state_hook`)
  * Updated when Plant or Group uuid changed (`views.change_uuid`)
  * Updated when Photo model associated with Plant owned by same user saved (`tasks.add_photo_to_cached_states_hook`)
  * Updated when Photo model associated with Plant owned by same user deleted (`tasks.remove_photo_from_cached_states_hook`)
  * Updated when WaterEvent or FertilizeEvent owned by same user saved or deleted (`tasks.update_last_event_times_in_cached_states_hook`)
  * Overwritten when server restarts (`tasks.update_all_cached_states`)

### `{uuid}_state`
- Stores manage_plant page state for the plant matching UUID (excluding the `group_options` and `species_options` keys which are cached separately)
- Set by `tasks.build_manage_plant_state` (only called when cache does not already exist)
  * Never expires
  * Updated when associated Plant is saved (`tasks.update_plant_in_cached_states_hook`)
  * Updated when associated Plant's parent (plant's `Plant.divided_from` ForeignKey points to parent) is saved (`tasks.update_plant_in_cached_states_hook`)
  * Updated when associated Plant's child (child's `Plant.divided_from` ForeignKey points to plant) is saved (`tasks.update_plant_in_cached_states_hook`)
  * Deleted when associated Plant's parent (plant's `Plant.divided_from` ForeignKey points to parent) is deleted (not replaced) (`tasks.delete_parent_or_child_cached_manage_plant_state_hook`)
  * Deleted when associated Plant's child (child's `Plant.divided_from` ForeignKey points to plant) is deleted (not replaced) (`tasks.delete_parent_or_child_cached_manage_plant_state_hook`)
  * Deleted when associated Plant is deleted
  * Updated when DivisionEvent associated with Plant is saved or deleted (`tasks.update_division_events_in_cached_manage_plant_state_hook`)
  * Updated when WaterEvent or FertilizeEvent associated with Plant is saved or deleted (`tasks.update_last_event_times_in_cached_states_hook`)
  * Updated when WaterEvent, FertilizeEvent, PruneEvent, or RepotEvent associated with Plant is saved (`tasks.add_new_event_to_cached_manage_plant_state_hook`)
  * Updated when WaterEvent, FertilizeEvent, PruneEvent, or RepotEvent associated with Plant is deleted (`tasks.remove_deleted_event_from_cached_manage_plant_state`)
  * Updated when a NoteEvent associated with Plant is saved or edited (`tasks.update_note_in_cached_manage_plant_state_hook`)
  * Updated when a NoteEvent associated with Plant is deleted (`delete_note_from_cached_manage_plant_state_hook`)
  * Updated when a Photo associated with Plant is saved (`tasks.add_photo_to_cached_states_hook`)
  * Updated when a Photo associated with Plant is deleted (`tasks.remove_photo_from_cached_states_hook`)
  * Deleted when server restarts (replaced immediately) (`tasks.update_all_cached_states`)
