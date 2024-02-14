import json
import base64
from io import BytesIO

from django.conf import settings
from django.shortcuts import render
from django.core.exceptions import ValidationError
from django.http import JsonResponse, HttpResponseRedirect

from generate_qr_code_grid import generate_layout
from .models import Tray, Plant, RepotEvent
from .view_decorators import (
    events_map,
    get_plant_by_uuid,
    get_tray_by_uuid,
    requires_json_post,
    get_plant_from_post_body,
    get_tray_from_post_body,
    get_timestamp_from_post_body,
    get_event_type_from_post_body
)


def get_plant_options():
    '''Returns a list of dicts with name and uuid attributes of all existing plants
    Used to populate bulk management checkbox options in frontend
    '''
    return Plant.objects.values('uuid', 'name')


def get_plant_species_options():
    '''Returns a list of species for every Plant in database with no duplicates
    Used to populate species suggestions on plant registration form
    '''
    species = Plant.objects.all().values_list('species', flat=True)
    return list(set(i for i in species if i is not None))


def get_qr_codes(request):
    '''Returns printer-sized grid of QR code links as base64-encoded PNG
    QR codes point to manage endpoint, can be used for plants or trays
    '''

    # Return error if URL_PREFIX env var is unset or invalid
    if not settings.URL_PREFIX:
        return JsonResponse({'error': 'URL_PREFIX not configured'}, status=501)

    qr_codes = generate_layout(settings.URL_PREFIX)
    image = BytesIO()
    qr_codes.save(image, format="PNG")
    image_base64 = base64.b64encode(image.getvalue()).decode()
    return JsonResponse({'qr_codes': image_base64}, status=200)


def overview(request):
    '''Renders the overview page (shows existing plants/trays, or setup if none)'''
    context = {
        'plants': [],
        'trays': []
    }

    for plant in Plant.objects.all():
        context['plants'].append({
            'uuid': str(plant.uuid),
            'name': plant.get_display_name()
        })

    for tray in Tray.objects.all():
        context['trays'].append({
            'uuid': str(tray.uuid),
            'name': tray.get_display_name(),
            'plants': len(tray.plant_set.all())
        })

    print(json.dumps(context, indent=4))

    return render(request, 'plant_tracker/overview.html', context)


def manage(request, uuid):
    '''Renders plant/tray management pages, or registration page if UUID is new
    Accessed by scanning QR code sticker containing UUID
    '''

    # Look up UUID in plant database, render template if found
    plant = get_plant_by_uuid(uuid)
    if plant:
        context = {
            'plant': plant,
            'display_name': plant.get_display_name(),
            'water_events': plant.get_water_timestamps(),
            'fertilize_events': plant.get_fertilize_timestamps(),
            'trays': Tray.objects.all(),
            'species_options': get_plant_species_options()
        }
        return render(request, 'plant_tracker/manage_plant.html', context)

    # Loop up UUID in tray database, render template if found
    tray = get_tray_by_uuid(uuid)
    if tray:
        context = {
            'tray': tray,
            'display_name': tray.get_display_name(),
            'plant_ids': tray.get_plant_uuids(),
            'details': tray.get_plant_details(),
            'options': get_plant_options()
        }
        return render(request, 'plant_tracker/manage_tray.html', context)

    # Render registration form if UUID does not exist in either table
    context = {
        'new_id': uuid,
        'species_options': get_plant_species_options()
    }
    return render(request, 'plant_tracker/register.html', context)


@requires_json_post()
def register(data):
    '''Creates a Plant or Tray database entry with params from POST body
    Requires JSON POST with parameters from plant or tray registration forms
    '''

    # Replace empty strings with None (prevent empty strings in db)
    data = {key: (value if value != '' else None) for key, value in data.items()}
    print(json.dumps(data, indent=4))

    if data["type"] == "plant":
        Plant.objects.create(
            uuid=data["uuid"],
            name=data["name"],
            species=data["species"],
            description=data["description"],
            pot_size=data["pot_size"]
        )
    elif data["type"] == "tray":
        Tray.objects.create(
            uuid=data["uuid"],
            name=data["name"],
            location=data["location"]
        )

    # Redirect to manage page
    return HttpResponseRedirect(f'/manage/{data["uuid"]}')


@requires_json_post(["plant_id", "new_id"])
@get_plant_from_post_body
def change_plant_uuid(plant, data):
    '''Changes UUID of an existing Plant, called when QR code sticker changed
    Requires JSON POST with plant_id (uuid) and new_id (uuid) keys
    '''
    try:
        plant.uuid = data["new_id"]
        plant.save()
        return JsonResponse({"new_uuid": str(plant.uuid)}, status=200)
    except ValidationError:
        return JsonResponse({"error": "new_id key is not a valid UUID"}, status=400)


@requires_json_post(["tray_id", "new_id"])
@get_tray_from_post_body
def change_tray_uuid(tray, data):
    '''Changes UUID of an existing Tray, called when QR code sticker changed
    Requires JSON POST with tray_id (uuid) and new_id (uuid) keys
    '''
    try:
        tray.uuid = data["new_id"]
        tray.save()
        return JsonResponse({"new_uuid": str(tray.uuid)}, status=200)
    except ValidationError:
        return JsonResponse({"error": "new_id key is not a valid UUID"}, status=400)


