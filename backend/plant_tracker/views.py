'''Django API endpoint functions'''

import json
import base64
from io import BytesIO

from django.conf import settings
from django.shortcuts import render
from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.http import JsonResponse, HttpResponseRedirect
from django.views.decorators.csrf import ensure_csrf_cookie

from generate_qr_code_grid import generate_layout
from .models import Group, Plant, RepotEvent, Photo, NoteEvent
from .view_decorators import (
    events_map,
    get_plant_by_uuid,
    get_group_by_uuid,
    requires_json_post,
    get_plant_from_post_body,
    get_group_from_post_body,
    get_timestamp_from_post_body,
    get_event_type_from_post_body,
    clean_payload_data
)


def get_plant_options():
    '''Returns a list of dicts with attributes of all existing plants
    List is cached for up to 10 minutes, or until Plant model changed
    Used to populate options in add plants modal on manage_group page
    '''
    plant_options = cache.get('plant_options')
    if not plant_options:
        plant_options = [plant.get_details() for plant in Plant.objects.all()]
        cache.set('plant_options', plant_options, 600)
    return plant_options


def get_plant_species_options():
    '''Returns a list of species for every Plant in database with no duplicates
    List is cached for up to 10 minutes, or until Plant model changed
    Used to populate species suggestions on plant registration form
    '''
    species_options = cache.get('species_options')
    if not species_options:
        species = Plant.objects.all().values_list('species', flat=True)
        species_options = list(set(i for i in species if i is not None))
        cache.set('species_options', species_options, 600)
    return species_options


@ensure_csrf_cookie
def render_react_app(request, title, bundle, state, log_state=True):
    '''Helper function to render react app in boilerplate HTML template
    Takes request object, page title, react bundle name, and react state object
    Context object is printed to console unless optional log_state arg is False
    '''
    context = {
        'title': title,
        'js_bundle': f'plant_tracker/{bundle}.js',
        'state': state
    }

    if log_state:
        print(json.dumps(context, indent=4))

    return render(request, 'plant_tracker/index.html', context)


