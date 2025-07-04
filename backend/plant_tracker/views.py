'''Django API endpoint functions'''

import json
import base64
from io import BytesIO

from django.conf import settings
from django.core.cache import cache
from django.db import transaction, IntegrityError
from django.core.exceptions import ValidationError
from django.http import JsonResponse, HttpResponseRedirect
from PIL import UnidentifiedImageError

from generate_qr_code_grid import generate_layout
from .render_react_app import render_react_app, render_permission_denied_page
from .models import (
    Group,
    Plant,
    RepotEvent,
    Photo,
    NoteEvent,
    DivisionEvent,
    get_plant_options,
    get_plant_species_options
)
from .view_decorators import (
    events_map,
    get_user_token,
    get_plant_by_uuid,
    get_group_by_uuid,
    get_plant_or_group_by_uuid,
    requires_json_post,
    get_plant_from_post_body,
    get_group_from_post_body,
    get_qr_instance_from_post_body,
    get_timestamp_from_post_body,
    get_event_type_from_post_body,
    clean_payload_data
)
from .build_states import get_overview_state, get_manage_plant_state
from .update_cached_states import (
    update_group_details_in_cached_states,
    remove_instance_from_cached_overview_state
)


@requires_json_post(["qr_per_row"])
def get_qr_codes(data, **kwargs):
    '''Returns printer-sized grid of QR code links as base64-encoded PNG.
    QR codes point to manage endpoint, can be used for plants or groups.
    '''

    # Return error if URL_PREFIX env var is unset or invalid
    if not settings.URL_PREFIX:
        return JsonResponse({'error': 'URL_PREFIX not configured'}, status=501)

    try:
        qr_codes = generate_layout(settings.URL_PREFIX, int(data["qr_per_row"]))
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
def overview(request, user):
    '''Renders the overview page for the requesting user (shows their existing
    plants/groups, or setup if none).
    '''

    # Set generic page title in SINGLE_USER_MODE or if user has no first name
    if settings.SINGLE_USER_MODE or not user.first_name:
        title='Plant Overview'
    else:
        title=f"{user.first_name}'s Plants"

    return render_react_app(
        request,
        title=title,
        bundle='overview',
        state=get_overview_state(user)
    )


@get_user_token
def get_overview_page_state(_, user):
    '''Returns current overview page state for the requesting user, used to
    refresh contents when returning to over view with back button.
    '''
    return JsonResponse(
        get_overview_state(user),
        status=200
    )


@get_user_token
def archived_overview(request, user):
    '''Renders overview page for the requesting user showing only their
    archived plants and groups.
    '''

    archived_plants = Plant.objects.filter(archived=True, user=user)
    archived_groups = Group.objects.filter(archived=True, user=user)

    # Redirect to main overview if user has no archived plants or groups
    if not archived_plants and not archived_groups:
        return HttpResponseRedirect('/')

    state = {
        'plants': {
            str(plant.uuid): plant.get_details()
            for plant in archived_plants
        },
        'groups': {
            str(group.uuid): group.get_details()
            for group in archived_groups
        },
    }

    return render_react_app(
        request,
        title='Archived',
        bundle='overview',
        state=state
    )


@get_user_token
def manage(request, uuid, user):
    '''Renders the correct page when a QR code is scanned:
      - manage_plant: rendered if QR code UUID matches an existing Plant entry
      - manage_group: rendered if QR code UUID matches an existing Group entry
      - register: rendered if the QR code UUID does not match an existing Plant/Group
    '''

    # Look up UUID in plant table, render manage_plant page if found
    plant = get_plant_by_uuid(uuid)
    if plant:
        return render_manage_plant_page(request, plant, user)

    # Loop up UUID in group table, render manage_group page if found
    group = get_group_by_uuid(uuid)
    if group:
        return render_manage_group_page(request, group, user)

    # Render register page if UUID is new
    return render_registration_page(request, uuid, user)


def render_manage_plant_page(request, plant, user):
    '''Renders management page for an existing plant.
    Called by /manage endpoint if UUID is found in database plant table.
    '''

    # Render permission denied page if requesting user does not own plant
    if plant.user != user:
        return render_permission_denied_page(
            request,
            'You do not have permission to view this plant'
        )

    return render_react_app(
        request,
        title='Manage Plant',
        bundle='manage_plant',
        state=get_manage_plant_state(plant)
    )


