'''Django API endpoint functions'''

# pylint: disable=too-many-lines

import json
import base64
from uuid import UUID
from io import BytesIO
from itertools import chain

from ua_parser import parse
from django.conf import settings
from django.shortcuts import render
from django.http import JsonResponse
from django.db import transaction, IntegrityError
from django.core.exceptions import ValidationError
from django.views.decorators.csrf import ensure_csrf_cookie
from django.core.cache import cache
from PIL import Image, UnidentifiedImageError

from .generate_qr_code_grid import generate_layout
from .models import (
    Group,
    Plant,
    RepotEvent,
    Photo,
    extract_timestamp_from_exif,
    NoteEvent,
    DivisionEvent,
    DetailsChangedEvent
)
from .view_decorators import (
    events_map,
    get_user_token,
    find_model_type,
    requires_json_post,
    get_plant_from_post_body,
    get_group_from_post_body,
    get_qr_instance_from_post_body,
    get_timestamp_from_post_body,
    get_event_type_from_post_body,
    log_changed_details,
    get_details_changed_event_from_post_body,
    clean_payload_data
)
from .get_state_views import (
    update_cached_overview_details_keys,
    add_instance_to_cached_overview_state,
    remove_instance_from_cached_overview_state,
    update_cached_overview_state_show_archive_bool
)
from .tasks import process_photo_upload


@get_user_token
@ensure_csrf_cookie
def serve_spa(request, **kwargs):
    '''Renders the SPA shell.'''
    return render(request, 'plant_tracker/index.html', {
        'user_accounts_enabled': not settings.SINGLE_USER_MODE
    })


@requires_json_post(["qr_per_row"])
def get_qr_codes(request, data, **kwargs):
    '''Returns printer-sized grid of QR code links as base64-encoded PNG.
    QR codes point to manage endpoint, can be used for plants or groups.
    '''

    # Return error if URL_PREFIX env var is unset or invalid
    if not settings.URL_PREFIX:
        return JsonResponse({'error': 'URL_PREFIX not configured'}, status=501)

    # Reduce page height if client is iOS Safari (fix issue where print preview
    # overflows to 2 pages, even though it all fits on 1 page when printed)
    try:
        ua = parse(request.META.get('HTTP_USER_AGENT'))
        page_height = 3075 if ua.user_agent.family == 'Mobile Safari' else 3200
    # No user agent, default to full page height
    except TypeError:
        page_height = 3200

    try:
        qr_codes = generate_layout(
            qr_per_row=int(data["qr_per_row"]),
            page_height=page_height
        )
        image = BytesIO()
        qr_codes.save(image, format="PNG")
        image_base64 = base64.b64encode(image.getvalue()).decode()
        return JsonResponse({'qr_codes': image_base64}, status=200)
    except (ValueError, TypeError):
        return JsonResponse(
            {'error': 'qr_per_row must be an integer between 2 and 25'},
            status=400
        )
    except RuntimeError:
        return JsonResponse(
            {'error': 'failed to generate, try a shorter URL_PREFIX'},
            status=500
        )


@get_user_token
@requires_json_post(["uuid"])
def is_uuid_available(request, data, **kwargs):
    '''Returns True if uuid is available, False if not.
    Requires JSON POST with uuid (uuid) key.
    '''
    uuid = data["uuid"]
    try:
        if find_model_type(uuid):
            return JsonResponse({'available': False}, status=409)
        return JsonResponse({'available': True}, status=200)
    except ValidationError:
        return JsonResponse({"error": "uuid key is not a valid UUID"}, status=400)