@requires_json_post(["qr_per_row"])
def get_qr_codes(data):
    '''Returns printer-sized grid of QR code links as base64-encoded PNG
    QR codes point to manage endpoint, can be used for plants or groups
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


def overview(request):
    '''Renders the overview page (shows existing plants/groups, or setup if none)'''

    # Create state object parsed by react app
    state = {
        'plants': [],
        'groups': []
    }

    for plant in Plant.objects.all():
        state['plants'].append(plant.get_details())

    for group in Group.objects.all():
        state['groups'].append(group.get_details())

    return render_react_app(
        request,
        title='Overview',
        bundle='overview',
        state=state
    )


def manage(request, uuid):
    '''Renders plant/group management pages, or registration page if UUID is new
    Accessed by scanning QR code sticker containing UUID
    '''

    # Look up UUID in plant database, render template if found
    plant = get_plant_by_uuid(uuid)
    if plant:
        # Create state object parsed by react app
        state = {
            'plant': plant.get_details(),
            'groups': [group.get_details() for group in Group.objects.all()],
            'species_options': get_plant_species_options(),
            'photo_urls': plant.get_photo_urls()
        }

        # Replace name key (get_details returns display_name) with actual name
        state['plant']['name'] = plant.name
        state['plant']['display_name'] = plant.get_display_name()

        # Add all water and fertilize timestamps
        state['plant']['events'] = {
            'water': plant.get_water_timestamps(),
            'fertilize': plant.get_fertilize_timestamps(),
            'prune': plant.get_prune_timestamps(),
            'repot': plant.get_repot_timestamps()
        }

        # Add timestamps and text of all notes
        state['notes'] = [
            {'timestamp': note.timestamp.isoformat(), 'text': note.text}
            for note in plant.noteevent_set.all()
        ]

        # Add group details if plant is in a group
        if plant.group:
            state['plant']['group'] = {
                'name': plant.group.get_display_name(),
                'uuid': str(plant.group.uuid)
            }
        else:
            state['plant']['group'] = None

        return render_react_app(
            request,
            title='Manage Plant',
            bundle='manage_plant',
            state=state
        )

    # Loop up UUID in group database, render template if found
    group = get_group_by_uuid(uuid)
    if group:
        # Create state object parsed by react app
        state = {
            'group': {
                'uuid': str(group.uuid),
                'name': group.name,
                'display_name': group.get_display_name(),
                'location': group.location,
                'description': group.description
            },
            'details': group.get_plant_details(),
            'options': get_plant_options()
        }

        return render_react_app(
            request,
            title='Manage Group',
            bundle='manage_group',
            state=state
        )

    # If does not match existing plant or group, check if repot mode is active
    # (waiting for user to scan the new QR code after beginning repot)
    old_plant_uuid = cache.get('old_uuid')
    if old_plant_uuid:
        plant = get_plant_by_uuid(old_plant_uuid)
        state = {
            'plant': plant.get_details(),
            'new_uuid': uuid
        }
        state['plant']['name'] = plant.name
        state['plant']['display_name'] = plant.get_display_name()
        return render_react_app(
            request,
            title='Confirm new QR code',
            bundle='confirm_new_qr_code',
            state=state
        )

    # Render state for registration form if UUID does not exist in either table
    state = {
        'new_id': uuid,
        'species_options': get_plant_species_options()
    }

    return render_react_app(
        request,
        title='Register New Plant',
        bundle='register',
        state=state
    )


@requires_json_post(["name", "species", "pot_size", "description", "uuid"])
@clean_payload_data
def register_plant(data):
    '''Creates a Plant database entry with params from POST body
    Requires JSON POST with parameters from plant registration forms
    '''

    # Instantiate model with payload keys as kwargs
    Plant.objects.create(**data)

    # Redirect to manage page
    return HttpResponseRedirect(f'/manage/{data["uuid"]}')


@requires_json_post(["name", "location", "description", "uuid"])
@clean_payload_data
def register_group(data):
    '''Creates a Group database entry with params from POST body
    Requires JSON POST with parameters from  group registration form
    '''

    # Instantiate model with payload keys as kwargs
    Group.objects.create(**data)

    # Redirect to manage page
    return HttpResponseRedirect(f'/manage/{data["uuid"]}')


@requires_json_post(["plant_id"])
@get_plant_from_post_body
def change_qr_code(plant, **kwargs):
    '''Caches plant UUID from POST body for 15 minutes, if a new QR code is
    scanned before timeout /manage endpoint will return a confirmation page
    with a button that calls /change_plant_uuid to overwrite UUID.
    '''
    cache.set('old_uuid', str(plant.uuid), 900)
    return JsonResponse(
        {"success": "scan new QR code within 15 minutes to confirm"},
        status=200
    )


@requires_json_post(["plant_id", "new_id"])
@get_plant_from_post_body
def change_plant_uuid(plant, data):
    '''Changes UUID of an existing Plant, called when QR code sticker changed
    Requires JSON POST with plant_id (uuid) and new_id (uuid) keys
    '''
    try:
        plant.uuid = data["new_id"]
        plant.save()
        cache.delete('old_uuid')
        return JsonResponse({"new_uuid": str(plant.uuid)}, status=200)
    except ValidationError:
        return JsonResponse({"error": "new_id key is not a valid UUID"}, status=400)


@requires_json_post(["group_id", "new_id"])
@get_group_from_post_body
def change_group_uuid(group, data):
    '''Changes UUID of an existing Group, called when QR code sticker changed
    Requires JSON POST with group_id (uuid) and new_id (uuid) keys
    '''
    try:
        group.uuid = data["new_id"]
        group.save()
        return JsonResponse({"new_uuid": str(group.uuid)}, status=200)
    except ValidationError:
        return JsonResponse({"error": "new_id key is not a valid UUID"}, status=400)


@requires_json_post(["plant_id", "name", "species", "description", "pot_size"])
@get_plant_from_post_body
@clean_payload_data
def edit_plant_details(plant, data):
    '''Updates description attributes of existing Plant entry
    Requires JSON POST with plant_id (uuid), name, species, description, and pot_size keys
    '''
    print(json.dumps(data, indent=4))

    # Overwrite database params with user values (remove extra whitespace)
    plant.name = data["name"]
    plant.species = data["species"]
    plant.description = data["description"]
    plant.pot_size = data["pot_size"]
    plant.save()

    # Return modified payload with new display_name
    del data["plant_id"]
    data["pot_size"] = int(data["pot_size"])
    data["display_name"] = plant.get_display_name()
    return JsonResponse(data, status=200)


@requires_json_post(["group_id", "name", "location", "description"])
@get_group_from_post_body
@clean_payload_data
def edit_group_details(group, data):
    '''Updates description attributes of existing Group entry
    Requires JSON POST with group_id (uuid), name, and location keys
    '''
    print(json.dumps(data, indent=4))

    # Overwrite database params with user values
    group.name = data["name"]
    group.location = data["location"]
    group.description = data["description"]
    group.save()

    # Return modified payload with new display_name
    del data["group_id"]
    data["display_name"] = group.get_display_name()
    return JsonResponse(data, status=200)


@requires_json_post(["plant_id"])
@get_plant_from_post_body
def delete_plant(plant, **kwargs):
    '''Deletes an existing Plant from database
    Requires JSON POST with plant_id (uuid) key
    '''
    plant.delete()
    return JsonResponse({"deleted": plant.uuid}, status=200)


@requires_json_post(["group_id"])
@get_group_from_post_body
def delete_group(group, **kwargs):
    '''Deletes an existing Group from database
    Requires JSON POST with group_id (uuid) key
    '''
    group.delete()
    return JsonResponse({"deleted": group.uuid}, status=200)


@requires_json_post(["plant_id", "event_type", "timestamp"])
@get_plant_from_post_body
@get_timestamp_from_post_body
@get_event_type_from_post_body
def add_plant_event(plant, timestamp, event_type, **kwargs):
    '''Creates new Event entry with requested type for specified Plant entry
    Requires JSON POST with plant_id (uuid), event_type, and timestamp keys
    '''
    try:
        events_map[event_type].objects.create(plant=plant, timestamp=timestamp)
        return JsonResponse(
            {"action": event_type, "plant": plant.uuid},
            status=200
        )
    except ValidationError:
        return JsonResponse(
            {"error": "event with same timestamp already exists"},
            status=409
        )


@requires_json_post(["plants", "event_type", "timestamp"])
@get_timestamp_from_post_body
@get_event_type_from_post_body
def bulk_add_plant_events(timestamp, event_type, data):
    '''Creates new Event entry with requested type for each Plant specified in body
    Requires JSON POST with plants (list of UUIDs), event_type, and timestamp keys
    '''
    added = []
    failed = []
    for plant_id in data["plants"]:
        plant = get_plant_by_uuid(plant_id)
        if plant:
            try:
                events_map[event_type].objects.create(plant=plant, timestamp=timestamp)
                added.append(plant_id)
            except ValidationError:
                failed.append(plant_id)
        else:
            failed.append(plant_id)
    return JsonResponse(
        {"action": event_type, "plants": added, "failed": failed},
        status=200
    )


@requires_json_post(["plant_id", "event_type", "timestamp"])
@get_plant_from_post_body
@get_timestamp_from_post_body
@get_event_type_from_post_body
def delete_plant_event(plant, timestamp, event_type, **kwargs):
    '''Deletes the Event matching the plant, type, and timestamp specified in body
    Requires JSON POST with plant_id (uuid), event_type, and timestamp keys
    '''
    try:
        event = events_map[event_type].objects.get(plant=plant, timestamp=timestamp)
        event.delete()
        return JsonResponse({"deleted": event_type, "plant": plant.uuid}, status=200)
    except events_map[event_type].DoesNotExist:
        return JsonResponse({"error": "event not found"}, status=404)


@requires_json_post(["plant_id", "events"])
@get_plant_from_post_body
def bulk_delete_plant_events(plant, data):
    '''Deletes a list of events (any type) associated with a single plant
    Requires JSON POST with plant_id (uuid) and events (list of dicts) keys
    The events list must contain dicts with timestamp and type keys
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