def get_plant_state(request, uuid):
    '''Returns current manage_plant state for the requested plant.
    Used to refresh contents after user presses back button.
    '''
    try:
        plant = Plant.objects.get(uuid=uuid)
        return JsonResponse(
            get_manage_plant_state(plant),
            status=200
        )
    except Plant.DoesNotExist:
        return JsonResponse({'Error': 'Plant not found'}, status=404)
    except ValidationError:
        return JsonResponse({'Error': 'Requires plant UUID'}, status=400)


def build_manage_group_state(group):
    '''Builds state parsed by manage_group react app and returns.'''
    return {
        'group': group.get_details(),
        'details': group.get_plant_details(),
        'options': get_plant_options(group.user)
    }


def render_manage_group_page(request, group, user):
    '''Renders management page for an existing group.
    Called by /manage endpoint if UUID is found in database group table.
    '''

    # Render permission denied page if requesting user does not own group
    if group.user != user:
        return render_permission_denied_page(
            request,
            'You do not have permission to view this group'
        )

    return render_react_app(
        request,
        title='Manage Group',
        bundle='manage_group',
        state=build_manage_group_state(group)
    )


def get_group_state(request, uuid):
    '''Returns current manage_group state for the requested group.
    Used to refresh contents after user presses back button.
    '''
    try:
        group = Group.objects.get(uuid=uuid)
        return JsonResponse(
            build_manage_group_state(group),
            status=200
        )
    except Group.DoesNotExist:
        return JsonResponse({'Error': 'Group not found'}, status=404)
    except ValidationError:
        return JsonResponse({'Error': 'Requires group UUID'}, status=400)


def render_registration_page(request, uuid, user):
    '''Renders registration page used to create a new plant or group.
    Called by /manage endpoint if UUID does not exist in database.

    If the old_uuid cache is set (see /change_qr_code endpoint) context includes
    information used by frontend to show change QR prompt (calls /change_uuid
    and redirects if confirmed, shows normal registration form if rejected).

    If the dividing_from cache is set (see /divide_plant endpoint) context
    includes information used by frontend to show confirm dividing prompt (shows
    plant form with pre-filled details if confirmed, shows normal registration
    for if rejected).
    '''

    state = {
        'new_id': uuid,
        'species_options': get_plant_species_options(),
    }

    # Check if user is changing plant QR code, add details if so
    old_uuid = cache.get(f'old_uuid_{user.pk}')
    if old_uuid:
        instance = get_plant_or_group_by_uuid(old_uuid)
        # If UUID no longer exists in database (plant/group deleted) clear cache
        if instance is None:
            cache.delete(f'old_uuid_{user.pk}')
        else:
            state['changing_qr_code'] = {
                'type': 'plant' if isinstance(instance, Plant) else 'group',
                'instance': instance.get_details(),
                'new_uuid': uuid
            }
            if state['changing_qr_code']['type'] == 'plant':
                preview_url = instance.get_default_photo_details()['preview']
                state['changing_qr_code']['preview'] = preview_url

    # Check if user is dividing plant, add details if dividing
    division_in_progress = cache.get(f'division_in_progress_{user.pk}')
    if division_in_progress:
        plant = get_plant_by_uuid(division_in_progress['divided_from_plant_uuid'])
        state['dividing_from'] = {
            'plant_details': plant.get_details(),
            'default_photo': plant.get_default_photo_details(),
            'plant_key': str(plant.pk),
            'event_key': division_in_progress['division_event_key']
        }

    return render_react_app(
        request,
        title='Register New Plant',
        bundle='register',
        state=state
    )


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
            plant.full_clean()
            plant.save()

        # If divided from existing plant: create RepotEvent with parent plant
        # pot size as old and current pot size as new
        if plant.divided_from:
            with transaction.atomic():
                RepotEvent.objects.create(
                    plant=plant,
                    timestamp=plant.created,
                    old_pot_size=plant.divided_from.pot_size,
                    new_pot_size=plant.pot_size
                )

        # Redirect to manage page
        return HttpResponseRedirect(f'/manage/{data["uuid"]}')

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
            group.full_clean()
            group.save()

        # Redirect to manage page
        return HttpResponseRedirect(f'/manage/{data["uuid"]}')

    except IntegrityError:
        return JsonResponse(
            {"error": "uuid already exists in database"},
            status=409
        )

    except ValidationError as error:
        return JsonResponse({"error": error.message_dict}, status=400)