@get_user_token
@requires_json_post(["name", "species", "pot_size", "description", "uuid"])
@clean_payload_data
def register_plant(user, data, **kwargs):
    '''Creates a Plant database entry with params from POST body.
    Requires JSON POST with parameters from plant registration forms.
    '''
    try:
        # transaction.atomic cleans up after IntegrityError if uuid not unique
        with transaction.atomic():
            # Instantiate model with payload keys as kwargs
            plant = Plant(user=user, **data)
            plant.clean_fields(exclude=['user'])
            plant.save()
            # Set annotation attributes (avoid querying for get_details params)
            plant.last_watered_time = None
            plant.last_fertilized_time = None
            plant.last_photo_thumbnail = None
            # Add to cached overview state
            add_instance_to_cached_overview_state(plant)

        # If divided from existing plant: create RepotEvent
        if plant.divided_from:
            with transaction.atomic():
                RepotEvent.objects.create(plant=plant, timestamp=plant.created)

        # Return new plant details
        return JsonResponse(
            {
                'success': 'plant registered',
                'name': plant.get_display_name(),
                'uuid': str(plant.uuid)
            },
            status=200
        )

    except IntegrityError:
        return JsonResponse(
            {"error": "uuid already exists in database"},
            status=409
        )

    except ValidationError as error:
        return JsonResponse({"error": error.message_dict}, status=400)


@get_user_token
@requires_json_post(["name", "location", "description", "uuid"])
@clean_payload_data
def register_group(user, data, **kwargs):
    '''Creates a Group database entry with params from POST body.
    Requires JSON POST with parameters from group registration form.
    '''
    try:
        # transaction.atomic cleans up after IntegrityError if uuid not unique
        with transaction.atomic():
            # Instantiate model with payload keys as kwargs
            group = Group(user=user, **data)
            group.clean_fields(exclude=['user'])
            group.save()
            # Set annotation attributes (avoid querying for get_details params)
            group.plant_count = 0
            # Add to cached overview state
            add_instance_to_cached_overview_state(group)

        # Return new group details
        return JsonResponse(
            {
                'success': 'group registered',
                'name': group.get_display_name(),
                'uuid': str(group.uuid)
            },
            status=200
        )

    except IntegrityError:
        return JsonResponse(
            {"error": "uuid already exists in database"},
            status=409
        )

    except ValidationError as error:
        return JsonResponse({"error": error.message_dict}, status=400)


@get_user_token
@requires_json_post(["uuid", "new_id"])
@get_qr_instance_from_post_body(annotate=True)
def change_uuid(instance, data, **kwargs):
    '''Changes UUID of an existing Plant or Group.
    Requires JSON POST with uuid (uuid) and new_id (uuid) keys.
    '''
    try:
        # Delete plant/group from cached overview state (prevent duplicate, keys
        # are uuid so once it changes the old entry can't be removed)
        remove_instance_from_cached_overview_state(instance)
        # Change UUID,
        instance.uuid = UUID(data["new_id"])
        instance.save(update_fields=["uuid"])
        # Add back to cached overview state under new UUID
        add_instance_to_cached_overview_state(instance)
        return JsonResponse({"new_uuid": str(instance.uuid)}, status=200)
    except (ValidationError, ValueError):
        return JsonResponse({"error": "new_id key is not a valid UUID"}, status=400)
    except IntegrityError:
        return JsonResponse(
            {"error": "new_id is already used by another Plant or Group"},
            status=409
        )


@get_user_token
@requires_json_post(["plant_id", "name", "species", "description", "pot_size"])
@get_plant_from_post_body()
@get_details_changed_event_from_post_body
@clean_payload_data
def edit_plant_details(user, plant, change_event, data, **kwargs):
    '''Updates description attributes of existing Plant entry.
    Requires JSON POST with plant_id (uuid), name, species, description
    (string), and pot_size (int) keys.
    '''

    # Check if plant was unnamed before editing
    unnamed_before = plant.is_unnamed()

    # Overwrite database params with user values (remove extra whitespace)
    plant.name = data["name"]
    plant.species = data["species"]
    plant.description = data["description"]
    plant.pot_size = data["pot_size"]
    # Enforce length limits
    try:
        plant.clean_fields(exclude=['user', 'group', 'default_photo'])
        plant.save()
    except ValidationError as error:
        return JsonResponse({"error": error.message_dict}, status=400)

    # Clear cached overview state if plant was named or unnamed (need to update
    # all sequential "Unnamed plant n" display names)
    if unnamed_before ^ plant.is_unnamed():
        cache.delete(f'overview_state_{user.pk}')
    # Otherwise update edited plant details in cached overview state
    else:
        update_cached_overview_details_keys(
            plant,
            {
                'name': plant.name,
                'display_name': plant.get_display_name(),
                'species': plant.species,
                'pot_size': plant.pot_size,
                'description': plant.description
            }
        )

    # Update DetailsChangedEvent
    change_event.name_after = plant.get_display_name()
    change_event.species_after = plant.species
    change_event.description_after = plant.description
    change_event.pot_size_after = plant.pot_size
    change_event.save()

    # Return DetailsChangedEvent details object used to update frontend state
    return JsonResponse(change_event.get_details(), status=200)


