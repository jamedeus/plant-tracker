'''Django database models'''

from typing import TYPE_CHECKING

from django.db import models
from django.conf import settings
from django.core.cache import cache
from django.db import IntegrityError
from django.core.validators import MaxValueValidator, MinValueValidator

if TYPE_CHECKING:  # pragma: no cover
    from .group import Group
    from .photo import Photo
    from .events import DivisionEvent


def get_unnamed_plants(user):
    '''Takes user, returns list of primary_keys for all Plants owned by user
    with no name or species (cached 10 minutes or until plant model changed).
    Uses list instead of QuerySet to avoid serialization overhead.
    '''
    unnamed_plants = cache.get(f'unnamed_plants_{user.pk}')
    if not unnamed_plants:
        unnamed_plants = list(Plant.objects.filter(
            name__isnull=True,
            species__isnull=True,
            user=user
        ).order_by(
            'created'
        ).values_list(
            'id',
            flat=True
        ))
        cache.set(f'unnamed_plants_{user.pk}', unnamed_plants, 600)
    return unnamed_plants


def get_plant_options(user):
    '''Takes user, returns dict with all of user's plants with no group (uuids
    as keys, details dicts as values). Populates options in add plants modal on
    manage_group page. Cached until Plant model changes (see hooks in tasks.py).
    '''
    plant_options = cache.get(f'plant_options_{user.pk}')
    if not plant_options:
        plant_options = {
            str(plant.uuid): plant.get_details()
            for plant in Plant.objects.filter(user=user, group=None)
        }
        cache.set(f'plant_options_{user.pk}', plant_options, None)
    return plant_options


def get_plant_species_options():
    '''Returns a list of species for every Plant in database (no duplicates).
    List is cached for up to 10 minutes, or until Plant model changed.
    Used to populate species suggestions on plant registration form.
    '''
    species_options = cache.get('species_options')
    if not species_options:
        species = Plant.objects.all().values_list('species', flat=True)
        species_options = list(set(i for i in species if i is not None))
        cache.set('species_options', species_options, 600)
    return species_options


