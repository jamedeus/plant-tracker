'''Django database models'''

from typing import TYPE_CHECKING

from django.db import models

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
