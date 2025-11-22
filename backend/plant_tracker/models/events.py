'''Django database models'''

from itertools import chain
from zoneinfo import ZoneInfo
from datetime import timedelta
from typing import TYPE_CHECKING

from django.db import models
from django.utils import timezone

from .pot_size_field import PotSizeField

if TYPE_CHECKING:  # pragma: no cover
    from .plant import Plant
    from .group import Group

# Timestamp format used to print DateTimeFields, parse exif into datetime, etc.
TIME_FORMAT = '%Y:%m:%d %H:%M:%S'


class Event(models.Model):
    '''Abstract base class for all plant events.'''
    plant = models.ForeignKey('Plant', on_delete=models.CASCADE)
    timestamp = models.DateTimeField()

    class Meta:
        abstract = True

    def __str__(self):
        name = self.plant.get_display_name()
        timestamp = self.timestamp.strftime(TIME_FORMAT)
        return f"{name} - {timestamp}"


class WaterEvent(Event):
    '''Records timestamp when a Plant entry was watered.'''

    class Meta:
        unique_together = ('plant', 'timestamp')
        ordering = ['-timestamp']


class FertilizeEvent(Event):
    '''Records timestamp when a Plant entry was fertilized.'''

    class Meta:
        unique_together = ('plant', 'timestamp')
        ordering = ['-timestamp']


class PruneEvent(Event):
    '''Records timestamp when a Plant entry was pruned.'''

    class Meta:
        unique_together = ('plant', 'timestamp')
        ordering = ['-timestamp']


class RepotEvent(Event):
    '''Records timestamp when a Plant entry was repotted.'''

    class Meta:
        unique_together = ('plant', 'timestamp')
        ordering = ['-timestamp']


class NoteEvent(Event):
    '''Records timestamp and user-entered text about a specific Plant.'''
    text = models.CharField(max_length=500)

    class Meta:
        unique_together = ('plant', 'timestamp')


class DivisionEvent(Event):
    '''Records timestamp when a Plant entry was divided.
    The inherited plant attribute is a reverse relation to the parent plant.
    All child plants have reverse relation back to DivisionEvent with related
    name "created_plants".
    '''

    class Meta:
        unique_together = ('plant', 'timestamp')


class DetailsChangedEvent(Event):
    '''Records plant details before and after edit.'''

    name_before = models.CharField(max_length=50, blank=True, null=True)
    name_after = models.CharField(max_length=50, blank=True, null=True)

    species_before = models.CharField(max_length=50, blank=True, null=True)
    species_after = models.CharField(max_length=50, blank=True, null=True)

    description_before = models.CharField(max_length=500, blank=True, null=True)
    description_after = models.CharField(max_length=500, blank=True, null=True)

    pot_size_before = PotSizeField()
    pot_size_after = PotSizeField()

    group_before = models.ForeignKey(
        'Group',
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='details_changed_before_events'
    )
    group_after = models.ForeignKey(
        'Group',
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='details_changed_after_events'
    )

    archived_before = models.BooleanField(default=False)
    archived_after = models.BooleanField(default=False)

    class Meta:
        unique_together = ('plant', 'timestamp')
        ordering = ['-timestamp']

    def get_details(self):
        '''Returns a dict containing all field names and values.'''
        return {
            'name_before': self.name_before,
            'name_after': self.name_after,
            'species_before': self.species_before,
            'species_after': self.species_after,
            'description_before': self.description_before,
            'description_after': self.description_after,
            'pot_size_before': self.pot_size_before,
            'pot_size_after': self.pot_size_after,
            'group_before': {
                'name': self.group_before.display_name,
                'uuid': str(self.group_before.uuid)
            } if self.group_before else None,
            'group_after': {
                'name': self.group_after.display_name,
                'uuid': str(self.group_after.uuid)
            } if self.group_after else None,
            'archived_before': self.archived_before,
            'archived_after': self.archived_after
        }


def _get_user_day_utc_range(timestamp=None, user_tz='Etc/UTC'):
    '''Takes timestamp (default = now) and user timezone string (default = UTC).
    Converts timestamp to user's timezone and returns start/end of day in UTC.
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
    return user_day_utc_start, user_day_utc_end


def _build_details_changed_event(plant, timestamp=None):
    '''Takes Plant entry and optional timestamp (current time if not given).
    Returns unsaved DetailsChangedEvent with current plant details in _before
    and _after fields (update _after fields before saving).
    '''
    return DetailsChangedEvent(
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
        group_after=plant.group if plant.group else None,
        archived_before=plant.archived,
        archived_after=plant.archived
    )


def log_changed_details(plants, changes, timestamp=None, user_tz='Etc/UTC'):
    '''Takes list of Plants, dict with attributes to change and new values,
    optional timestamp (default = now), optional user timezone (default = UTC).

    Finds existing DetailsChangedEvent for each plant on same day as timestamp
    in user_tz (creates new events for plants that did not have one) and updates
    all requested _after attributes to new values. Makes a maximum of 3 queries.

    Returns list of all DetailsChangedEvents so caller can access get_details.

    Always call this before changing the Plant instance attributes (if no event
    exists it will be created with current Plant values in _before attributes).
    '''

    # Don't query database if no plants given
    if not plants:
        return []

    # Get start and end of day that contains timestamp in user's timezone
    user_day_utc_start, user_day_utc_end = _get_user_day_utc_range(
        timestamp,
        user_tz
    )

    # Get list of UUIDs + dict with UUID keys, plant instance values
    plant_ids = [str(plant.uuid) for plant in plants]
    plants_by_uuid = {str(plant.uuid): plant for plant in plants}

    # Find all existing DetailsChangedEvents
    existing_change_events = (
        DetailsChangedEvent.objects.filter(
            plant__uuid__in=plant_ids,
            timestamp__range=(user_day_utc_start, user_day_utc_end)
        ).select_related('plant')
    )
    # Get list of plant UUIDs that had an existing DetailsChangedEvent
    existing_ids = [str(event.plant.uuid) for event in existing_change_events]

    # Create new DetailsChangedEvents (unsaved) for all other plants
    new_change_events = [
        _build_details_changed_event(plants_by_uuid[plant_id], timestamp)
        for plant_id in plant_ids
        if plant_id not in existing_ids
    ]

    # Update requested keys for all new and existing DetailsChangedEvents
    for event in chain(existing_change_events, new_change_events):
        for key, value in changes.items():
            setattr(event, f'{key}_after', value)

    # Write changes to database in 2 queries (all existing, all new)
    if existing_change_events:
        DetailsChangedEvent.objects.bulk_update(
            existing_change_events,
            [f'{key}_after' for key in changes.keys()]
        )
    if new_change_events:
        DetailsChangedEvent.objects.bulk_create(new_change_events)

    # Return list of all DetailsChangedEvents (new and existing)
    new_change_events.extend(existing_change_events)
    return new_change_events
