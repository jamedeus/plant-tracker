'''Django database models'''

from typing import TYPE_CHECKING

from django.db import models
from django.conf import settings
from django.core.cache import cache
from django.db import IntegrityError

from .events import WaterEvent, FertilizeEvent

if TYPE_CHECKING:  # pragma: no cover
    from .plant import Plant


def get_unnamed_groups(user):
    '''Takes user, returns list of primary_keys for all Groups owned by user
    with no name or location (cached 10 minutes or until group model changed).
    Uses list instead of QuerySet to avoid serialization overhead.
    '''
    unnamed_groups = cache.get(f'unnamed_groups_{user.pk}')
    if not unnamed_groups:
        unnamed_groups = list(Group.objects.filter(
            name__isnull=True,
            location__isnull=True,
            user=user
        ).order_by(
            'created'
        ).values_list(
            'id',
            flat=True
        ))
        # cache.set(f'unnamed_groups_{user.pk}', unnamed_groups, 600)
    return unnamed_groups


def get_group_options(user):
    '''Takes user, returns dict with all of user's groups (uuids as keys,
    details) dicts as values). Populates options in add to group modal on
    manage_plant page. Cached until Group model changes (see hooks in tasks.py).
    '''
    group_options = cache.get(f'group_options_{user.pk}')
    if not group_options:
        group_options = {
            str(group.uuid): group.get_details()
            for group in Group.objects.filter(user=user)
        }
        # cache.set(f'group_options_{user.pk}', group_options, None)
    return group_options


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

        # Get index from cached unnamed_groups list if no annotation
        unnamed_groups = get_unnamed_groups(self.user)
        return f'Unnamed group {unnamed_groups.index(self.id) + 1}'

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
            'plants': len(self.plant_set.all())
        }

    def get_plant_details(self):
        '''Returns dict with uuid of each plant in group as keys, plant details
        dicts as values (see Plant.get_details for dict parameters).
        '''
        return {
            str(plant.uuid): plant.get_details()
            for plant in self.plant_set.all()
        }

    def save(self, *args, **kwargs):
        # Prevent saving Group with UUID that is already used by Plant
        from .plant import Plant
        if Plant.objects.filter(uuid=self.uuid):
            raise IntegrityError("UUID already exists in Plant table")
        super().save(*args, **kwargs)