@requires_json_post(["plant_id", "name", "species", "description", "pot_size"])
@get_plant_from_post_body
def edit_plant_details(plant, data):
    '''Updates description attributes of existing Plant entry
    Requires JSON POST with plant_id (uuid), name, species, description, and pot_size keys
    '''
    print(json.dumps(data, indent=4))

    # Replace empty strings with None (prevent empty strings in db)
    data = {key: (value if value != '' else None) for key, value in data.items()}

    # Overwrite database params with user values
    plant.name = data["name"]
    plant.species = data["species"]
    plant.description = data["description"]
    plant.pot_size = data["pot_size"]
    plant.save()

    # Reload manage page
    return HttpResponseRedirect(f'/manage/{data["plant_id"]}')


@requires_json_post(["tray_id", "name", "location"])
@get_tray_from_post_body
def edit_tray_details(tray, data):
    '''Updates description attributes of existing Tray entry
    Requires JSON POST with tray_id (uuid), name, and location keys
    '''
    print(json.dumps(data, indent=4))

    # Replace empty strings with None (prevent empty strings in db)
    data = {key: (value if value != '' else None) for key, value in data.items()}

    # Overwrite database params with user values
    tray.name = data["name"]
    tray.location = data["location"]
    tray.save()

    # Reload manage page
    return HttpResponseRedirect(f'/manage/{data["tray_id"]}')


@requires_json_post(["plant_id"])
@get_plant_from_post_body
def delete_plant(plant, **kwargs):
    '''Deletes an existing Plant from database, returns redirect to overview
    Requires JSON POST with plant_id (uuid) key
    '''
    plant.delete()
    return HttpResponseRedirect('/')


@requires_json_post(["tray_id"])
@get_tray_from_post_body
def delete_tray(tray, **kwargs):
    '''Deletes an existing Tray from database, returns redirect to overview
    Requires JSON POST with tray_id (uuid) key
    '''
    tray.delete()
    return HttpResponseRedirect('/')


@requires_json_post(["plant_id", "event_type", "timestamp"])
@get_plant_from_post_body
@get_timestamp_from_post_body
@get_event_type_from_post_body
def add_plant_event(plant, timestamp, event_type, **kwargs):
    '''Creates new Event entry with requested type for specified Plant entry
    Requires JSON POST with plant_id (uuid), event_type, and timestamp keys
    '''
    events_map[event_type].objects.create(plant=plant, timestamp=timestamp)
    return JsonResponse({"action": event_type, "plant": plant.uuid}, status=200)


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
            events_map[event_type].objects.create(plant=plant, timestamp=timestamp)
            added.append(plant_id)
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


@requires_json_post(["plant_id", "tray_id"])
@get_plant_from_post_body
@get_tray_from_post_body
def add_plant_to_tray(plant, tray, **kwargs):
    '''Adds specified Plant to specified Tray (creates database relation)
    Requires JSON POST with plant_id (uuid) and tray_id (uuid) keys
    '''
    plant.tray = tray
    plant.save()
    return JsonResponse(
        {"action": "add_plant_to_tray", "plant": plant.uuid, "tray": tray.uuid},
        status=200
    )


@requires_json_post(["plant_id"])
@get_plant_from_post_body
def remove_plant_from_tray(plant, **kwargs):
    '''Removes specified Plant from Tray (deletes database relation)
    Requires JSON POST with plant_id (uuid) key
    '''
    plant.tray = None
    plant.save()
    return JsonResponse(
        {"action": "remove_plant_from_tray", "plant": plant.uuid},
        status=200
    )


@requires_json_post(["tray_id", "plants"])
@get_tray_from_post_body
def bulk_add_plants_to_tray(tray, data):
    '''Adds a list of Plants to specified Tray (creates database relation for each)
    Requires JSON POST with tray_id (uuid) and plants (list of UUIDs) keys
    '''
    for plant_id in data["plants"]:
        plant = get_plant_by_uuid(plant_id)
        if plant:
            plant.tray = tray
            plant.save()
    return HttpResponseRedirect(f'/manage/{tray.uuid}')


@requires_json_post(["tray_id", "plants"])
@get_tray_from_post_body
def bulk_remove_plants_from_tray(tray, data):
    '''Removes a list of Plants from specified Tray (deletes database relations)
    Requires JSON POST with tray_id (uuid) and plants (list of UUIDs) keys
    '''
    for plant_id in data["plants"]:
        plant = get_plant_by_uuid(plant_id)
        if plant:
            plant.tray = None
            plant.save()
    return HttpResponseRedirect(f'/manage/{tray.uuid}')


@requires_json_post(["plant_id", "new_pot_size", "timestamp"])
@get_plant_from_post_body
@get_timestamp_from_post_body
def repot_plant(plant, timestamp, data):
    '''Creates a RepotEvent for specified Plant with optional new_pot_size
    Requires JSON POST with plant_id, new_pot_size, and timestamp keys
    '''

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