@get_user_token
@requires_json_post(["group_id", "name", "location", "description"])
@get_group_from_post_body()
@clean_payload_data
def edit_group_details(user, group, data, **kwargs):
    '''Updates description attributes of existing Group entry.
    Requires JSON POST with group_id (uuid), name, and location (string) keys.
    '''

    # Check if group was unnamed before editing
    unnamed_before = group.is_unnamed()

    # Overwrite database params with user values
    group.name = data["name"]
    group.location = data["location"]
    group.description = data["description"]
    # Enforce length limits
    try:
        group.clean_fields(exclude=['user'])
        group.save()
    except ValidationError as error:
        return JsonResponse({"error": error.message_dict}, status=400)

    # Clear cached overview state if group was named or unnamed (need to update
    # all sequential "Unnamed group n" display names)
    if unnamed_before ^ group.is_unnamed():
        cache.delete(f'overview_state_{user.pk}')
    # Otherwise update edited group details in cached overview state
    else:
        update_cached_overview_details_keys(
            group,
            {
                'name': group.name,
                'display_name': group.get_display_name(),
                'location': group.location,
                'description': group.description
            }
        )

    # Return modified payload with new display_name
    del data["group_id"]
    data["display_name"] = group.get_display_name()
    return JsonResponse(data, status=200)


@get_user_token
@requires_json_post(["uuids"])
def bulk_delete_plants_and_groups(user, data, **kwargs):
    '''Deletes a list of plants and groups owned by the requesting user.
    Requires JSON POST with uuids key (list of plant or group uuids).
    '''
    deleted = []
    groups_to_update = set([])
    cache_cleared = False

    plants = Plant.objects.filter(user_id=user.pk, uuid__in=data["uuids"]).select_related("group")
    groups = Group.objects.filter(user_id=user.pk, uuid__in=data["uuids"])

    # Clear cached overview state if unnamed plant/group is being deleted
    # (need to update all sequential "Unnamed plant/group n" display names)
    for instance in chain(plants, groups):
        if instance.is_unnamed():
            cache.delete(f'overview_state_{user.pk}')
            cache_cleared = True
            break

    for instance in chain(plants, groups):
        deleted.append(str(instance.uuid))
        if not cache_cleared:
            # Remove from cached overview state
            remove_instance_from_cached_overview_state(instance)
            # Plant in group: save group (need to update number of plants)
            if instance.__class__ == Plant and instance.group:
                groups_to_update.add(instance.group)

    # Delete all plants in 1 query, all groups in 1 query
    # Conditionals avoid unnecessary query for empty queryset
    if plants:
        plants.delete()
    if groups:
        groups.delete()

    # Update number of plants in groups that had plants deleted (overview state)
    for group in groups_to_update:
        # Avoid extra query for group user (used to get cached overview state)
        # Already confirmed requesting user owns plant, and plant was in group
        group.user = user
        update_cached_overview_details_keys(
            group,
            {'plants': group.get_number_of_plants()}
        )

    # Update show_archive bool in cached overview state (remove archived
    # overview link from dropdown if last archived plant/group deleted)
    if not cache_cleared:
        update_cached_overview_state_show_archive_bool(user)

    return JsonResponse(
        {"deleted": deleted, "failed": list(set(data["uuids"]) - set(deleted))},
        status=200 if deleted else 400
    )


