'''Decorators to simplify endpoint error handling and POST body parsing.

Several decorators can be chained to validate that the expected JSON keys are
present, query model entries from the database, and pass models to the wrapped
endpoint function as arguments. An error response is returned to the client
from the decorator if any of these steps fail, simplifying endpoint functions.
'''

import json
from zoneinfo import ZoneInfo
from functools import wraps, cache
from datetime import datetime, timedelta

from django.conf import settings
from django.utils import timezone
from django.db.models import Value
from django.shortcuts import render
from django.contrib.auth import get_user_model
from django.http import JsonResponse, HttpResponseRedirect
from django.core.exceptions import ValidationError

from .models import (
    Group,
    Plant,
    WaterEvent,
    FertilizeEvent,
    PruneEvent,
    RepotEvent,
    DetailsChangedEvent
)


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


def find_model_type(uuid):
    '''Takes uuid, queries both Plant and Group models. Returns "plant" if
    matches a Plant entry, "group" if matches a Group entry, or None if neither.
    '''
    plant_queryset = (
        Plant.objects
        .filter(uuid=uuid)
        .annotate(model_type=Value('plant'))
        .values('model_type')[:1]
    )
    group_queryset = (
        Group.objects
        .filter(uuid=uuid)
        .annotate(model_type=Value('group'))
        .values('model_type')[:1]
    )
    try:
        return plant_queryset.union(group_queryset)[0]['model_type']
    except IndexError:
        return None


@cache
def get_default_user():
    '''Returns default user (owns all models when SINGLE_USER_MODE enabled).'''
    return get_user_model().objects.get(username=settings.DEFAULT_USERNAME)


def get_user_token(func):
    '''Passes User model object to wrapped function as user kwarg.
    If SINGLE_USER_MODE enabled returns default user without checking request.
    If user accounts enabled reads user from requests. If not logged in returns
    401 error for POST and GETs that expect JSON, otherwise redirects to login.
    '''
    @wraps(func)
    def wrapper(request, **kwargs):
        # Return default user without checking auth if SINGLE_USER_MODE enabled
        if settings.SINGLE_USER_MODE:
            return func(request, user=get_default_user(), **kwargs)
        # User not signed in
        if not request.user.is_authenticated:
            # Redirect page requests to login with requested URL in querystring
            accept = request.headers.get("Accept", "").lower()
            if request.method != "POST" and "application/json" not in accept:
                return HttpResponseRedirect(f'/accounts/login/?next={request.path}')

            # Return 401 error for POST requests and GETs that expect JSON
            # (frontend SPA redirects to login page and sets querystring)
            return JsonResponse({'error': 'authentication required'}, status=401)
        return func(request, user=request.user, **kwargs)
    return wrapper


