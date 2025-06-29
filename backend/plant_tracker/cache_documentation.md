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
  * Updated when WaterEvent or FertilizeEvent owned by same user saved or deleted (`/add_plant_event`, `/bulk_add_plant_events`, `/delete_plant_event`, `/bulk_delete_plant_events`)
  * Overwritten when server restarts (`tasks.update_all_cached_states`)
