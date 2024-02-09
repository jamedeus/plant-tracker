import json
import base64
from io import BytesIO

from django.shortcuts import render
from django.http import JsonResponse, HttpResponseRedirect

from generate_qr_code_grid import generate_layout
from .models import Tray, Plant
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
    '''Returns a list of dicts with name and id attributes of all existing plants
    Used to populate checkbox options in frontend
    '''
    return Plant.objects.values('id', 'name')


def get_plant_species_options():
    '''Returns a list of species for every Plant in database with no duplicates
    Used to populate species suggestions on registration form
    '''
    species = Plant.objects.all().values_list('species', flat=True)
    return list(set([i for i in species if i is not None]))


def get_qr_codes(request):
    '''Returns printer-sized grid of QR code links as base64-encoded PNG
    QR codes point to manage endpoint, can be used for plants or trays
    '''
    qr_codes = generate_layout()
    image = BytesIO()
    qr_codes.save(image, format="PNG")
    image_base64 = base64.b64encode(image.getvalue()).decode()
    return JsonResponse({'qr_codes': image_base64})


def overview(request):
    '''Renders the overview page (shows existing plants/trays, or setup if none)'''
    context = {
        'plants': Plant.objects.all(),
        'trays': Tray.objects.all()
    }
    return render(request, 'plant_tracker/overview.html', context)


def manage(request, uuid):
    '''Renders plant/tray management pages, or registration page if UUID is new
    Accessed by scanning QR code sticker
    '''
    # Look up UUID in plant database, render template if found
    plant = get_plant_by_uuid(uuid)
    if plant:
        context = {
            'plant': plant,
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
            'details': tray.get_plant_details(),
            'options': get_plant_options()
        }
        return render(request, 'plant_tracker/manage_tray.html', context)

    # Redirect to registration form if UUID does not exist in either database
    context = {
        'new_id': uuid,
        'species_options': get_plant_species_options()
    }
    return render(request, 'plant_tracker/register.html', context)


@requires_json_post
def register(data):
    '''Creates a Plant or Tray database entry with params from POST body
    Called from form on manage page shown after scanning a new QR code
    '''

    # Replace empty strings with None (prevent empty strings in db)
    data = {key: (value if value != '' else None) for key, value in data.items()}
    print(json.dumps(data, indent=4))

    if data["type"] == "plant":
        Plant.objects.create(
            id=data["uuid"],
            name=data["name"],
            species=data["species"],
            description=data["description"],
            pot_size=data["pot_size"]
        )
    elif data["type"] == "tray":
        Tray.objects.create(
            id=data["uuid"],
            name=data["name"],
            location=data["location"]
        )

    # Redirect to manage page
    return HttpResponseRedirect(f'/manage/{data["uuid"]}')


@requires_json_post
@get_plant_from_post_body
def edit_plant_details(plant, data):
    '''Updates existing Plant database entry with params from POST body
    Called from form in edit plant modal on manage page
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


@requires_json_post
@get_tray_from_post_body
def edit_tray_details(tray, data):
    '''Updates existing Tray database entry with params from POST body
    Called from form in edit tray modal on manage page
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


@requires_json_post
@get_plant_from_post_body
def delete_plant(plant, data):
    '''Deletes an existing Plant from database, returns redirect to overview'''
    plant.delete()
    return HttpResponseRedirect('/')


@requires_json_post
@get_tray_from_post_body
def delete_tray(tray, data):
    '''Deletes an existing Tray from database, returns redirect to overview'''
    tray.delete()
    return HttpResponseRedirect('/')


@requires_json_post
@get_plant_from_post_body
@get_timestamp_from_post_body
@get_event_type_from_post_body
def add_plant_event(plant, timestamp, event_type, data):
    '''Creates new Event entry with requested type for specified Plant entry
    Requires POST with plant_id, event_type, and timestamp keys in JSON body
    '''
    events_map[event_type].objects.create(plant=plant, timestamp=timestamp)
    return JsonResponse({"action": event_type, "plant": plant.id}, status=200)


@requires_json_post
@get_timestamp_from_post_body
@get_event_type_from_post_body
def bulk_add_plant_events(timestamp, event_type, data):
    '''Creates new Event entry with requested type for each Plant specified in body
    Requires POST with plants (list of UUIDs), event_type, and timestamp keys in JSON body
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


@requires_json_post
@get_plant_from_post_body
@get_timestamp_from_post_body
@get_event_type_from_post_body
def delete_plant_event(plant, timestamp, event_type, data):
    '''Deletes the Event matching the plant, type, and timestamp specified in body
    Requires POST with plant_id, event_type, and timestamp keys in JSON body
    '''
    try:
        event = events_map[event_type].objects.get(plant=plant, timestamp=timestamp)
        event.delete()
        return JsonResponse({"deleted": event_type, "plant": plant.id}, status=200)
    except events_map[event_type].DoesNotExist:
        return JsonResponse({"error": "event not found"}, status=404)


@requires_json_post
@get_tray_from_post_body
@get_timestamp_from_post_body
def water_tray(tray, timestamp, data):
    '''Creates new WaterEvent for each Plant in specified Tray
    Requires POST with JSON body containing tray_id and timestamp keys
    '''
    tray.water_all(timestamp=timestamp)
    return JsonResponse({"action": "water tray", "tray": tray.id}, status=200)


@requires_json_post
@get_tray_from_post_body
@get_timestamp_from_post_body
def fertilize_tray(tray, timestamp, data):
    '''Creates new FertilizeEvent for each Plant in specified Tray
    Requires POST with JSON body containing tray_id and timestamp keys
    '''
    tray.fertilize_all(timestamp=timestamp)
    return JsonResponse({"action": "fertilize tray", "tray": tray.id}, status=200)


@requires_json_post
@get_plant_from_post_body
@get_tray_from_post_body
def add_plant_to_tray(plant, tray, data):
    '''Adds specified Plant to specified Tray (creates database relation)
    Requires POST with JSON body containing plant_id and tray_id keys
    '''
    plant.tray = tray
    plant.save()
    return JsonResponse(
        {"action": "add_plant_to_tray", "plant": plant.id, "tray": tray.id},
        status=200
    )


@requires_json_post
@get_plant_from_post_body
def remove_plant_from_tray(plant, data):
    '''Removes specified Plant from Tray (deletes database relation)
    Requires POST with JSON body containing plant_id key
    '''
    plant.tray = None
    plant.save()
    return JsonResponse(
        {"action": "remove_plant_from_tray", "plant": plant.id},
        status=200
    )


@requires_json_post
@get_tray_from_post_body
def bulk_add_plants_to_tray(tray, data):
    '''Adds a list of Plants to specified Tray (creates database relation for each)
    Requires POST with JSON body containing tray_id and plants (list of UUIDs) keys
    '''
    for plant_id in data["plants"]:
        plant = get_plant_by_uuid(plant_id)
        if plant:
            plant.tray = tray
            plant.save()
    return HttpResponseRedirect(f'/manage/{tray.id}')


@requires_json_post
@get_tray_from_post_body
def bulk_remove_plants_from_tray(tray, data):
    '''Removes a list of Plants from specified Tray (deletes database relations)
    Requires POST with JSON body containing plants key (list of UUIDs to remove)
    '''
    for plant_id in data["plants"]:
        plant = get_plant_by_uuid(plant_id)
        if plant:
            plant.tray = None
            plant.save()
    return HttpResponseRedirect(f'/manage/{tray.id}')