@get_user_token
@requires_json_post(["uuids", "archived"])
def bulk_archive_plants_and_groups(request, user, data, **kwargs):
    '''Sets the archived attribute for a list of plants and groups owned by the
    requesting user.
    Requires JSON POST with uuids (list of uuids) and archived (bool) keys.
    '''
    user_tz = request.headers.get("User-Timezone", "Etc/UTC")
    archived = []

    plants = Plant.objects.filter(user_id=user.pk, uuid__in=data["uuids"])
    groups = Group.objects.filter(user_id=user.pk, uuid__in=data["uuids"])

    # Update archived_after in DetailsChangedEvents for each plant
    log_changed_details(plants, {'archived': data["archived"]}, user_tz=user_tz)

    # Update archived bool for each plant and group
    for instance in chain(plants, groups):
        archived.append(str(instance.uuid))
        instance.archived = data["archived"]
        # Add to cached overview state if un-archived, remove if archived
        add_instance_to_cached_overview_state(instance)

    # Update all plants in 1 query, all groups in 1 query
    Plant.objects.bulk_update(plants, ["archived"])
    Group.objects.bulk_update(groups, ["archived"])

    # Update show_archive bool in cached overview state
    update_cached_overview_state_show_archive_bool(user)

    return JsonResponse(
        {"archived": archived, "failed": list(set(data["uuids"]) - set(archived))},
        status=200 if archived else 400
    )


@get_user_token
@requires_json_post(["plant_id", "event_type", "timestamp"])
@get_plant_from_post_body()
@get_timestamp_from_post_body
@get_event_type_from_post_body
def add_plant_event(plant, timestamp, event_type, **kwargs):
    '''Creates new Event entry with requested type for specified Plant entry.
    Requires JSON POST with plant_id (uuid), event_type, and timestamp keys.
    '''
    try:
        # Use transaction.atomic to clean up after IntegrityError if duplicate
        with transaction.atomic():
            event = events_map[event_type].objects.create(
                plant=plant,
                timestamp=timestamp
            )

        # Update last_watered if new event is newer
        if event_type == 'water':
            last_watered = plant.last_watered()
            if timestamp.isoformat() >= last_watered:
                update_cached_overview_details_keys(
                    plant,
                    {'last_watered': last_watered}
                )

        # Update last_fertilized if new event is newer
        elif event_type == 'fertilize':
            last_fertilized = plant.last_fertilized()
            if timestamp.isoformat() >= last_fertilized:
                update_cached_overview_details_keys(
                    plant,
                    {'last_fertilized': last_fertilized}
                )

        return JsonResponse(
            {
                "action": event_type,
                "timestamp": event.timestamp.isoformat(),
                "plant": plant.uuid
            },
            status=200
        )
    except IntegrityError:
        return JsonResponse(
            {"error": "event with same timestamp already exists"},
            status=409
        )


@get_user_token
@requires_json_post(["plants", "event_type", "timestamp"])
@get_timestamp_from_post_body
@get_event_type_from_post_body
def bulk_add_plant_events(user, timestamp, event_type, data, **kwargs):
    '''Creates new Event entry with requested type for each Plant specified in body.
    Requires JSON POST with plants (list of UUIDs), event_type, and timestamp keys.
    '''

    # Get all plants in 1 query
    plants = (
        Plant.objects
            .filter(uuid__in=data["plants"], user=user)
            .with_last_watered_time_annotation()
            .with_last_fertilized_time_annotation()
    )

    # Get lists of UUIDs that were found and not found in database
    found = [str(plant.uuid) for plant in plants]
    not_found = list(set(data["plants"]) - set(found))

    # Create events for all plants in a single query
    events_map[event_type].objects.bulk_create(
        [
            events_map[event_type](plant=plant, timestamp=timestamp)
            for plant in plants
        ],
        ignore_conflicts = True
    )

    # Update last_watered if timestamp is newer than annotation
    if event_type == 'water':
        for plant in plants:
            if not plant.last_watered_time or timestamp > plant.last_watered_time:
                update_cached_overview_details_keys(
                    plant,
                    {'last_watered': timestamp.isoformat()}
                )

    # Update last_fertilized if timestamp is newer than annotation
    if event_type == 'fertilize':
        for plant in plants:
            if not plant.last_fertilized_time or timestamp > plant.last_fertilized_time:
                update_cached_overview_details_keys(
                    plant,
                    {'last_fertilized': timestamp.isoformat()}
                )

    # Return 200 if at least 1 succeeded, otherwise return error
    return JsonResponse(
        {
            "action": event_type,
            "timestamp": timestamp.isoformat(),
            "plants": found,
            "failed": not_found
        },
        status=200 if found else 400
    )


