This document contains a comprehensive list of cache names, their contents, expiration times, and scenarios where they are updated or deleted.

This should be updated when:
- New cache name is added
- Cache updated in a new place
- Cache deleted in a new place
- Scheduled cache update tasks are added

## Cache names

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

### `pending_photo_upload_{photo_primary_key}`
- Stores status of pending photo upload (async thumbnail generation)
- Name includes database primary key of photo
- Set by `views.add_plant_photos` (one per photo)
  * Never expires
  * Value is `{'status': 'processing', 'plant_id': {plant.uuid}`
- Overwritten by `tasks.process_photo_upload` (async task)
  * Expires after 5 minutes
  * Value is `{'status': 'failed'}` if Photo no longer exists when task runs
  * Value is `{'status': 'failed', 'plant_id': {plant.uuid}` if exception occurs while generating thumbnail
  * Value is `{'status': 'complete', 'plant_id': {plant.uuid}, 'photo_details': {photo.get_details()}}` if thumbnail generated successfully
