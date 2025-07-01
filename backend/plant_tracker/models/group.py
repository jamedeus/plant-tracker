'''Django database models'''

from typing import TYPE_CHECKING

from django.db import models
from django.conf import settings
from django.utils.functional import cached_property
from django.db.models import Case, When, Value, Count

from .events import WaterEvent, FertilizeEvent
from .annotations import unnamed_index_annotation

if TYPE_CHECKING:  # pragma: no cover
    from .plant import Plant


class GroupQueryset(models.QuerySet):
    '''Custom queryset methods for the Group model.'''

    def with_is_unnamed_annotation(self):
        '''Adds is_unnamed attribute (True if no name or location, default False).'''
        return self.annotate(
            is_unnamed=Case(
                When(name__isnull=True, location__isnull=True, then=Value(True)),
                default=Value(False)
            )
        )

    def with_unnamed_index_annotation(self):
        '''Adds unnamed_index attribute (sequential ints) to items with is_unnamed=True.'''
        return self.annotate(**unnamed_index_annotation())

    def with_group_plant_count_annotation(self):
        '''Adds plant_count attribute (number of plants in group).'''
        return self.annotate(plant_count=Count('plant'))

    def with_overview_annotation(self):
        '''Adds annotations covering everything shown on overview page (unnamed
        index, number of plants in group).
        '''
        return (
            self
                .order_by('created')
                # Label unnamed groups with no location (gets sequential name)
                .with_is_unnamed_annotation()
                # Add unnamed_index (used to build "Unnamed group <index>" names)
                .with_unnamed_index_annotation()
                # Add plant_count (number of plants in group)
                .with_group_plant_count_annotation()
        )

    def with_manage_group_annotation(self):
        '''Adds full annotations for manage_grouo page (avoids seperate queries
        for number of plants in group and user).
        '''
        return self.with_group_plant_count_annotation().select_related('user')

    def get_with_manage_group_annotation(self, uuid):
        '''Takes UUID, returns matching Group with full manage_group annotations.'''
        return self.filter(uuid=uuid).with_manage_group_annotation().first()


class Group(models.Model):
    '''Tracks a group containing multiple plants, created by scanning QR code.
    Provides methods to water or fertilize all plants within group.
    '''

    objects = GroupQueryset.as_manager()

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

    @cached_property
    def display_name(self):
        '''Cached self.get_display_name return value (avoid duplicate queries).'''
        return self.get_display_name()

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
            'display_name': self.display_name,
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
