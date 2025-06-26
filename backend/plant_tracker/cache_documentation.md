This document contains a comprehensive list of cache names, their contents, expiration times, and scenarios where they are updated or deleted.

This should be updated when:
- New cache name is added
- Cache updated in a new place
- Cache deleted in a new place
- Scheduled cache update tasks are added

## Cache names

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

### `plant_options_{user_primary_key}`
- Stores dict with plant uuids as keys and plant details dict as values
- Contains all plants that are not in a group, used to populate add plants modal cards
- Name includes database primary key of user account that owns plants
- Set by `build_states.get_plant_options`,
  * Never expires
  * Updated if Plant model owned by same user saved (`update_cached_states.update_plant_in_cached_states_hook`)
  * Updated if Plant model owned by same user deleted (`update_cached_states.remove_deleted_plant_from_cached_states_hook`)
  * Updated if Photo model associated with Plant owned by same user saved (`update_cached_states.add_photo_to_cached_states_hook`)
  * Updated if Photo model associated with Plant owned by same user deleted (`update_cached_states.remove_photo_from_cached_states_hook`)
  * Updated when WaterEvent or FertilizeEvent owned by same user saved or deleted (`update_cached_states.update_last_event_times_in_cached_states_hook`)
  * Deleted when server restarts (replaced immediately) (`tasks.update_all_cached_states`)

### `group_options_{user_primary_key}`
- Stores list of dicts with group attributes used to populate add plant to group modal
- Name includes database primary key of user account that owns groups
- Set by `build_states.get_group_options`
  * Never expires
  * Updated if Group model owned by same user saved (`update_cached_states.update_group_in_cached_states_hook`)
  * Updated if Group model owned by same user deleted (`update_cached_states.remove_deleted_group_from_cached_states_hook`)
  * Updated if Plant model owned by same user that is in a group saved (`update_cached_states.update_plant_in_cached_states_hook`)
  * Updated if Plant model owned by same user that is in a group deleted (`update_cached_states.remove_deleted_plant_from_cached_states_hook`)
  * Updated if Plant removed from group owned by same user (`/remove_plant_from_group`, `/bulk_remove_plants_from_group`)
  * Deleted when server restarts (replaced immediately) (`tasks.update_all_cached_states`)

### `overview_state_{user_primary_key}`
- Stores overview page state
- Name includes database primary key of user account that owns plants/groups in state
- Set by `build_states.build_overview_state` (only called when cache does not already exist)
  * Never expires
  * Updated when Plant model owned by same user saved (`update_cached_states.update_plant_in_cached_states_hook`)
  * Updated when Group model owned by same user saved (`update_cached_states.update_group_in_cached_states_hook`)
  * Updated when Plant model owned by same user deleted (`update_cached_states.remove_deleted_plant_from_cached_states_hook`)
  * Updated when Group model owned by same user deleted (`update_cached_states.remove_deleted_group_from_cached_states_hook`)
  * Updated when Plant model owned by same user that is in a group saved (`update_cached_states.update_plant_in_cached_states_hook`)
  * Updated when Plant model owned by same user that is in a group deleted (`update_cached_states.remove_deleted_plant_from_cached_states_hook`)
  * Updated when Plant model owned by same user removed from group (`/remove_plant_from_group`, `/bulk_remove_plants_from_group`)
  * Updated when Plant or Group uuid changed (`/change_uuid`)
  * Updated when Photo model associated with Plant owned by same user saved (`update_cached_states.add_photo_to_cached_states_hook`)
  * Updated when Photo model associated with Plant owned by same user deleted (`update_cached_states.remove_photo_from_cached_states_hook`)
  * Updated when WaterEvent or FertilizeEvent owned by same user saved or deleted (`update_cached_states.update_last_event_times_in_cached_states_hook`)
  * Overwritten when server restarts (`tasks.update_all_cached_states`)

### `{uuid}_state`
- Stores manage_plant page state for the plant matching UUID (excluding the `group_options` key which is cached separately)
- Set by `build_states.build_manage_plant_state` (only called when cache does not already exist)
  * Never expires
  * Updated when associated Plant is saved (`update_cached_states.update_plant_in_cached_states_hook`)
  * Updated when associated Plant's parent (plant's `Plant.divided_from` ForeignKey points to parent) is saved (`update_cached_states.update_plant_in_cached_states_hook`)
  * Updated when associated Plant's child (child's `Plant.divided_from` ForeignKey points to plant) is saved (`update_cached_states.update_plant_in_cached_states_hook`)
  * Deleted when associated Plant's parent (plant's `Plant.divided_from` ForeignKey points to parent) is deleted (not replaced) (`update_cached_states.delete_parent_or_child_cached_manage_plant_state_hook`)
  * Deleted when associated Plant's child (child's `Plant.divided_from` ForeignKey points to plant) is deleted (not replaced) (`update_cached_states.delete_parent_or_child_cached_manage_plant_state_hook`)
  * Deleted when associated Plant is deleted (`update_cached_states.remove_deleted_plant_from_cached_states_hook`)
  * Updated when DivisionEvent associated with Plant is saved or deleted (`update_cached_states.update_division_events_in_cached_manage_plant_state_hook`)
  * Updated when WaterEvent or FertilizeEvent associated with Plant is saved or deleted (`update_cached_states.update_last_event_times_in_cached_states_hook`)
  * Updated when WaterEvent, FertilizeEvent, PruneEvent, or RepotEvent associated with Plant is saved (`update_cached_states.add_new_event_to_cached_manage_plant_state_hook`)
  * Updated when WaterEvent, FertilizeEvent, PruneEvent, or RepotEvent associated with Plant is deleted (`update_cached_states.remove_deleted_event_from_cached_manage_plant_state`)
  * Updated when a NoteEvent associated with Plant is saved or edited (`update_cached_states.update_note_in_cached_manage_plant_state_hook`)
  * Updated when a NoteEvent associated with Plant is deleted (`delete_note_from_cached_manage_plant_state_hook`)
  * Updated when a Photo associated with Plant is saved (`update_cached_states.add_photo_to_cached_states_hook`)
  * Updated when a Photo associated with Plant is deleted (`update_cached_states.remove_photo_from_cached_states_hook`)
  * Deleted when server restarts (not replaced) (`tasks.update_all_cached_states`)