@get_user_token
@requires_json_post(["plant_id", "events"])
@get_plant_from_post_body()
def delete_plant_events(plant, data, **kwargs):
    '''Deletes a list of events (any type) associated with a single plant.
    Requires JSON POST with plant_id (uuid) and events (dict) keys.
    The events dict must contain event type keys, list of timestamps as values.
    '''

    # Convert payload events key to mapping dict with type keys, queryset values
    querysets_by_type = {
        event_type: events_map[event_type].objects.filter(
            plant=plant,
            timestamp__in=timestamps
        )
        for event_type, timestamps in data['events'].items()
    }

    # Append each event in queryset to deleted list, delete whole queryset
    deleted = {key: [] for key in events_map}
    for event_type, queryset in querysets_by_type.items():
        for event in queryset:
            deleted[event_type].append(event.timestamp.isoformat())
        queryset.delete()

    # Get events that were not found in database
    failed = {
        event_type: [
            timestamp for timestamp in data['events'][event_type]
            if timestamp not in deleted_timestamps
        ]
        for event_type, deleted_timestamps in deleted.items()
    }

    # Update last_watered if water events were deleted
    if deleted['water']:
        update_cached_overview_details_keys(
            plant,
            {'last_watered': plant.last_watered()}
        )

    # Update last_fertilized if fertilize events were deleted
    if deleted['fertilize']:
        update_cached_overview_details_keys(
            plant,
            {'last_fertilized': plant.last_fertilized()}
        )

    return JsonResponse(
        {"deleted": deleted, "failed": failed},
        status=200 if any(deleted.values()) else 400
    )


@get_user_token
@requires_json_post(["plant_id", "timestamp", "note_text"])
@clean_payload_data
@get_plant_from_post_body()
@get_timestamp_from_post_body
def add_plant_note(plant, timestamp, data, **kwargs):
    '''Creates new NoteEvent with user-entered text for specified Plant entry.
    Requires JSON POST with plant_id (uuid), timestamp, and note_text keys.
    '''
    try:
        # Use transaction.atomic to clean up after IntegrityError if text empty
        with transaction.atomic():
            note = NoteEvent(
                plant=plant,
                timestamp=timestamp,
                text=data["note_text"]
            )
            note.clean_fields(exclude=['plant'])
            note.save()
        return JsonResponse(
            {
                "action": "add_note",
                "plant": plant.uuid,
                "timestamp": note.timestamp.isoformat(),
                "note_text": note.text
            },
            status=200
        )
    except ValidationError as error:
        return JsonResponse(
            {"error": error.message_dict},
            status=400
        )
    except IntegrityError:
        return JsonResponse(
            {"error": "Plant already has a note with the same timestamp"},
            status=409
        )


@get_user_token
@requires_json_post(["plant_id", "timestamp", "note_text"])
@clean_payload_data
@get_plant_from_post_body()
@get_timestamp_from_post_body
def edit_plant_note(plant, timestamp, data, **kwargs):
    '''Overwrites text of an existing NoteEvent with the specified timestamp.
    Requires JSON POST with plant_id (uuid), timestamp, and note_text keys.
    '''
    try:
        # Use transaction.atomic to clean up after IntegrityError if text empty
        with transaction.atomic():
            note = NoteEvent.objects.get(plant=plant, timestamp=timestamp)
            note.text = data["note_text"]
            note.clean_fields(exclude=['plant'])
            note.save()
        return JsonResponse(
            {
                "action": "edit_note",
                "plant": plant.uuid,
                "timestamp": note.timestamp.isoformat(),
                "note_text": note.text
            },
            status=200
        )
    except NoteEvent.DoesNotExist:
        return JsonResponse({"error": "note not found"}, status=404)
    except ValidationError as error:
        return JsonResponse( {"error": error.message_dict}, status=400)


@get_user_token
@requires_json_post(["plant_id", "timestamps"])
@get_plant_from_post_body()
def delete_plant_notes(plant, data, **kwargs):
    '''Deletes list of one or more NoteEvents associated with a specific plant.
    Requires JSON POST with plant_id (uuid) and timestamps (list of timestamps).
    '''

    # Query all requested NoteEvents, get list of found timestamps
    notes = NoteEvent.objects.filter(plant=plant, timestamp__in=data["timestamps"])
    deleted = [note.timestamp.isoformat() for note in notes]

    # Get list of timestamps that were not found in database
    failed = list(set(data["timestamps"]) - set(deleted))

    # Delete all found NoteEvents
    notes.delete()

    return JsonResponse(
        {"deleted": deleted, "failed": failed},
        status=200 if deleted else 400
    )