@get_user_token
@requires_json_post(["uuid"])
@get_qr_instance_from_post_body
def change_qr_code(instance, user, **kwargs):
    '''Caches plant or group UUID from POST body for 15 minutes. If the same
    user scans a new QR before timeout /manage endpoint will return a
    confirmation page with a button that calls /change_uuid to overwrite UUID.
    Requires JSON POST with uuid (uuid) key.
    '''
    cache.set(f'old_uuid_{user.pk}', str(instance.uuid), 900)
    return JsonResponse(
        {"success": "scan new QR code within 15 minutes to confirm"},
        status=200
    )


@get_user_token
@requires_json_post(["uuid", "new_id"])
@get_qr_instance_from_post_body
def change_uuid(instance, data, user, **kwargs):
    '''Changes UUID of an existing Plant or Group. Called from confirmation
    page served when new QR code scanned (after calling /change_qr_code).
    Requires JSON POST with uuid (uuid) and new_id (uuid) keys.
    '''
    try:
        # Delete plant/group from cached state (prevent duplicate, keys are uuid
        # so once it changes the old entry can't be removed)
        if isinstance(instance, Plant):
            remove_instance_from_cached_overview_state(instance, 'plants')
        else:
            remove_instance_from_cached_overview_state(instance, 'groups')
        # Change UUID, save (hook will update cached overview state)
        instance.uuid = data["new_id"]
        instance.save(update_fields=["uuid"])
        cache.delete(f'old_uuid_{user.pk}')
        return JsonResponse({"new_uuid": str(instance.uuid)}, status=200)
    except ValidationError:
        return JsonResponse({"error": "new_id key is not a valid UUID"}, status=400)


@get_user_token
@requires_json_post(["plant_id", "name", "species", "description", "pot_size"])
@get_plant_from_post_body
@clean_payload_data
def edit_plant_details(plant, data, **kwargs):
    '''Updates description attributes of existing Plant entry.
    Requires JSON POST with plant_id (uuid), name, species, description
    (string), and pot_size (int) keys.
    '''
    print(json.dumps(data, indent=4))

    # Overwrite database params with user values (remove extra whitespace)
    plant.name = data["name"]
    plant.species = data["species"]
    plant.description = data["description"]
    plant.pot_size = data["pot_size"]
    # Enforce length limits
    try:
        plant.full_clean()
        plant.save()
    except ValidationError as error:
        return JsonResponse({"error": error.message_dict}, status=400)

    # Return modified payload with new display_name
    del data["plant_id"]
    data["display_name"] = plant.get_display_name()
    return JsonResponse(data, status=200)


@get_user_token
@requires_json_post(["group_id", "name", "location", "description"])
@get_group_from_post_body
@clean_payload_data
def edit_group_details(group, data, **kwargs):
    '''Updates description attributes of existing Group entry.
    Requires JSON POST with group_id (uuid), name, and location (string) keys.
    '''
    print(json.dumps(data, indent=4))

    # Overwrite database params with user values
    group.name = data["name"]
    group.location = data["location"]
    group.description = data["description"]
    # Enforce length limits
    try:
        group.full_clean()
        group.save()
    except ValidationError as error:
        return JsonResponse({"error": error.message_dict}, status=400)

    # Return modified payload with new display_name
    del data["group_id"]
    data["display_name"] = group.get_display_name()
    return JsonResponse(data, status=200)


@get_user_token
@requires_json_post(["plant_id"])
@get_plant_from_post_body
def delete_plant(plant, **kwargs):
    '''Deletes an existing Plant from database.
    Requires JSON POST with plant_id (uuid) key.
    '''
    plant.delete()
    return JsonResponse({"deleted": plant.uuid}, status=200)


@get_user_token
@requires_json_post(["plant_id", "archived"])
@get_plant_from_post_body
def archive_plant(plant, data, **kwargs):
    '''Sets the archived attribute of an existing Plant to bool in POST body.
    Requires JSON POST with plant_id (uuid) and archived (bool) keys.
    '''
    if not isinstance(data["archived"], bool):
        return JsonResponse({"error": "archived key is not bool"}, status=400)

    plant.archived = data["archived"]
    plant.save()
    return JsonResponse({"updated": plant.uuid}, status=200)