@requires_json_post(["plant_id", "timestamp", "note_text"])
@get_plant_from_post_body
@get_timestamp_from_post_body
def add_plant_note(plant, timestamp, data):
    '''Creates new NoteEvent with user-entered text for specified Plant entry
    Requires JSON POST with plant_id (uuid), timestamp, and note_text keys
    '''
    try:
        NoteEvent.objects.create(
            plant=plant,
            timestamp=timestamp,
            text=data["note_text"]
        )
        return JsonResponse(
            {"action": "add_note", "plant": plant.uuid},
            status=200
        )
    except ValidationError:
        return JsonResponse(
            {"error": "note with same timestamp already exists"},
            status=409
        )


@requires_json_post(["plant_id", "timestamp", "note_text"])
@get_plant_from_post_body
@get_timestamp_from_post_body
def edit_plant_note(plant, timestamp, data):
    '''Overwrites text of an existing NoteEvent with the specified timestamp
    Requires JSON POST with plant_id (uuid), timestamp, and note_text keys
    '''
    try:
        event = NoteEvent.objects.get(plant=plant, timestamp=timestamp)
        event.text = data["note_text"]
        event.save()
        return JsonResponse({"action": "edit_note", "plant": plant.uuid}, status=200)
    except NoteEvent.DoesNotExist:
        return JsonResponse({"error": "note not found"}, status=404)


@requires_json_post(["plant_id", "timestamp"])
@get_plant_from_post_body
@get_timestamp_from_post_body
def delete_plant_note(plant, timestamp, **kwargs):
    '''Deletes the NoteEvent matching the plant and timestamp specified in body
    Requires JSON POST with plant_id (uuid) and timestamp keys
    '''
    try:
        event = NoteEvent.objects.get(plant=plant, timestamp=timestamp)
        event.delete()
        return JsonResponse({"deleted": "note", "plant": plant.uuid}, status=200)
    except NoteEvent.DoesNotExist:
        return JsonResponse({"error": "note not found"}, status=404)