@get_user_token
@requires_json_post(["plant_id", "group_id"])
@get_plant_from_post_body()
@get_details_changed_event_from_post_body
@get_group_from_post_body()
def add_plant_to_group(plant, group, change_event, **kwargs):
    '''Adds specified Plant to specified Group (creates database relation).
    Requires JSON POST with plant_id (uuid) and group_id (uuid) keys.
    '''
    plant.group = group
    plant.save(update_fields=["group"])
    change_event.group_after = plant.group
    change_event.save()
    # Update cached overview state
    update_cached_overview_details_keys(plant, {'group': plant.get_group_details()})
    update_cached_overview_details_keys(group, {'plants': group.get_number_of_plants()})

    return JsonResponse(
        {
            "action": "add_plant_to_group",
            "plant": plant.uuid,
            "change_event": change_event.get_details()
        },
        status=200
    )


@get_user_token
@requires_json_post(["plant_id"])
@get_plant_from_post_body(select_related="group")
@get_details_changed_event_from_post_body
def remove_plant_from_group(plant, change_event, **kwargs):
    '''Removes specified Plant from Group (deletes database relation).
    Requires JSON POST with plant_id (uuid) key.
    '''

    # Save group instance so overview state can be updated (num plants in group)
    # Add user to avoid extra query when getting cached overview state
    old_group = plant.group
    old_group.user = plant.user

    # Remove plant from group
    plant.group = None
    plant.save(update_fields=["group"])
    change_event.group_after = None
    change_event.save()

    # Update cached overview state
    update_cached_overview_details_keys(plant, {'group': None})
    update_cached_overview_details_keys(
        old_group,
        {'plants': old_group.get_number_of_plants()}
    )

    return JsonResponse(
        {
            "action": "remove_plant_from_group",
            "plant": plant.uuid,
            "change_event": change_event.get_details()
        },
        status=200
    )


@get_user_token
@requires_json_post(["group_id", "plants"])
@get_group_from_post_body()
def bulk_add_plants_to_group(request, user, group, data, **kwargs):
    '''Adds a list of Plants to specified Group (creates database relation for each).
    Requires JSON POST with group_id (uuid) and plants (list of UUIDs) keys.
    '''

    user_tz = request.headers.get("User-Timezone", "Etc/UTC")

    # Get all plants in 1 query
    plants = (
        Plant.objects
            .filter(uuid__in=data["plants"], user=user)
            .with_overview_annotation()
    )

    # Get list of UUIDs that were not found in database
    failed = list(set(data["plants"]) - set(str(plant.uuid) for plant in plants))

    # Update group_after in DetailsChangedEvents for each plant
    log_changed_details(plants, {'group': group}, user_tz=user_tz)

    added = []
    for plant in plants:
        plant.group = group
        added.append(plant.get_details())
        # Add group details to plant details in cached overview state
        update_cached_overview_details_keys(plant, {'group': plant.get_group_details()})
    Plant.objects.bulk_update(plants, ['group'])

    # Update number of plants in group in cached overview state
    update_cached_overview_details_keys(group, {'plants': group.get_number_of_plants()})

    return JsonResponse({"added": added, "failed": failed}, status=200)