@get_user_token
@requires_json_post(["group_id"])
@get_group_from_post_body
def delete_group(group, **kwargs):
    '''Deletes an existing Group from database.
    Requires JSON POST with group_id (uuid) key.
    '''
    group.delete()
    return JsonResponse({"deleted": group.uuid}, status=200)


@get_user_token
@requires_json_post(["group_id", "archived"])
@get_group_from_post_body
def archive_group(group, data, **kwargs):
    '''Sets the archived attribute of an existing Group to bool in POST body.
    Requires JSON POST with group_id (uuid) and archived (bool) keys.
    '''
    if not isinstance(data["archived"], bool):
        return JsonResponse({"error": "archived key is not bool"}, status=400)

    group.archived = data["archived"]
    group.save()
    return JsonResponse({"updated": group.uuid}, status=200)


@get_user_token
@requires_json_post(["uuids"])
def bulk_delete_plants_and_groups(user, data, **kwargs):
    '''Deletes a list of plants and groups owned by the requesting user.
    Requires JSON POST with uuids key (list of plant or group uuids).
    '''
    deleted = []
    failed = []
    for uuid in data["uuids"]:
        instance = get_plant_or_group_by_uuid(uuid)
        # Make sure plant exists and is owned by user
        if instance and instance.user == user:
            instance.delete()
            deleted.append(uuid)
        else:
            failed.append(uuid)

    return JsonResponse(
        {"deleted": deleted, "failed": failed},
        status=200 if deleted else 400
    )


@get_user_token
@requires_json_post(["uuids", "archived"])
def bulk_archive_plants_and_groups(user, data, **kwargs):
    '''Sets the archived attribute for a list of plants and groups owned by the
    requesting user.
    Requires JSON POST with uuids (list of uuids) and archived (bool) keys.
    '''
    archived = []
    failed = []
    for uuid in data["uuids"]:
        instance = get_plant_or_group_by_uuid(uuid)
        # Make sure instance exists and is owned by user
        if instance and instance.user == user:
            instance.archived = data["archived"]
            instance.save()
            archived.append(uuid)
        else:
            failed.append(uuid)

    return JsonResponse(
        {"archived": archived, "failed": failed},
        status=200 if archived else 400
    )


