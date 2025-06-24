'''Django database models'''

from typing import TYPE_CHECKING

from django.db import models
from django.core.validators import MaxValueValidator, MinValueValidator

if TYPE_CHECKING:  # pragma: no cover
    from .plant import Plant

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

    # Optional old and new pot sizes
    old_pot_size = models.PositiveIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(36)],
        blank=True,
        null=True
    )
    new_pot_size = models.PositiveIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(36)],
        blank=True,
        null=True
    )

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
