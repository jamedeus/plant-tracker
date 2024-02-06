import json
import base64
from io import BytesIO
from functools import wraps
from datetime import datetime

from django.shortcuts import render
from django.http import JsonResponse, HttpResponseRedirect

from .models import Plant, WaterEvent, FertilizeEvent
from generate_qr_code_grid import generate_layout


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


def get_plant_by_uuid(func):
    '''Decorator looks up plant by UUID, throws error if not found
    Must call after requires_json_post (expects dict with uuid key as first arg)
    Passes Plant instance to wrapped function as first arg, data dict as second
    '''
    @wraps(func)
    def wrapper(data, **kwargs):
        try:
            plant = Plant.objects.get(id=data["uuid"])
        except Plant.DoesNotExist:
            return JsonResponse({"error": "plant not found"}, status=404)
        return func(plant, data, **kwargs)
    return wrapper


def overview(request):
    plants = Plant.objects.all()
    return render(request, 'plant_tracker/overview.html', {'plants': plants})


def get_qr_codes(request):
    qr_codes = generate_layout()
    image = BytesIO()
    qr_codes.save(image, format="PNG")
    image_base64 = base64.b64encode(image.getvalue()).decode()
    return JsonResponse({'qr_codes': image_base64})


@requires_json_post
def register_plant(data):
    # Replace empty strings with None (prevent empty strings in db)
    data = {key: (value if value != '' else None) for key, value in data.items()}
    print(json.dumps(data, indent=4))

    # Add plant to database
    plant = Plant(
        id=data["uuid"],
        name=data["name"],
        species=data["species"],
        description=data["description"],
        pot_size=data["pot_size"]
    )
    plant.save()

    # Redirect to manage page
    return HttpResponseRedirect(f'/manage/{data["uuid"]}')


@requires_json_post
@get_plant_by_uuid
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


def manage_plant(request, uuid):
    # Confirm exists in database, redirect to register if not
    try:
        plant = Plant.objects.get(id=uuid)
    except Plant.DoesNotExist:
        return render(request, 'plant_tracker/register.html', {'new_plant': uuid})

    # Render management template
    return render(request, 'plant_tracker/manage.html', {'plant': plant})


@requires_json_post
@get_plant_by_uuid
def delete_plant(plant, data):
    # Delete plant, reload overview page
    plant.delete()
    return HttpResponseRedirect('/')


@requires_json_post
@get_plant_by_uuid
def water_plant(plant, data):
    # Create new water event, add override timestamp if arg passed
    WaterEvent.objects.create(
        plant=plant,
        timestamp=datetime.fromisoformat(data["timestamp"].rstrip("Z"))
    )
    return JsonResponse({"action": "water", "plant": plant.id}, status=200)


@requires_json_post
@get_plant_by_uuid
def fertilize_plant(plant, data):
    # Create new water event, add override timestamp if arg passed
    FertilizeEvent.objects.create(
        plant=plant,
        timestamp=datetime.fromisoformat(data["timestamp"].rstrip("Z"))
    )
    return JsonResponse({"action": "fertilize", "plant": plant.id}, status=200)
