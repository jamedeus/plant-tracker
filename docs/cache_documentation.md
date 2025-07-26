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
  * Deleted by `/render_registration_page` if it receives a request from same user containing a UUID that does not exist in the database
  * Deleted by `/change_uuid` after updating UUID of a Plant/Group owned by same user

### `division_in_progress_{user_primary_key}`
- Stores object with `divided_from_plant_uuid` (uuid) and `division_event_key` (DivisionEvent primary key) keys
- Used by `/render_registration_page` (adds values to context so frontend can post `/register_plant` payload that creates database relations between parent plant, new child plant, and DivisionEvent)
- Name includes database primary key of user that divided plant (avoid collisions)
- Set by `/divide_plant`
  * Expires in 15 minutes

### `overview_state_{user_primary_key}`
- Stores overview page state
- Name includes database primary key of user account that owns plants/groups in state
- Set by `build_states.build_overview_state` (only called when cache does not already exist)
  * Never expires
  * Updated when Plant registered (`/register_plant`)
  * Updated when Group registered (`/register_group`)
  * Updated when Plant or Group UUID changed (`/change_uuid`)
  * Updated when Plant details are changed (`/edit_plant_details`)
  * Updated when Group details are changed (`/edit_group_details`)
  * Updated when Plant or Group deleted (`/bulk_delete_plants_and_groups`)
  * Updated when Plant deleted (`/delete_plant`)
  * Updated when Plant archived (`/archive_plant`)
  * Updated when Group deleted (`/delete_group`)
  * Updated when Group archived (`/archive_group`)
  * Updated when Plant or Group archived or unarchived (`/bulk_archive_plants_and_groups`)
  * Updated when WaterEvent or FertilizeEvent created (`/add_plant_event`, `/bulk_add_plant_events`)
  * Updated when WaterEvent or FertilizeEvent deleted (`/delete_plant_event`, `/bulk_delete_plant_events`)
  * Updated when Plant added to Group (`/add_plant_to_group`, `/bulk_add_plants_to_group`)
  * Updated when Plant removed from Group (`/remove_plant_from_group`, `/bulk_remove_plants_from_group`)
  * Updated when Plant repotted if pot_size changed (`/repot_plant`)
  * Updated when Plant photo added unless Plant default_photo set (`/add_plant_photos`)
  * Updated when Plant photo deleted unless Plant default_photo set (`/delete_plant_photos`)
  * Updated when Plant default_photo changed (`/set_plant_default_photo`)
  * Overwritten when server restarts (`tasks.update_all_cached_states`)