@requires_json_post(["plant_id", "group_id"])
@get_plant_from_post_body
@get_group_from_post_body
def add_plant_to_group(plant, group, **kwargs):
    '''Adds specified Plant to specified Group (creates database relation)
    Requires JSON POST with plant_id (uuid) and group_id (uuid) keys
    '''
    plant.group = group
    plant.save()
    return JsonResponse(
        {
            "action": "add_plant_to_group",
            "plant": plant.uuid,
            "group_name": group.get_display_name(),
            "group_uuid": group.uuid
        },
        status=200
    )


@requires_json_post(["plant_id"])
@get_plant_from_post_body
def remove_plant_from_group(plant, **kwargs):
    '''Removes specified Plant from Group (deletes database relation)
    Requires JSON POST with plant_id (uuid) key
    '''
    plant.group = None
    plant.save()
    return JsonResponse(
        {"action": "remove_plant_from_group", "plant": plant.uuid},
        status=200
    )


@requires_json_post(["group_id", "plants"])
@get_group_from_post_body
def bulk_add_plants_to_group(group, data):
    '''Adds a list of Plants to specified Group (creates database relation for each)
    Requires JSON POST with group_id (uuid) and plants (list of UUIDs) keys
    '''
    added = []
    failed = []
    for plant_id in data["plants"]:
        plant = get_plant_by_uuid(plant_id)
        if plant:
            plant.group = group
            plant.save()
            added.append(plant.get_details())
        else:
            failed.append(plant_id)
    return JsonResponse({"added": added, "failed": failed}, status=200)


@requires_json_post(["group_id", "plants"])
@get_group_from_post_body
def bulk_remove_plants_from_group(data, **kwargs):
    '''Removes a list of Plants from specified Group (deletes database relations)
    Requires JSON POST with group_id (uuid) and plants (list of UUIDs) keys
    '''
    added = []
    failed = []
    for plant_id in data["plants"]:
        plant = get_plant_by_uuid(plant_id)
        if plant:
            plant.group = None
            plant.save()
            added.append(plant_id)
        else:
            failed.append(plant_id)
    return JsonResponse({"removed": added, "failed": failed}, status=200)


@requires_json_post(["plant_id", "new_pot_size", "timestamp"])
@get_plant_from_post_body
@get_timestamp_from_post_body
def repot_plant(plant, timestamp, data):
    '''Creates a RepotEvent for specified Plant with optional new_pot_size
    Requires JSON POST with plant_id, new_pot_size, and timestamp keys
    '''

    try:
        # Create with current pot_size as both old and new
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

    except ValidationError:
        return JsonResponse(
            {"error": "Event with same timestamp already exists"},
            status=409
        )


def add_plant_photos(request):
    '''Creates Photo model for each image in request body
    Requires FormData with plant_id key (UUID) and one or more images
    '''
    if request.method != "POST":
        return JsonResponse({'error': 'must post FormData'}, status=405)

    plant = get_plant_by_uuid(request.POST.get("plant_id"))
    if not plant:
        return JsonResponse({'error': 'unable to find plant'}, status=404)

    if len(request.FILES) == 0:
        return JsonResponse({'error': 'no photos were sent'}, status=404)

    # Instantiate model for each file in payload
    created = []
    for key in request.FILES:
        photo = Photo.objects.create(
            photo=request.FILES[key],
            plant=plant
        )
        created.append({
            "created": photo.created.isoformat(),
            "image": photo.get_photo_url(),
            "thumbnail": photo.get_thumbnail_url(),
            "key": photo.pk
        })

    # Return list of new photo URLs (added to frontend state)
    return JsonResponse(
        {
            "uploaded": f"{len(request.FILES)} photo(s)",
            "urls": created
        },
        status=200
    )


@requires_json_post(["plant_id", "delete_photos"])
@get_plant_from_post_body
def delete_plant_photos(plant, data):
    '''Deletes a list of Photos associated with a specific Plant
    Requires JSON POST with plant_id (uuid) and delete_photos (list of db keys)
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


@requires_json_post(["plant_id", "photo_key"])
@get_plant_from_post_body
def set_plant_default_photo(plant, data):
    '''Sets the photo used for overview page thumbnail
    Requires JSON POST with plant_id (uuid) and photo_key (db primary key)
    '''
    try:
        photo = Photo.objects.get(plant=plant, pk=data["photo_key"])
        plant.default_photo = photo
        plant.save()
    except Photo.DoesNotExist:
        return JsonResponse({"error": "unable to find photo"}, status=404)
    return JsonResponse({"default_photo": plant.get_thumbnail()}, status=200)
