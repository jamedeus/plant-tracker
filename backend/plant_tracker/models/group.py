'''Django database models'''

from typing import TYPE_CHECKING

from django.db import models
from django.conf import settings
from django.core.cache import cache
from django.db import IntegrityError

from .events import WaterEvent, FertilizeEvent

if TYPE_CHECKING:  # pragma: no cover
    from .plant import Plant


class Group(models.Model):
    '''Tracks a group containing multiple plants, created by scanning QR code.
    Provides methods to water or fertilize all plants within group.
    '''

    # User who registered the group
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        blank=False,
        null=False
    )

    # UUID of QR code attached to group
    uuid = models.UUIDField(unique=True)

    # Description fields are optional, if blank user will just see "Unnamed group"
    name = models.CharField(max_length=50, blank=True, null=True)
    location = models.CharField(max_length=50, blank=True, null=True)
    description = models.CharField(max_length=500, blank=True, null=True)

    # Store timestamp when created (not editable)
    created = models.DateTimeField(auto_now_add=True)

    # Removes from overview page if True
    archived = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.get_display_name()} ({self.uuid})"

    def get_display_name(self):
        '''Returns frontend display string determined from attributes.
        If name attribute is set returns name attribute.
        If location attribute is set returns "{location} group".
        If neither attribute set returns "Unnamed group {index}".
        '''
        if self.name:
            return self.name
        if self.location:
            return f'{self.location} group'

        # If no name or location use annotation if present
        if hasattr(self, 'unnamed_index'):
            return f'Unnamed group {self.unnamed_index}'

        # Query database for unnamed index if annotation not present
        unnamed_index = Group.objects.filter(
            user=self.user,
            name__isnull=True,
            location__isnull=True,
            created__lte=self.created
        ).count()
        return f'Unnamed group {unnamed_index}'

    def water_all(self, timestamp):
        '''Takes datetime instance, creates WaterEvent for each Plant in Group.'''
        for plant in self.plant_set.all():
            WaterEvent.objects.create(plant=plant, timestamp=timestamp)

    def fertilize_all(self, timestamp):
        '''Takes datetime instance, creates FertilizeEvent for each Plant in Group.'''
        for plant in self.plant_set.all():
            FertilizeEvent.objects.create(plant=plant, timestamp=timestamp)

    def get_plant_uuids(self):
        '''Returns a list of UUID strings for all Plants in Group.'''
        return [str(uuid) for uuid in self.plant_set.all().values_list('uuid', flat=True)]

    def get_details(self):
        '''Returns dict containing all group attributes and number of plants.'''
        return {
            'name': self.name,
            'display_name': self.get_display_name(),
            'uuid': str(self.uuid),
            'archived': self.archived,
            'created': self.created.isoformat(),
            'location': self.location,
            'description': self.description,
            'plants': self.get_number_of_plants()
        }

    def get_number_of_plants(self):
        '''Returns number of plants with reverse relation to group.'''
        # Use annotation if present
        if hasattr(self, 'plant_count'):
            return self.plant_count
        # Query from database if no annotation
        return len(self.plant_set.all())

    def save(self, *args, **kwargs):
        # Prevent saving Group with UUID that is already used by Plant
        from .plant import Plant
        if Plant.objects.filter(uuid=self.uuid):
            raise IntegrityError("UUID already exists in Plant table")
        super().save(*args, **kwargs)
