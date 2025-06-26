'''Django database models'''

from typing import TYPE_CHECKING

from django.db import models
from django.conf import settings
from django.core.cache import cache
from django.db import IntegrityError
from django.db.models.functions import RowNumber
from django.db.models import F, Case, When, Value, Count, Window

from .events import WaterEvent, FertilizeEvent

if TYPE_CHECKING:  # pragma: no cover
    from .plant import Plant


def group_is_unnamed_annotation():
    '''Adds is_unnamed attribute (True if no name or location, default False).'''
    return {'is_unnamed': Case(
        When(name__isnull=True, location__isnull=True, then=Value(True)),
        default=Value(False)
    )}


def unnamed_index_annotation():
    '''Adds unnamed_index attribute (sequential ints) to items with is_unnamed=True.'''
    return {'unnamed_index': Window(
        expression=RowNumber(),
        partition_by=[F('is_unnamed')],
        order_by=F('created').asc(),
    )}


def group_plant_count_annotation():
    '''Adds plant_count attribute (number of plants in group).'''
    return {'plant_count': Count('plant')}


class GroupManager(models.Manager):
    def with_overview_annotation(self, user, filters={}):
        '''Takes user, returns all Groups owned by user with annotations that
        cover everything shown on overview page to prevent multiple queries
        (unnamed index, number of plants in group).

        Additional filters can be applied to the queryset by passing the filters
        argument (dict with attribute name keys, attribute value values). For
        example, use `filters={'archived': True}` to get all archived groups.
        '''
        return (
            self
                .filter(user=user, **filters)
                .order_by('created')
                # Label unnamed groups with no location (gets sequential name)
                .annotate(**group_is_unnamed_annotation())
                # Add unnamed_index (used to build "Unnamed group <index>" names)
                .annotate(**unnamed_index_annotation())
                # Add plant_count (number of plants in group)
                .annotate(**group_plant_count_annotation())
        )


class Group(models.Model):
    '''Tracks a group containing multiple plants, created by scanning QR code.
    Provides methods to water or fertilize all plants within group.
    '''

    objects = GroupManager()

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