@get_user_token
@requires_json_post(["group_id", "plants"])
@get_group_from_post_body()
def bulk_remove_plants_from_group(request, user, data, group, **kwargs):
    '''Removes a list of Plants from specified Group (deletes database relations).
    Requires JSON POST with group_id (uuid) and plants (list of UUIDs) keys.
    '''

    user_tz = request.headers.get("User-Timezone", "Etc/UTC")

    # Get all plants in 1 query
    plants = (
        Plant.objects
            .filter(uuid__in=data["plants"], user=user)
            .select_related("group")
            .with_overview_annotation()
    )

    # Get list of UUIDs that were not found in database
    failed = list(set(data["plants"]) - set(str(plant.uuid) for plant in plants))

    # Update group_after in DetailsChangedEvents for each plant
    log_changed_details(plants, {'group': None}, user_tz=user_tz)

    removed = []
    for plant in plants:
        plant.group = None
        removed.append(plant.get_details())
        # Clear group details in plant details in cached overview state
        update_cached_overview_details_keys(plant, {'group': None})
    Plant.objects.bulk_update(plants, ['group'])

    # Update number of plants in group in cached overview state
    update_cached_overview_details_keys(group, {'plants': group.get_number_of_plants()})

    return JsonResponse({"removed": removed, "failed": failed}, status=200)


@get_user_token
@requires_json_post(["plant_id", "new_pot_size", "timestamp"])
@get_plant_from_post_body()
@get_timestamp_from_post_body
@get_details_changed_event_from_post_body
def repot_plant(plant, timestamp, change_event, data, **kwargs):
    '''Creates a RepotEvent for specified Plant with optional new_pot_size.
    Requires JSON POST with plant_id, new_pot_size, and timestamp keys.
    If new_pot_size given creates/updates DetailsChangedEvent.
    '''

    try:
        # Create with current pot_size as both old and new
        with transaction.atomic():
            RepotEvent.objects.create(plant=plant, timestamp=timestamp)
        change_event_details = None
        # If pot size changed update plant.pot_size and DetailsChangedEvent
        if data["new_pot_size"] and plant.pot_size != int(data["new_pot_size"]):
            plant.pot_size = data["new_pot_size"]
            plant.save(update_fields=["pot_size"])
            update_cached_overview_details_keys(plant, {'pot_size': plant.pot_size})
            change_event.pot_size_after = plant.pot_size
            change_event.save()
            change_event_details = change_event.get_details()
        return JsonResponse(
            {
                "action": "repot",
                "plant": plant.uuid,
                "timestamp": timestamp.isoformat(),
                "change_event": change_event_details
            },
            status=200
        )

    except IntegrityError:
        return JsonResponse(
            {"error": "Event with same timestamp already exists"},
            status=409
        )


@get_user_token
@requires_json_post(["plant_id", "timestamp"])
@get_plant_from_post_body()
@get_timestamp_from_post_body
def divide_plant(plant, timestamp, **kwargs):
    '''Creates a DivisionEvent for specified Plant, returns parameters used in
    /register_plant payload to register child plant connected to division event.
    Requires JSON POST with plant_id and timestamp keys.
    '''

    try:
        # Create division event
        with transaction.atomic():
            event = DivisionEvent.objects.create(
                plant=plant,
                timestamp=timestamp
            )
        return JsonResponse(
            {
                "action": "divide",
                "plant": plant.uuid,
                "plant_key": plant.pk,
                "division_event_key": event.pk
            },
            status=200
        )

    except IntegrityError:
        return JsonResponse(
            {"error": "Event with same timestamp already exists"},
            status=409
        )


@get_user_token
def add_plant_photos(request, user):
    '''Creates Photo model for each image in request body.
    Requires FormData with plant_id key (UUID) and one or more images.
    Optional last_modified key is used as fallback timestamp if photo has no
    exif data (must be json with photo name keys, ms since epoch values).
    '''
    if request.method != "POST":
        return JsonResponse({'error': 'must post FormData'}, status=405)

    plant = Plant.objects.get_by_uuid(request.POST.get("plant_id"))
    if not plant:
        return JsonResponse({'error': 'unable to find plant'}, status=404)

    if user.pk != plant.user_id:
        return JsonResponse(
            {"error": "plant is owned by a different user"},
            status=403
        )

    if len(request.FILES) == 0:
        return JsonResponse({'error': 'no photos were sent'}, status=404)

    # Parse last_modified json (fallback timestamps for photos with no exif)
    last_modified = json.loads(request.POST.get('last_modified', '{}'))

    # Filter out unsupported image types
    created = []
    failed = []
    for key, file in request.FILES.items():
        try:
            with Image.open(file) as image:
                image.verify()
            # Add Photo instance to list (saved in bulk_create below)
            created.append(Photo(
                photo=file,
                plant=plant,
                timestamp=extract_timestamp_from_exif(
                    file,
                    last_modified.get(key)
                )
            ))
        except UnidentifiedImageError:
            failed.append(file.name)

    # Instantiate model for each valid file
    Photo.objects.bulk_create(created)
    # Queue celery tasks to generate thumbnails for each valid file
    # Cache key will be overwritten by task when complete
    for photo in created:
        cache.set(
            f"pending_photo_upload_{photo.pk}",
            {'status': 'processing', 'plant_id': str(plant.uuid)},
            None
        )
        process_photo_upload.delay(photo.pk)

    # Return list of new photo URLs (added to frontend state)
    return JsonResponse(
        {
            "uploaded": f"{len(created)} photo(s)",
            "failed": failed,
            "urls": [photo.get_details() for photo in created]
        },
        status=202
    )


