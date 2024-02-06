import json
import base64
from io import BytesIO
from functools import wraps
from datetime import datetime

from django.shortcuts import render
from django.http import JsonResponse, HttpResponseRedirect

from .models import Tray, Plant, WaterEvent, FertilizeEvent
from generate_qr_code_grid import generate_layout


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
    Must call after requires_json_post (expects dict with uuid key as first arg)
    Passes Plant instance to wrapped function as first arg, data dict as second
    '''
    @wraps(func)
    def wrapper(data, **kwargs):
        plant = get_plant_by_uuid(data["uuid"])
        if plant is None:
            return JsonResponse({"error": "plant not found"}, status=404)
        return func(plant, data, **kwargs)
    return wrapper


def get_tray_from_post_body(func):
    '''Decorator looks up tray by UUID, throws error if not found
    Must call after requires_json_post (expects dict with uuid key as first arg)
    Passes Tray instance to wrapped function as first arg, data dict as second
    '''
    @wraps(func)
    def wrapper(data, **kwargs):
        tray = get_tray_by_uuid(data["uuid"])
        if tray is None:
            return JsonResponse({"error": "tray not found"}, status=404)
        return func(tray, data, **kwargs)
    return wrapper


def overview(request):
    context = {
        'plants': Plant.objects.all(),
        'trays': Tray.objects.all()
    }
    return render(request, 'plant_tracker/overview.html', context)


def get_qr_codes(request):
    qr_codes = generate_layout()
    image = BytesIO()
    qr_codes.save(image, format="PNG")
    image_base64 = base64.b64encode(image.getvalue()).decode()
    return JsonResponse({'qr_codes': image_base64})


@requires_json_post
def register(data):
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
    return HttpResponseRedirect(f'/manage/{data["uuid"]}')


@requires_json_post
@get_tray_from_post_body
def edit_tray_details(tray, data):
    print(json.dumps(data, indent=4))

    # Replace empty strings with None (prevent empty strings in db)
    data = {key: (value if value != '' else None) for key, value in data.items()}

    # Overwrite database params with user values
    tray.name = data["name"]
    tray.location = data["location"]
    tray.save()

    # Reload manage page
    return HttpResponseRedirect(f'/manage/{data["uuid"]}')


def manage(request, uuid):
    # Look up UUID in plant database, render template if found
    plant = get_plant_by_uuid(uuid)
    if plant:
        context = {'plant': plant, 'trays': Tray.objects.all()}
        return render(request, 'plant_tracker/manage_plant.html', context)

    # Loop up UUID in tray database, render template if found
    tray = get_tray_by_uuid(uuid)
    if tray:
        context = {'tray': tray, 'details': tray.get_plant_details()}
        return render(request, 'plant_tracker/manage_tray.html', context)

    # Redirect to registration form if UUID does not exist in either database
    return render(request, 'plant_tracker/register.html', {'new_id': uuid})


@requires_json_post
@get_plant_from_post_body
def delete_plant(plant, data):
    # Delete plant, reload overview page
    plant.delete()
    return HttpResponseRedirect('/')


@requires_json_post
@get_plant_from_post_body
def water_plant(plant, data):
    # Create new water event, add override timestamp if arg passed
    WaterEvent.objects.create(
        plant=plant,
        timestamp=datetime.fromisoformat(data["timestamp"].rstrip("Z"))
    )
    return JsonResponse({"action": "water", "plant": plant.id}, status=200)


@requires_json_post
@get_plant_from_post_body
def fertilize_plant(plant, data):
    # Create new water event, add override timestamp if arg passed
    FertilizeEvent.objects.create(
        plant=plant,
        timestamp=datetime.fromisoformat(data["timestamp"].rstrip("Z"))
    )
    return JsonResponse({"action": "fertilize", "plant": plant.id}, status=200)


@requires_json_post
@get_tray_from_post_body
def water_tray(tray, data):
    tray.water_all(timestamp=datetime.fromisoformat(data["timestamp"].rstrip("Z")))
    return JsonResponse({"action": "water tray", "tray": tray.id}, status=200)


@requires_json_post
@get_tray_from_post_body
def fertilize_tray(tray, data):
    tray.fertilize_all(timestamp=datetime.fromisoformat(data["timestamp"].rstrip("Z")))
    return JsonResponse({"action": "fertilize tray", "tray": tray.id}, status=200)


# TODO convert decorators to use kwargs instead of positional
@requires_json_post
def add_plant_to_tray(data):
    # Get Plant and Tray instances
    tray = get_tray_by_uuid(data["tray_id"])
    plant = get_plant_by_uuid(data["plant_id"])

    if tray is None:
        return JsonResponse({"error": "tray not found"}, status=404)
    if plant is None:
        return JsonResponse({"error": "plant not found"}, status=404)

    plant.tray = tray
    plant.save()
    return JsonResponse(
        {"action": "add_plant_to_tray", "plant": plant.id, "tray": tray.id},
        status=200
    )


@requires_json_post
@get_plant_from_post_body
def remove_plant_from_tray(plant, data):
    plant.tray = None
    plant.save()
    return JsonResponse(
        {"action": "remove_plant_from_tray", "plant": plant.id},
        status=200
    )
