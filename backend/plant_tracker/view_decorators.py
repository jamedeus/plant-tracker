'''Decorators to simplify endpoint error handling and POST body parsing.

Several decorators can be chained to validate that the expected JSON keys are
present, query model entries from the database, and pass models to the wrapped
endpoint function as arguments. An error response is returned to the client
from the decorator if any of these steps fail, simplifying endpoint functions.
'''

import json
from functools import wraps
from datetime import datetime

from django.conf import settings
from django.contrib.auth import get_user_model
from django.http import JsonResponse, HttpResponseRedirect
from django.core.exceptions import ValidationError

from .render_react_app import render_permission_denied_page
from .models import Group, Plant, WaterEvent, FertilizeEvent, PruneEvent, RepotEvent


# Map event types to model that should be instantiated
events_map = {
    'water': WaterEvent,
    'fertilize': FertilizeEvent,
    'prune': PruneEvent,
    'repot': RepotEvent
}


# Get list of event type options for error message when invalid type received
options = list(events_map.keys())
# pylint: disable-next=consider-using-f-string
EVENT_TYPE_OPTIONS = "'{}'".format("', '".join(options[:-1]) + "', or '" + options[-1])


def get_plant_by_uuid(uuid):
    '''Returns Plant model instance matching UUID, or None if not found'''
    try:
        return Plant.objects.get(uuid=uuid)
    except Plant.DoesNotExist:
        return None


def get_group_by_uuid(uuid):
    '''Returns Group model instance matching UUID, or None if not found'''
    try:
        return Group.objects.get(uuid=uuid)
    except Group.DoesNotExist:
        return None


def get_plant_or_group_by_uuid(uuid):
    '''Returns Plant or Group model instance matching UUID, or None if neither found'''
    instance = get_plant_by_uuid(uuid)
    if not instance:
        instance = get_group_by_uuid(uuid)
    return instance


def get_default_user():
    '''Returns default user (owns all models when SINGLE_USER_MODE enabled)'''
    return get_user_model().objects.get(username=settings.DEFAULT_USERNAME)


def get_user_token(func):
    '''Passes User model object to wrapped function as user kwarg.
    If SINGLE_USER_MODE enabled returns default user without checking request.
    If user accounts enabled reads user from requests. If not logged in returns
    401 error for POST, redirect to login page for GET.
    '''
    @wraps(func)
    def wrapper(request, **kwargs):
        # Return default user without checking auth if SINGLE_USER_MODE enabled
        if settings.SINGLE_USER_MODE:
            return func(request, user=get_default_user(), **kwargs)
        if not request.user.is_authenticated:
            # Redirect to login page if not signed in
            if request.method != "POST":
                return HttpResponseRedirect(f'/accounts/login/?next={request.path}')
            # Frontend sendPostRequest redirects to login if it receives 401
            return JsonResponse({'error': 'authentication required'}, status=401)
        return func(request, user=request.user, **kwargs)
    return wrapper


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
            return func(request=request, data=data, **kwargs)
        return wrapper
    return decorator


def get_plant_from_post_body(func):
    '''Decorator looks up plant by UUID, throws error if not found
    If called after get_user_token throws error if Plant is not owned be user
    Must call after requires_json_post (expects dict with plant_id key as first arg)
    Passes Plant instance and data dict to wrapped function as plant and data kwargs
    '''
    @wraps(func)
    def wrapper(data, **kwargs):
        try:
            plant = get_plant_by_uuid(data["plant_id"])
            if plant is None:
                return JsonResponse({"error": "plant not found"}, status=404)
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
        if 'user' in kwargs and plant.user != kwargs['user']:
            return JsonResponse(
                {"error": "plant is owned by a different user"},
                status=403
            )
        return func(plant=plant, data=data, **kwargs)
    return wrapper