class Plant(models.Model):
    '''Tracks an individual plant, created by scanning QR code.
    Stores optional description params added during registration.
    Receives database relations to all WaterEvent, FertilizeEvent, PruneEvent,
    RepotEvent, Photo, and NoteEvent instances associated with Plant.
    '''

    # User who registered the plant
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        blank=False,
        null=False
    )

    # UUID of QR code attached to plant
    uuid = models.UUIDField(unique=True)

    # Description fields are optional, if blank user will just see "Unnamed plant"
    name = models.CharField(max_length=50, blank=True, null=True)
    species = models.CharField(max_length=50, blank=True, null=True)
    description = models.CharField(max_length=500, blank=True, null=True)

    # Store timestamp when created (not editable)
    created = models.DateTimeField(auto_now_add=True)

    # Optional relation to parent Plant that this Plant was divided from (adds
    # link back to parent plant at bottom of timeline)
    divided_from = models.ForeignKey(
        'Plant',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='children'
    )
    divided_from_event = models.ForeignKey(
        'DivisionEvent',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_plants'
    )

    # Removes from overview page if True
    archived = models.BooleanField(default=False)

    # Accept pot sizes between 1 inch and 3 feet (optional)
    pot_size = models.PositiveIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(36)],
        blank=True,
        null=True
    )

    # Optional relation to manage multiple plants in the same group
    group = models.ForeignKey(
        'Group',
        on_delete=models.SET_NULL,
        blank=True,
        null=True
    )

    # Optional relation to set photo used for overview page thumbnail
    # If not set the most recent photo of this plant will be used
    # No related_name (redundant, Photo already has reverse relation)
    default_photo = models.OneToOneField(
        'Photo',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='+'
    )

    def __str__(self):
        return f"{self.get_display_name()} ({self.uuid})"

    def get_display_name(self):
        '''Returns frontend display string determined from attributes.
        If name attribute is set returns name attribute.
        If species attribute is set returns "Unnamed {species}".
        If neither attribute set returns "Unnamed plant {index}".
        '''
        if self.name:
            return self.name
        if self.species:
            return f'Unnamed {self.species}'

        # If no name or species return string with unnamed plant index
        unnamed_plants = get_unnamed_plants(self.user)
        return f'Unnamed plant {unnamed_plants.index(self.id) + 1}'

    def get_photos(self):
        '''Returns list of dicts containing photo and thumbnail URLs, creation
        timestamps, and database keys of each photo associated with this plant.
        '''
        return {
            photo.pk: photo.get_details()
            for photo in self.photo_set.all()
        }

    def get_details(self):
        '''Returns dict containing all plant attributes and last_watered,
        last_fertilized timestamps. Used as state for frontend components.
        '''
        return {
            'name': self.name,
            'display_name': self.get_display_name(),
            'uuid': str(self.uuid),
            'archived': self.archived,
            'created': self.created.isoformat(),
            'species': self.species,
            'description': self.description,
            'pot_size': self.pot_size,
            'last_watered': self.last_watered(),
            'last_fertilized': self.last_fertilized(),
            'thumbnail': self.get_default_photo_details()['thumbnail'],
            'group': self.get_group_details()
        }

    def get_group_details(self):
        '''Returns dict with group name and uuid, or None if not in group.'''
        if self.group:
            return {
                'name': self.group.get_display_name(),
                'uuid': str(self.group.uuid)
            }
        return None

    def get_default_photo_details(self):
        '''Returns dict containing set key (True if default photo set, False if
        not set) and details of default photo (or most-recent if not set).
        '''
        if self.default_photo:
            return dict(
                {'set': True},
                **self.default_photo.get_details()
            )
        try:
            return dict(
                {'set': False},
                **self.photo_set.all().order_by('-timestamp')[0].get_details()
            )
        except IndexError:
            return {
                'set': False,
                'timestamp': None,
                'image': None,
                'thumbnail': None,
                'preview': None,
                'key': None
            }

    def get_parent_plant_details(self):
        '''Returns dict with parent plant name, uuid, and division timestamp if
        plant was divided from another plant, or None if no parent plant.
        '''
        return {
            'name': self.divided_from.get_display_name(),
            'uuid': str(self.divided_from.uuid),
            'timestamp': self.divided_from_event.timestamp.isoformat()
        } if self.divided_from else None

    def get_division_event_details(self):
        '''Returns nested dict with DivisionEvent timestamps as keys, list as
        value containing dicts with each child plant's name and uuid.
        '''
        return {
            event.timestamp.isoformat(): [
                {'name': child.get_display_name(), 'uuid': str(child.uuid)}
                for child in event.created_plants.all()
            ]
            for event in self.divisionevent_set.all()
        }

    def _get_most_recent_timestamp(self, queryset):
        '''Takes QuerySet containing events, returns timestamp string of
        most-recent event (or None if queryset empty).
        '''
        last_event = queryset.order_by('timestamp').last()
        if last_event:
            return last_event.timestamp.isoformat()
        return None

    def last_watered(self):
        '''Returns timestamp string of last WaterEvent, or None if no events.'''
        return self._get_most_recent_timestamp(self.waterevent_set.all())

    def last_fertilized(self):
        '''Returns timestamp string of last FertilizeEvent, or None if no events.'''
        return self._get_most_recent_timestamp(self.fertilizeevent_set.all())

    def last_pruned(self):
        '''Returns timestamp string of last PruneEvent, or None if no events.'''
        return self._get_most_recent_timestamp(self.pruneevent_set.all())

    def last_repotted(self):
        '''Returns timestamp string of last RepotEvent, or None if no events.'''
        return self._get_most_recent_timestamp(self.repotevent_set.all())

    def _get_all_timestamps(self, queryset):
        '''Takes QuerySet containing events, returns list of timestamp strings
        for every item in queryset sorted from most recent to least recent.
        '''
        return sorted([
            timestamp[0].isoformat()
            for timestamp in queryset.values_list('timestamp')
        ], reverse=True)

    def get_water_timestamps(self):
        '''Returns list of timestamp strings for every WaterEvent sorted from
        most recent to least recent.
        '''
        return self._get_all_timestamps(self.waterevent_set.all())

    def get_fertilize_timestamps(self):
        '''Returns list of timestamp strings for every FertilizeEvent sorted from
        most recent to least recent.
        '''
        return self._get_all_timestamps(self.fertilizeevent_set.all())

    def get_prune_timestamps(self):
        '''Returns list of timestamp strings for every PruneEvent sorted from
        most recent to least recent.
        '''
        return self._get_all_timestamps(self.pruneevent_set.all())

    def get_repot_timestamps(self):
        '''Returns list of timestamp strings for every RepotEvent sorted from
        most recent to least recent.
        '''
        return self._get_all_timestamps(self.repotevent_set.all())

    def save(self, *args, **kwargs):
        # Prevent setting photo of a different plant as default
        if self.default_photo and self.default_photo.plant != self:
            raise ValueError("Default photo is associated with a different plant")
        # Prevent saving Plant with UUID that is already used by Group
        from .group import Group
        if Group.objects.filter(uuid=self.uuid):
            raise IntegrityError("UUID already exists in Group table")
        super().save(*args, **kwargs)

    def _delete_event_queryset(self, events):
        '''Takes an event queryset, deletes all entries with raw SQL method that
        bypasses post_delete signals (avoids running unnecessary state updates).

        Should ONLY be used just before Plant is deleted (otherwise the state
        updates are necessary and bypassing will cause outdated cached states).
        '''
        qs = events.order_by().select_related(None)
        qs._raw_delete(qs.db)

    def delete(self, *args, **kwargs):
        # Delete plant cache (make sure post_delete signals don't update it)
        cache.delete(f'{self.uuid}_state')
        self._delete_event_queryset(self.waterevent_set.all())
        self._delete_event_queryset(self.fertilizeevent_set.all())
        self._delete_event_queryset(self.pruneevent_set.all())
        self._delete_event_queryset(self.repotevent_set.all())
        self._delete_event_queryset(self.noteevent_set.all())
        self._delete_event_queryset(self.photo_set.all())
        super().delete(*args, **kwargs)