def requires_json_post(required_keys=None):
    '''Decorator throws error if request is not POST with JSON body.
    Accepts optional list of required keys, throws error if any are missing.
    Parses JSON from request body and passes to wrapped function as data kwarg.
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


def get_plant_from_post_body(select_related=None, **kwargs):
    '''Decorator looks up plant by UUID, throws error if not found. Optional
    select_related arg can be used to query foreignkey related objects. Passes
    Plant instance and data dict to wrapped function as plant and data kwargs.

    If called after get_user_token throws error if Plant is not owned be user.

    Must call after requires_json_post (expects dict with plant_id key as first arg).
    '''
    def decorator(func):
        @wraps(func)
        def wrapper(data, **kwargs):
            try:
                plant = (
                    Plant.objects
                        .select_related(select_related)
                        .get_by_uuid(data["plant_id"])
                )
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
            if 'user' in kwargs:
                if plant.user_id != kwargs['user'].pk:
                    return JsonResponse(
                        {"error": "plant is owned by a different user"},
                        status=403
                    )
                # Add user to plant (avoids extra query)
                plant.user = kwargs['user']
            return func(plant=plant, data=data, **kwargs)
        return wrapper
    return decorator


def get_group_from_post_body(select_related=None, **kwargs):
    '''Decorator looks up group by UUID, throws error if not found. Optional
    select_related arg can be used to query foreignkey related objects. Passes
    Group instance and data dict to wrapped function as group and data kwargs.

    If called after get_user_token throws error if Group is not owned be user.

    Must call after requires_json_post (expects dict with group_id key as first arg).
    '''
    def decorator(func):
        @wraps(func)
        def wrapper(data, **kwargs):
            try:
                group = (
                    Group.objects
                        .select_related(select_related)
                        .get_by_uuid(data["group_id"])
                )
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
            if 'user' in kwargs:
                if group.user_id != kwargs['user'].pk:
                    return JsonResponse(
                        {"error": "group is owned by a different user"},
                        status=403
                    )
                # Add user to group (avoids extra query)
                group.user = kwargs['user']
            return func(group=group, data=data, **kwargs)
        return wrapper
    return decorator


# Maps instance._meta.model_name strings to model classes
model_type_map = {
    'plant': Plant,
    'group': Group
}


def get_plant_or_group_by_uuid(uuid, annotate=False):
    '''Returns Plant or Group instance matching UUID, or None if neither found.
    Includes overview annotations if optional annotate kwarg is True.
    '''
    model_type = find_model_type(uuid)
    if not model_type:
        return None
    if annotate:
        return model_type_map[model_type].objects.get_with_overview_annotation(uuid)
    return model_type_map[model_type].objects.get_by_uuid(uuid)


def get_qr_instance_from_post_body(annotate=False, **kwargs):
    '''Decorator looks up plant or group by UUID, throws error if neither found.
    Includes overview annotations if optional annotate kwarg is True. Passes
    instance and data dict to wrapped function as instance and data kwargs.

    If called after get_user_token throws error if instance is not owned be user.

    Must call after requires_json_post (expects dict with uuid key as first arg).
    '''
    def decorator(func):
        @wraps(func)
        def wrapper(data, **kwargs):
            try:
                instance = get_plant_or_group_by_uuid(data["uuid"], annotate)
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
            if 'user' in kwargs:
                if instance.user_id != kwargs['user'].pk:
                    return JsonResponse(
                        {"error": "instance is owned by a different user"},
                        status=403
                    )
                # Add user to instance (avoids extra query)
                instance.user = kwargs['user']
            return func(instance=instance, data=data, **kwargs)
        return wrapper
    return decorator


def get_timestamp_from_post_body(func):
    '''Decorator converts timestamp string to Datetime object, throws error if invalid.
    Must call after requires_json_post (expects dict with timestamp key as first arg).
    Passes Datetime object and data dict to wrapped function as timestamp and data kwargs.
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
    '''Decorator verifies event_type from POST body, throws error if missing or invalid.
    Must call after requires_json_post (expects dict with event_type key as first arg).
    Passes event_type and data dict to wrapped function as event_type and data kwargs.
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


def get_or_create_details_changed_event(plant, timestamp=None, user_tz='Etc/UTC'):
    '''Takes plant entry and optional timestamp and user timezone string.
    Looks up DetailsChangedEvent for plant on same day as timestamp in user_tz.
    If not found creates a new event with all plant details in _before fields.
    If timestamp not given uses current day in user_tz (or UTC if not given).
    '''

    # Convert UTC from get_timestamp_from_post_body to user's timezone
    if timestamp:
        timestamp_user_tz = timestamp.astimezone(ZoneInfo(user_tz))
    # If no timestamp: use current day in user's timezone
    else:
        timestamp_user_tz = timezone.now().astimezone(ZoneInfo(user_tz))
    # Convert boundaries of target day in user's timezone to UTC
    user_day_utc_start = timestamp_user_tz.replace(
        hour=0, minute=0, second=0, microsecond=0
    ).astimezone(ZoneInfo("UTC"))
    user_day_utc_end = user_day_utc_start + timedelta(days=1)
    # Find existing event if it exists
    change_event = DetailsChangedEvent.objects.filter(
        plant=plant,
        timestamp__range=(user_day_utc_start, user_day_utc_end)
    ).first()
    # Create new event if not found
    if not change_event:
        # Don't write to database - if wrapped function fails event should
        # not be created. Wrapped function will set _after fields and save.
        change_event = DetailsChangedEvent(
            plant=plant,
            timestamp=timestamp if timestamp else timezone.now(),
            name_before=plant.name,
            name_after=plant.name,
            species_before=plant.species,
            species_after=plant.species,
            description_before=plant.description,
            description_after=plant.description,
            pot_size_before=plant.pot_size,
            pot_size_after=plant.pot_size,
            group_before=plant.group if plant.group else None,
            group_after=plant.group if plant.group else None
        )
    return change_event


def get_details_changed_event_from_post_body(func):
    '''Decorator looks up existing DetailsChangedEvent for plant_id in request.
    If not found creates a new event with all plant details in _before fields.
    Passes DetailsChangedEvent to wrapped function as change_event kwarg.

    Must call after get_plant_from_post_body (expects plant kwarg).
    If called after get_timestamp_from_post_body looks for DetailsChangedEvent
    on same day as timestamp in user timezone (otherwise uses current day).
    '''
    def wrapper(request, plant, timestamp=None, **kwargs):
        # Read user timezone from request header (default to UTC if missing)
        user_tz = request.headers.get("User-Timezone", "Etc/UTC")
        change_event = get_or_create_details_changed_event(plant, timestamp, user_tz)
        return func(plant=plant, change_event=change_event, timestamp=timestamp, **kwargs)
    return wrapper


def clean_payload_data(func):
    '''Decorator cleans up whitespace in payload that will be written to database.
    Replaces empty strings with None (writes nothing to db instead of empty string).
    Remove leading and trailing whitespace (prevent frontend display issues).
    Must call after requires_json_post (expects dict as data kwarg).
    '''
    def wrapper(data, **kwargs):
        data = {
            key: ((value.strip() or None) if isinstance(value, str) else value)
            for key, value in data.items()
        }
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
                return render(
                    request,
                    'plant_tracker/permission_denied.html',
                    { 'error': 'User accounts are disabled' }
                )
            # User POSTing to disabled endpoint: return error response
            return JsonResponse(
                {"error": "user accounts are disabled"},
                status=403
            )
        return func(request, *args, **kwargs)
    return wrapper