@get_user_token
@requires_json_post(["plant_id", "photo_ids"])
@get_plant_from_post_body()
def get_photo_upload_status(plant, data, **kwargs):
    '''Returns status of requested pending photo uploads.
    Requires JSON POST with plant_id and photo_ids keys.
    '''
    photo_ids = data.get('photo_ids')
    statuses = []
    for photo_id in photo_ids:
        status = cache.get(f"pending_photo_upload_{photo_id}")
        if status:
            # Only return status if photo is owned by requesting user
            if status.get('plant_id') == str(plant.uuid):
                statuses.append({
                    'photo_id': photo_id,
                    **status
                })
                continue

        # Cache not found, query photo from database
        else:
            try:
                photo = Photo.objects.get(pk=photo_id)
                if photo.plant_id == plant.pk:
                    status = {
                        'photo_id': photo_id,
                        'plant_id': str(plant.uuid),
                        'status': 'processing' if photo.pending else 'complete'
                    }
                    if not photo.pending:
                        status['photo_details'] = photo.get_details()
                    statuses.append(status)
                    continue
            except Photo.DoesNotExist:
                pass

        # Photo not found or not owned by requesting user
        statuses.append({
            'photo_id': photo_id,
            'status': 'unknown'
        })

    return JsonResponse({'photos': statuses}, status=200)


@get_user_token
@requires_json_post(["plant_id", "photos"])
@get_plant_from_post_body()
def delete_plant_photos(plant, data, **kwargs):
    '''Deletes a list of Photos associated with a specific Plant.
    Requires JSON POST with plant_id (uuid) and photos (list of db keys).
    '''

    # Query all requested photos, get list of found primary keys
    photos = Photo.objects.filter(plant=plant, pk__in=data["photos"])
    deleted = [photo.pk for photo in photos]

    # Get list of photo primary keys that were not found in database
    failed = list(set(data["photos"]) - set(deleted))

    # Delete all found photos
    photos.delete()

    # Default photo not set: update thumbnail (most-recent may have changed)
    if not plant.default_photo_id:
        update_cached_overview_details_keys(
            plant,
            {'thumbnail': plant.get_thumbnail_url()}
        )
    # Default photo deleted: update thumbnail
    elif plant.default_photo_id in deleted:
        # Prevent get_thumbnail_url reading cached entry (no longer exists)
        plant.default_photo = None
        update_cached_overview_details_keys(
            plant,
            {'thumbnail': plant.get_thumbnail_url()}
        )

    return JsonResponse(
        {"deleted": deleted, "failed": failed},
        status=200 if deleted else 400
    )


@get_user_token
@requires_json_post(["plant_id", "photo_key"])
@get_plant_from_post_body()
def set_plant_default_photo(plant, data, **kwargs):
    '''Sets the photo used for overview page thumbnail.
    Requires JSON POST with plant_id (uuid) and photo_key (db primary key).
    '''
    try:
        photo = Photo.objects.get(plant=plant, pk=data["photo_key"])
        plant.default_photo = photo
        plant.save()
        # Update thumbnail in cached overview state
        update_cached_overview_details_keys(
            plant,
            {'thumbnail': plant.get_thumbnail_url()}
        )
    except Photo.DoesNotExist:
        return JsonResponse({"error": "unable to find photo"}, status=404)
    return JsonResponse(
        {"default_photo": plant.get_default_photo_details()},
        status=200
    )