def get_group_from_post_body(func):
    '''Decorator looks up group by UUID, throws error if not found
    If called after get_user_token throws error if Group is not owned be user
    Must call after requires_json_post (expects dict with group_id key as first arg)
    Passes Group instance and data dict to wrapped function as group and data kwargs
    '''
    @wraps(func)
    def wrapper(data, **kwargs):
        try:
            group = get_group_by_uuid(data["group_id"])
            if group is None:
                return JsonResponse({"error": "group not found"}, status=404)
        except KeyError:
            return JsonResponse(
                {"error": "POST body missing required 'group_id' key"},
                status=400
            )
        except ValidationError:
            return JsonResponse(
                {"error": "group_id key is not a valid UUID"},
                status=400
            )
        if 'user' in kwargs and group.user != kwargs['user']:
            return JsonResponse(
                {"error": "group is owned by a different user"},
                status=403
            )
        return func(group=group, data=data, **kwargs)
    return wrapper


def get_qr_instance_from_post_body(func):
    '''Decorator looks up plant or group by UUID, throws error if neither found
    If called after get_user_token throws error if instance is not owned be user
    Must call after requires_json_post (expects dict with uuid key as first arg)
    Passes instance and data dict to wrapped function as instance and data kwargs
    '''
    @wraps(func)
    def wrapper(data, **kwargs):
        try:
            instance = get_plant_or_group_by_uuid(data["uuid"])
            if instance is None:
                return JsonResponse(
                    {"error": "uuid does not match any plant or group"},
                    status=404
                )
        except KeyError:
            return JsonResponse(
                {"error": "POST body missing required 'uuid' key"},
                status=400
            )
        except ValidationError:
            return JsonResponse(
                {"error": "uuid key is not a valid UUID"},
                status=400
            )
        if 'user' in kwargs and instance.user != kwargs['user']:
            return JsonResponse(
                {"error": "instance is owned by a different user"},
                status=403
            )
        return func(instance=instance, data=data, **kwargs)
    return wrapper


def get_timestamp_from_post_body(func):
    '''Decorator converts timestamp string to Datetime object, throws error if invalid
    Must call after requires_json_post (expects dict with timestamp key as first arg)
    Passes Datetime object and data dict to wrapped function as timestamp and data kwargs
    '''
    def wrapper(data, **kwargs):
        try:
            timestamp = datetime.fromisoformat(data["timestamp"].replace('Z', '+00:00'))
        except KeyError:
            return JsonResponse(
                {"error": "POST body missing required 'timestamp' key"},
                status=400
            )
        except ValueError:
            return JsonResponse({"error": "timestamp format invalid"}, status=400)
        return func(timestamp=timestamp, data=data, **kwargs)
    return wrapper


def get_event_type_from_post_body(func):
    '''Decorator verifies event_type from POST body, throws error if missing or invalid
    Must call after requires_json_post (expects dict with event_type key as first arg)
    Passes event_type and data dict to wrapped function as event_type and data kwargs
    '''
    def wrapper(data, **kwargs):
        try:
            if data["event_type"] not in events_map:
                return JsonResponse(
                    {"error": f"invalid event_type, must be {EVENT_TYPE_OPTIONS}"},
                    status=400
                )
        except KeyError:
            return JsonResponse(
                {"error": "POST body missing required 'event_type' key"},
                status=400
            )
        return func(event_type=data["event_type"], data=data, **kwargs)
    return wrapper


def clean_payload_data(func):
    '''Decorator cleans up whitespace in payload that will be written to database
    Replaces empty strings with None (writes nothing to db instead of empty string)
    Remove leading and trailing whitespace (prevent frontend display issues)
    Must call after requires_json_post (expects dict as data kwarg)
    '''
    def wrapper(data, **kwargs):
        data = {key: (value.strip() if value != '' else None)
                for key, value in data.items()}
        return func(data=data, **kwargs)
    return wrapper


def disable_in_single_user_mode(func):
    '''Decorator prevents accessing view while SINGLE_USER_MODE is enabled.
    Returns permission denied page for GET requests, JSON error for others.
    '''
    def wrapper(request, *args, **kwargs):
        if settings.SINGLE_USER_MODE:
            # User requesting disabled page: render permission denied
            if request.method == "GET":
                return render_permission_denied_page(
                    request,
                    'User accounts are disabled'
                )
            # User POSTing to disabled endpoint: return error response
            return JsonResponse(
                {"error": "user accounts are disabled"},
                status=400
            )
        return func(request, *args, **kwargs)
    return wrapper