@get_user_token
@requires_json_post(["plant_id", "event_type", "timestamp"])
@get_plant_from_post_body
@get_timestamp_from_post_body
@get_event_type_from_post_body
def add_plant_event(plant, timestamp, event_type, **kwargs):
    '''Creates new Event entry with requested type for specified Plant entry.
    Requires JSON POST with plant_id (uuid), event_type, and timestamp keys.
    '''
    try:
        # Use transaction.atomic to clean up after IntegrityError if duplicate
        with transaction.atomic():
            events_map[event_type].objects.create(
                plant=plant,
                timestamp=timestamp
            )

        return JsonResponse(
            {"action": event_type, "plant": plant.uuid},
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
    added = []
    failed = []
    for plant_id in data["plants"]:
        plant = get_plant_by_uuid(plant_id)
        # Make sure plant exists and is owned by user
        if plant and plant.user == user:
            try:
                # Use transaction.atomic to clean up after IntegrityError if duplicate
                with transaction.atomic():
                    events_map[event_type].objects.create(
                        plant=plant,
                        timestamp=timestamp
                    )
                added.append(plant_id)
            except IntegrityError:
                failed.append(plant_id)
        else:
            failed.append(plant_id)

    # Return 200 if at least 1 succeeded, otherwise return error
    return JsonResponse(
        {"action": event_type, "plants": added, "failed": failed},
        status=200 if added else 400
    )


@get_user_token
@requires_json_post(["plant_id", "event_type", "timestamp"])
@get_plant_from_post_body
@get_timestamp_from_post_body
@get_event_type_from_post_body
def delete_plant_event(plant, timestamp, event_type, **kwargs):
    '''Deletes the Event matching the plant, type, and timestamp specified in body.
    Requires JSON POST with plant_id (uuid), event_type, and timestamp keys.
    '''
    try:
        event = events_map[event_type].objects.get(plant=plant, timestamp=timestamp)
        event.delete()
        return JsonResponse({"deleted": event_type, "plant": plant.uuid}, status=200)
    except events_map[event_type].DoesNotExist:
        return JsonResponse({"error": "event not found"}, status=404)


@get_user_token
@requires_json_post(["plant_id", "events"])
@get_plant_from_post_body
def bulk_delete_plant_events(plant, data, **kwargs):
    '''Deletes a list of events (any type) associated with a single plant.
    Requires JSON POST with plant_id (uuid) and events (list of dicts) keys.
    The events list must contain dicts with timestamp and type keys.
    '''
    deleted = []
    failed = []
    for event in data["events"]:
        print(event)
        try:
            events_map[event["type"]].objects.get(
                plant=plant,
                timestamp=event["timestamp"]
            ).delete()
            deleted.append(event)
        except (KeyError, TypeError):
            failed.append(event)
        except events_map[event["type"]].DoesNotExist:
            failed.append(event)
    return JsonResponse({"deleted": deleted, "failed": failed}, status=200)


@get_user_token
@requires_json_post(["plant_id", "timestamp", "note_text"])
@clean_payload_data
@get_plant_from_post_body
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
            note.clean_fields()
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
@get_plant_from_post_body
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
            note.full_clean()
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
@requires_json_post(["plant_id", "timestamp"])
@get_plant_from_post_body
@get_timestamp_from_post_body
def delete_plant_note(plant, timestamp, **kwargs):
    '''Deletes the NoteEvent matching the plant and timestamp specified in body.
    Requires JSON POST with plant_id (uuid) and timestamp keys.
    '''
    try:
        note = NoteEvent.objects.get(plant=plant, timestamp=timestamp)
        note.delete()
        return JsonResponse({"deleted": "note", "plant": plant.uuid}, status=200)
    except NoteEvent.DoesNotExist:
        return JsonResponse({"error": "note not found"}, status=404)


@get_user_token
@requires_json_post(["plant_id", "group_id"])
@get_plant_from_post_body
@get_group_from_post_body
def add_plant_to_group(plant, group, **kwargs):
    '''Adds specified Plant to specified Group (creates database relation).
    Requires JSON POST with plant_id (uuid) and group_id (uuid) keys.
    '''
    plant.group = group
    plant.save(update_fields=["group"])

    return JsonResponse(
        {
            "action": "add_plant_to_group",
            "plant": plant.uuid,
            "group_name": group.get_display_name(),
            "group_uuid": group.uuid
        },
        status=200
    )


@get_user_token
@requires_json_post(["plant_id"])
@get_plant_from_post_body
def remove_plant_from_group(plant, **kwargs):
    '''Removes specified Plant from Group (deletes database relation).
    Requires JSON POST with plant_id (uuid) key.
    '''
    old_group = plant.group
    plant.group = None
    plant.save(update_fields=["group"])

    # Update number of plants shown on overview and cached group_options
    update_group_details_in_cached_states(old_group)

    return JsonResponse(
        {"action": "remove_plant_from_group", "plant": plant.uuid},
        status=200
    )


@get_user_token
@requires_json_post(["group_id", "plants"])
@get_group_from_post_body
def bulk_add_plants_to_group(group, data, **kwargs):
    '''Adds a list of Plants to specified Group (creates database relation for each).
    Requires JSON POST with group_id (uuid) and plants (list of UUIDs) keys.
    '''
    added = []
    failed = []
    for plant_id in data["plants"]:
        plant = get_plant_by_uuid(plant_id)
        if plant:
            plant.group = group
            plant.save(update_fields=["group"])
            added.append(plant.get_details())
        else:
            failed.append(plant_id)

    return JsonResponse({"added": added, "failed": failed}, status=200)


@get_user_token
@requires_json_post(["group_id", "plants"])
@get_group_from_post_body
def bulk_remove_plants_from_group(data, group, **kwargs):
    '''Removes a list of Plants from specified Group (deletes database relations).
    Requires JSON POST with group_id (uuid) and plants (list of UUIDs) keys.
    '''
    removed = []
    failed = []
    for plant_id in data["plants"]:
        plant = get_plant_by_uuid(plant_id)
        if plant:
            plant.group = None
            plant.save(update_fields=["group"])
            removed.append(plant.get_details())
        else:
            failed.append(plant_id)

    # Update number of plants shown on overview and cached group_options
    update_group_details_in_cached_states(group)

    return JsonResponse({"removed": removed, "failed": failed}, status=200)


@get_user_token
@requires_json_post(["plant_id", "new_pot_size", "timestamp"])
@get_plant_from_post_body
@get_timestamp_from_post_body
def repot_plant(plant, timestamp, data, **kwargs):
    '''Creates a RepotEvent for specified Plant with optional new_pot_size.
    Requires JSON POST with plant_id, new_pot_size, and timestamp keys.
    '''

    try:
        # Create with current pot_size as both old and new
        with transaction.atomic():
            event = RepotEvent.objects.create(
                plant=plant,
                timestamp=timestamp,
                old_pot_size=plant.pot_size,
                new_pot_size=plant.pot_size
            )
        # If new_pot_size specified update plant.pot_size and event.new_pot_size
        if data["new_pot_size"]:
            event.new_pot_size = data["new_pot_size"]
            event.save()
            plant.pot_size = data["new_pot_size"]
            plant.save()
        return JsonResponse({"action": "repot", "plant": plant.uuid}, status=200)

    except IntegrityError:
        return JsonResponse(
            {"error": "Event with same timestamp already exists"},
            status=409
        )


@get_user_token
@requires_json_post(["plant_id", "timestamp"])
@get_plant_from_post_body
@get_timestamp_from_post_body
def divide_plant(user, plant, timestamp, **kwargs):
    '''Creates a DivisionEvent for specified Plant and caches uuid so new plants
    can be registered with reverse relation to parent plant.
    Requires JSON POST with plant_id and timestamp keys.
    '''

    try:
        # Create division event
        with transaction.atomic():
            event = DivisionEvent.objects.create(
                plant=plant,
                timestamp=timestamp
            )
        # Cache object with old plant UUID and DivisionEvent key for 15 minutes.
        # Will be included in register page context, used to create db relations.
        cache.set(f'division_in_progress_{user.pk}', {
            'divided_from_plant_uuid': str(plant.uuid),
            'division_event_key': str(event.pk)
        }, 900)
        return JsonResponse({"action": "divide", "plant": plant.uuid}, status=200)

    except IntegrityError:
        return JsonResponse(
            {"error": "Event with same timestamp already exists"},
            status=409
        )


@get_user_token
def add_plant_photos(request, user):
    '''Creates Photo model for each image in request body.
    Requires FormData with plant_id key (UUID) and one or more images.
    '''
    if request.method != "POST":
        return JsonResponse({'error': 'must post FormData'}, status=405)

    plant = get_plant_by_uuid(request.POST.get("plant_id"))
    if not plant:
        return JsonResponse({'error': 'unable to find plant'}, status=404)

    if user != plant.user:
        return JsonResponse(
            {"error": "plant is owned by a different user"},
            status=403
        )

    if len(request.FILES) == 0:
        return JsonResponse({'error': 'no photos were sent'}, status=404)

    # Instantiate model for each file in payload
    created = []
    failed = []
    for key in request.FILES:
        try:
            photo = Photo.objects.create(
                photo=request.FILES[key],
                plant=plant
            )
            created.append(photo.get_details())
        except UnidentifiedImageError:
            failed.append(request.FILES[key].name)

    # Return list of new photo URLs (added to frontend state)
    return JsonResponse(
        {
            "uploaded": f"{len(created)} photo(s)",
            "failed": failed,
            "urls": created
        },
        status=200
    )


@get_user_token
@requires_json_post(["plant_id", "delete_photos"])
@get_plant_from_post_body
def delete_plant_photos(plant, data, **kwargs):
    '''Deletes a list of Photos associated with a specific Plant.
    Requires JSON POST with plant_id (uuid) and delete_photos (list of db keys).
    '''
    deleted = []
    failed = []
    for primary_key in data["delete_photos"]:
        try:
            photo = Photo.objects.get(plant=plant, pk=primary_key)
            photo.delete()
            deleted.append(primary_key)
        except Photo.DoesNotExist:
            failed.append(primary_key)

    return JsonResponse({"deleted": deleted, "failed": failed}, status=200)


@get_user_token
@requires_json_post(["plant_id", "photo_key"])
@get_plant_from_post_body
def set_plant_default_photo(plant, data, **kwargs):
    '''Sets the photo used for overview page thumbnail.
    Requires JSON POST with plant_id (uuid) and photo_key (db primary key).
    '''
    try:
        photo = Photo.objects.get(plant=plant, pk=data["photo_key"])
        plant.default_photo = photo
        plant.save()
    except Photo.DoesNotExist:
        return JsonResponse({"error": "unable to find photo"}, status=404)
    return JsonResponse(
        {"default_photo": plant.get_default_photo_details()},
        status=200
    )
