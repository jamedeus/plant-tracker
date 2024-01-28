import json
from datetime import datetime

from django.shortcuts import render
from django.http import JsonResponse, HttpResponseRedirect

from .models import Plant, WaterEvent, FertilizeEvent


def register_plant(request):
    if request.method == "POST":
        data = json.loads(request.body.decode("utf-8"))
    else:
        return JsonResponse({'Error': 'Must post data'}, safe=False, status=405)

    print(json.dumps(data, indent=4))

    # Replace empty strings with None (prevent empty strings in db)
    data = {key: (value if value != '' else None) for key, value in data.items()}

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


def manage_plant(request, uuid):
    # Confirm exists in database, redirect to register if not
    try:
        plant = Plant.objects.get(id=uuid)
    except Plant.DoesNotExist:
        return render(request, 'plant_tracker/register.html', {'new_plant': uuid})

    # Render management template
    return render(request, 'plant_tracker/manage.html', {'plant': plant})


def water_plant(request, uuid, timestamp=None):
    print(uuid)
    try:
        plant = Plant.objects.get(id=uuid)
    except Plant.DoesNotExist:
        return JsonResponse({"error": "plant not found"}, status=404)

    # Create new water event, add override timestamp if arg passed
    event = WaterEvent(plant=plant)
    if timestamp:
        event.timestamp = datetime.fromisoformat(timestamp.rstrip('Z'))
    event.save()

    return JsonResponse({"action": "water", "plant": uuid}, status=200)


def fertilize_plant(request, uuid, timestamp=None):
    try:
        plant = Plant.objects.get(id=uuid)
    except Plant.DoesNotExist:
        return JsonResponse({"error": "plant not found"}, status=404)

    # Create new water event, add override timestamp if arg passed
    event = FertilizeEvent(plant=plant)
    if timestamp:
        event.timestamp = datetime.fromisoformat(timestamp.rstrip('Z'))
    event.save()

    return JsonResponse({"action": "fertilize", "plant": uuid}, status=200)
