import json
import base64
from io import BytesIO
from functools import wraps
from datetime import datetime

from django.shortcuts import render
from django.core.exceptions import ValidationError
from django.http import JsonResponse, HttpResponseRedirect

from generate_qr_code_grid import generate_layout
from .models import Tray, Plant, WaterEvent, FertilizeEvent


def get_plant_by_uuid(uuid):
    '''Returns Plant model instance matching UUID, or None if not found'''
    try:
        return Plant.objects.get(id=uuid)
    except Plant.DoesNotExist:
        return None


def get_tray_by_uuid(uuid):
    '''Returns Tray model instance matching UUID, or None if not found'''
    try:
        return Tray.objects.get(id=uuid)
    except Tray.DoesNotExist:
        return None


def get_plant_options():
    '''Returns a list of dicts with name and id attributes of all existing plants
    Used to populate checkbox options in frontend'''
    return Plant.objects.values('id', 'name')


def requires_json_post(func):
    '''Decorator throws error if request is not POST with JSON body
    Parses JSON from request body and passes to wrapped function as first arg
    '''
    @wraps(func)
    def wrapper(request, **kwargs):
        try:
            if request.method == "POST":
                data = json.loads(request.body.decode("utf-8"))
            else:
                return JsonResponse({'Error': 'Must post data'}, status=405)
        except json.decoder.JSONDecodeError:
            return JsonResponse({'Error': 'Request body must be JSON'}, status=405)
        return func(data, **kwargs)
    return wrapper


def get_plant_from_post_body(func):
    '''Decorator looks up plant by UUID, throws error if not found
    Must call after requires_json_post (expects dict with plant_id key as first arg)
    Passes Plant instance and data dict to wrapped function as plant and data kwargs
    '''
    @wraps(func)
    def wrapper(data, **kwargs):
        try:
            plant = get_plant_by_uuid(data["plant_id"])
            if plant is None:
                return JsonResponse({"error": "plant not found"}, status=404)
            return func(plant=plant, data=data, **kwargs)
        except KeyError:
            return JsonResponse(
                {"error": "POST body missing required 'plant_id' key"},
                status=400
            )
        except ValidationError:
            return JsonResponse(
                {"error": "plant_id key is not a valid UUID"},
                status=400
            )
    return wrapper


def get_tray_from_post_body(func):
    '''Decorator looks up tray by UUID, throws error if not found
    Must call after requires_json_post (expects dict with tray_id key as first arg)
    Passes Tray instance and data dict to wrapped function as tray and data kwargs
    '''
    @wraps(func)
    def wrapper(data, **kwargs):
        try:
            tray = get_tray_by_uuid(data["tray_id"])
            if tray is None:
                return JsonResponse({"error": "tray not found"}, status=404)
            return func(tray=tray, data=data, **kwargs)
        except KeyError:
            return JsonResponse(
                {"error": "POST body missing required 'tray_id' key"},
                status=400
            )
        except ValidationError:
            return JsonResponse(
                {"error": "tray_id key is not a valid UUID"},
                status=400
            )
    return wrapper


def get_timestamp_from_post_body(func):
    '''Decorator converts timestamp string Datetime object, throws error if invalid
    Must call after requires_json_post (expects dict with timestamp key as first arg)
    Passes Datetime object and data dict to wrapped function as timestamp and data kwargs
    '''
    def wrapper(data, **kwargs):
        try:
            timestamp = datetime.fromisoformat(data["timestamp"].rstrip("Z"))
            return func(timestamp=timestamp, data=data, **kwargs)
        except KeyError:
            return JsonResponse(
                {"error": "POST body missing required 'timestamp' key"},
                status=400
            )
        except ValueError:
            return JsonResponse({"error": "timestamp format invalid"}, status=400)
    return wrapper


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
        context = {'plant': plant, 'trays': Tray.objects.all()}
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
    return render(request, 'plant_tracker/register.html', {'new_id': uuid})


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
def water_plant(plant, timestamp, data):
    '''Creates new WaterEvent for specified Plant entry
    Requires POST with JSON body containing plant_id and timestamp keys
    '''
    WaterEvent.objects.create(plant=plant, timestamp=timestamp)
    return JsonResponse({"action": "water", "plant": plant.id}, status=200)


@requires_json_post
@get_plant_from_post_body
@get_timestamp_from_post_body
def fertilize_plant(plant, timestamp, data):
    '''Creates new FertilizeEvent for specified Plant entry
    Requires POST with JSON body containing plant_id and timestamp keys
    '''
    FertilizeEvent.objects.create(plant=plant, timestamp=timestamp)
    return JsonResponse({"action": "fertilize", "plant": plant.id}, status=200)


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
@get_timestamp_from_post_body
def bulk_water_plants(timestamp, data):
    '''Creates new WaterEvents for each Plant specified in POST body
    Requires POST with JSON body containing timestamp and plants (list of UUIDs) keys
    '''
    watered = []
    failed = []
    for plant_id in data["plants"]:
        plant = get_plant_by_uuid(plant_id)
        if plant:
            WaterEvent.objects.create(plant=plant, timestamp=timestamp)
            watered.append(plant_id)
        else:
            failed.append(plant_id)
    return JsonResponse(
        {"action": "bulk_water", "plants": watered, "failed": failed},
        status=200
    )


@requires_json_post
@get_timestamp_from_post_body
def bulk_fertilize_plants(timestamp, data):
    '''Creates new FertilizeEvent for each Plant specified in POST body
    Requires POST with JSON body containing timestamp and plants (list of UUIDs) keys
    '''
    fertilized = []
    failed = []
    for plant_id in data["plants"]:
        plant = get_plant_by_uuid(plant_id)
        if plant:
            FertilizeEvent.objects.create(plant=plant, timestamp=timestamp)
            fertilized.append(plant_id)
        else:
            failed.append(plant_id)
    return JsonResponse(
        {"action": "bulk_fertilize", "plants": fertilized, "failed": failed},
        status=200
    )


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
