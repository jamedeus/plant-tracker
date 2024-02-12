import json
from functools import wraps
from datetime import datetime

from django.http import JsonResponse
from django.core.exceptions import ValidationError

from .models import Tray, Plant, WaterEvent, FertilizeEvent, PruneEvent, RepotEvent


# Map event types to model that should be instantiated
events_map = {
    'water': WaterEvent,
    'fertilize': FertilizeEvent,
    'prune': PruneEvent,
    'repot': RepotEvent
}


def get_plant_by_uuid(uuid):
    '''Returns Plant model instance matching UUID, or None if not found'''
    try:
        return Plant.objects.get(uuid=uuid)
    except Plant.DoesNotExist:
        return None


def get_tray_by_uuid(uuid):
    '''Returns Tray model instance matching UUID, or None if not found'''
    try:
        return Tray.objects.get(uuid=uuid)
    except Tray.DoesNotExist:
        return None


def requires_json_post(required_keys=None):
    '''Decorator throws error if request is not POST with JSON body
    Accepts optional list of required keys, throws error if any are missing
    Parses JSON from request body and passes to wrapped function as data kwarg
    '''
    def decorator(func):
        @wraps(func)
        def wrapper(request, **kwargs):
            try:
                if request.method != "POST":
                    return JsonResponse({'error': 'must post data'}, status=405)
                data = json.loads(request.body.decode("utf-8"))
                if required_keys:
                    missing_keys = [key for key in required_keys if key not in data]
                    if missing_keys:
                        return JsonResponse(
                            {
                                'error': 'POST body missing required keys',
                                'keys': missing_keys
                            },
                            status=400
                        )
            except json.decoder.JSONDecodeError:
                return JsonResponse({'error': 'request body must be JSON'}, status=405)
            return func(data=data, **kwargs)
        return wrapper
    return decorator


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
    '''Decorator converts timestamp string to Datetime object, throws error if invalid
    Must call after requires_json_post (expects dict with timestamp key as first arg)
    Passes Datetime object and data dict to wrapped function as timestamp and data kwargs
    '''
    def wrapper(data, **kwargs):
        try:
            timestamp = datetime.fromisoformat(data["timestamp"].replace('Z', '+00:00'))
            return func(timestamp=timestamp, data=data, **kwargs)
        except KeyError:
            return JsonResponse(
                {"error": "POST body missing required 'timestamp' key"},
                status=400
            )
        except ValueError:
            return JsonResponse({"error": "timestamp format invalid"}, status=400)
    return wrapper


def get_event_type_from_post_body(func):
    '''Decorator verifies event_type from POST body, throws error if missing or invalid
    Must call after requires_json_post (expects dict with event_type key as first arg)
    Passes event_type and data dict to wrapped function as event_type and data kwargs
    '''
    def wrapper(data, **kwargs):
        try:
            if data["event_type"] in events_map:
                return func(event_type=data["event_type"], data=data, **kwargs)
            return JsonResponse(
                {"error": "invalid event_type, must be 'water', 'fertilize', 'prune', or 'repot"},
                status=400
            )
        except KeyError:
            return JsonResponse(
                {"error": "POST body missing required 'event_type' key"},
                status=400
            )
    return wrapper
