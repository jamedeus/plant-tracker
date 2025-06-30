'''Django database models'''

from typing import TYPE_CHECKING

from django.db import models
from django.conf import settings
from django.core.cache import cache
from django.db import IntegrityError, transaction
from django.utils.functional import cached_property
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db.models.functions import JSONObject, Cast
from django.contrib.postgres.expressions import ArraySubquery
from django.db.models import F, Case, When, Value, Subquery, OuterRef, Exists, JSONField

from .annotations import unnamed_index_annotation

if TYPE_CHECKING:  # pragma: no cover
    from .group import Group
    from .photo import Photo
    from .events import DivisionEvent


class PlantQueryset(models.QuerySet):
    '''Custom queryset methods for the Plant model.'''

    def with_is_unnamed_annotation(self):
        '''Adds is_unnamed attribute (True if no name or species, default False).'''
        return self.annotate(
            is_unnamed=Case(
                When(name__isnull=True, species__isnull=True, then=Value(True)),
                default=Value(False)
            )
        )

    def with_unnamed_index_annotation(self):
        '''Adds unnamed_index attribute (sequential ints) to items with is_unnamed=True.'''
        return self.annotate(**unnamed_index_annotation())


    def with_last_watered_time_annotation(self):
        '''Adds last_watered_time attribute (most-recent WaterEvent timestamp).'''
        from . import WaterEvent
        return self.annotate(
            last_watered_time=Subquery(
                WaterEvent.objects
                    .filter(plant_id=OuterRef("pk"))
                    .values("timestamp")[:1]
            )
        )

    def with_last_fertilized_time_annotation(self):
        '''Adds last_fertilized_time attribute (most-recent WaterEvent timestamp).'''
        from . import FertilizeEvent
        return self.annotate(
            last_fertilized_time=Subquery(
                FertilizeEvent.objects
                    .filter(plant_id=OuterRef("pk"))
                    .values("timestamp")[:1]
            )
        )

    def with_last_photo_thumbnail_annotation(self):
        '''Adds last_photo_thumbnail attribute with name of most-recent Photo entry.'''
        from . import Photo
        return self.annotate(
            last_photo_thumbnail=Subquery(
            Photo.objects
                .filter(plant_id=OuterRef("pk"))
                .order_by("-timestamp")
                .values("thumbnail")[:1]
            )
        )

    def with_last_photo_details_annotation(self):
        '''Adds last_photo_details attribute with dict containing all relevant
        attributes of most-recent Photo entry.
        '''
        from . import Photo
        return self.annotate(
            last_photo_details=Subquery(
            Photo.objects
                .filter(plant_id=OuterRef("pk"))
                .order_by("-timestamp")
                .annotate(
                    details=JSONObject(
                        key=F("pk"),
                        photo=F("photo"),
                        thumbnail=F("thumbnail"),
                        preview=F("preview"),
                        timestamp=F("timestamp"),
                    )
                )
                .values("details")[:1],
                output_field=JSONField()
            )
        )

    def with_uuid_as_string_annotation(self):
        '''Adds uuid_str attribute containing uuid field cast to string.'''
        return self.annotate(uuid_str=Cast("uuid", models.CharField()))

    def with_overview_annotation(self):
        '''Adds annotations covering everything shown on overview page
        (last_watered, last_fertilized, photo thumbnail, unnamed index, etc).
        '''
        return (
            self
                # Consistent order so unnamed plant index doesn't shift
                .order_by('created')
                # Label unnamed plants with no species (gets sequential name)
                .with_is_unnamed_annotation()
                # Add unnamed_index (used to build "Unnamed plant <index>" names)
                .with_unnamed_index_annotation()
                # Add last_watered_time
                .with_last_watered_time_annotation()
                # Add last_fertilized_time
                .with_last_fertilized_time_annotation()
                # Add last_photo_details (used as default photo if not set)
                .with_last_photo_thumbnail_annotation()
                # Include default_photo if set (avoid extra query for thumbnail)
                .select_related('default_photo')
        )

    def with_manage_plant_annotation(self):
        '''Adds full annotations for manage_plant page (avoids seperate queries
        for events, photos, etc).
        '''
        from . import WaterEvent, FertilizeEvent, PruneEvent, RepotEvent, DivisionEvent
        return (
            self
                # Add last_watered_time
                .with_last_watered_time_annotation()
                # Add last_fertilized_time
                .with_last_fertilized_time_annotation()
                # Add last_photo_details (used as default photo if not set)
                .with_last_photo_thumbnail_annotation()
                # Include default_photo if set (avoid extra query for thumbnail)
                .select_related('default_photo')
                # Include Group entry if plant in a group
                .select_related('group')
                # Include parent plant + division event if plant was divided
                .select_related('divided_from', 'divided_from_event')
                # Add <event_type>_timetamps attributes containing lists of
                # event timestamps (sorted chronologically at database level)
                .annotate(
                    water_timestamps=ArraySubquery(
                        WaterEvent.objects
                            .filter(plant_id=OuterRef('pk'))
                            .values_list('timestamp', flat=True)
                    ),
                    fertilize_timestamps=ArraySubquery(
                        FertilizeEvent.objects
                            .filter(plant_id=OuterRef('pk'))
                            .values_list('timestamp', flat=True)
                    ),
                    prune_timestamps=ArraySubquery(
                        PruneEvent.objects
                            .filter(plant_id=OuterRef('pk'))
                            .values_list('timestamp', flat=True)
                    ),
                    repot_timestamps=ArraySubquery(
                        RepotEvent.objects
                            .filter(plant_id=OuterRef('pk'))
                            .values_list('timestamp', flat=True)
                    ),
                )
                # Annotate whether DivisionEvents exist (skips extra query if not)
                .annotate(
                    has_divisions=Exists(
                        DivisionEvent.objects.filter(plant=OuterRef('pk'))
                    )
                )
        )

    def get_with_manage_plant_annotation(self, uuid):
        '''Takes UUID, returns matching Plant with full manage_plant annotations.'''
        return self.filter(uuid=uuid).with_manage_plant_annotation().first()


class Plant(models.Model):
    '''Tracks an individual plant, created by scanning QR code.
    Stores optional description params added during registration.
    Receives database relations to all WaterEvent, FertilizeEvent, PruneEvent,
    RepotEvent, Photo, and NoteEvent instances associated with Plant.
    '''

    objects = PlantQueryset.as_manager()

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

        # If no name or species use annotation if present
        if hasattr(self, 'unnamed_index'):
            return f'Unnamed plant {self.unnamed_index}'

        # Query database for unnamed index if annotation not present
        unnamed_index = Plant.objects.filter(
            user=self.user,
            name__isnull=True,
            species__isnull=True,
            created__lte=self.created
        ).count()
        return f'Unnamed plant {unnamed_index}'

    @cached_property
    def display_name(self):
        '''Cached self.get_display_name return value (avoid duplicate queries).'''
        return self.get_display_name()

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
            'display_name': self.display_name,
            'uuid': str(self.uuid),
            'archived': self.archived,
            'created': self.created.isoformat(),
            'species': self.species,
            'description': self.description,
            'pot_size': self.pot_size,
            'last_watered': self.last_watered(),
            'last_fertilized': self.last_fertilized(),
            'thumbnail': self.get_thumbnail_url(),
            'group': self.get_group_details()
        }

    def get_group_details(self):
        '''Returns dict with group name and uuid, or None if not in group.'''
        if self.group:
            return {
                'name': self.group.display_name,
                'uuid': str(self.group.uuid)
            }
        return None

    def get_thumbnail_url(self):
        '''Returns default_photo thumbnail URL (or most-recent photo if not set).'''
        if self.default_photo:
            return self.default_photo.get_thumbnail_url()

        # If default photo not set: use annotation if present
        if hasattr(self, 'last_photo_thumbnail'):
            if self.last_photo_thumbnail:
                return f'{settings.MEDIA_URL}{self.last_photo_thumbnail}'
            return None

        # Use full last_photo_details annotation if present
        if hasattr(self, 'last_photo_details'):
            return self.default_photo_details['thumbnail']

        # Query from database if neither annotation present
        try:
            last_photo = self.photo_set.all().order_by('-timestamp')[0]
            return last_photo.get_thumbnail_url()
        except IndexError:
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

        # If default photo not set: use annotation if present
        if hasattr(self, 'last_photo_details'):
            if self.last_photo_details:
                return {
                    'set': False,
                    'timestamp': self.last_photo_details['timestamp'],
                    'image': f'{settings.MEDIA_URL}{self.last_photo_details['photo']}',
                    'thumbnail': f'{settings.MEDIA_URL}{self.last_photo_details['thumbnail']}',
                    'preview': f'{settings.MEDIA_URL}{self.last_photo_details['preview']}',
                    'key': self.last_photo_details['key']
                }

        # Query from database if no annotation
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

    @cached_property
    def default_photo_details(self):
        '''Cached self.get_default_photo_details return value (avoid duplicate queries).'''
        return self.get_default_photo_details()

    def get_parent_plant_details(self):
        '''Returns dict with parent plant name, uuid, and division timestamp if
        plant was divided from another plant, or None if no parent plant.
        '''
        return {
            'name': self.divided_from.display_name,
            'uuid': str(self.divided_from.uuid),
            'timestamp': self.divided_from_event.timestamp.isoformat()
        } if self.divided_from else None

    def get_division_event_details(self):
        '''Returns nested dict with DivisionEvent timestamps as keys, list as
        value containing dicts with each child plant's name and uuid.
        '''

        # Skip if annotation says no DivisionEvents
        if hasattr(self, 'has_divisions'):
            if not self.has_divisions:
                return {}

        # Query from database if no annotation
        return {
            event.timestamp.isoformat(): [
                {'name': child.display_name, 'uuid': str(child.uuid)}
                for child in event.created_plants.all()
            ]
            for event in self.divisionevent_set.all()
        }

    def _get_most_recent_timestamp(self, queryset):
        '''Takes QuerySet containing events, returns timestamp string of
        most-recent event (or None if queryset empty).
        '''
        last_event = queryset.first()
        if last_event:
            return last_event.timestamp.isoformat()
        return None

    def last_watered(self):
        '''Returns timestamp string of last WaterEvent, or None if no events.'''

        # Use annotation if present
        if hasattr(self, 'last_watered_time'):
            if self.last_watered_time:
                return self.last_watered_time.isoformat()
            return None

        # Query from database if not present
        return self._get_most_recent_timestamp(self.waterevent_set.all())

    def last_fertilized(self):
        '''Returns timestamp string of last FertilizeEvent, or None if no events.'''

        # Use annotation if present
        if hasattr(self, 'last_fertilized_time'):
            if self.last_fertilized_time:
                return self.last_fertilized_time.isoformat()
            return None

        # Query from database if not present
        return self._get_most_recent_timestamp(self.fertilizeevent_set.all())

    def last_pruned(self):
        '''Returns timestamp string of last PruneEvent, or None if no events.'''
        return self._get_most_recent_timestamp(self.pruneevent_set.all())

    def last_repotted(self):
        '''Returns timestamp string of last RepotEvent, or None if no events.'''
        return self._get_most_recent_timestamp(self.repotevent_set.all())

    def save(self, *args, **kwargs):
        from .group import Group
        if Group.objects.filter(uuid=self.uuid):
            raise IntegrityError("UUID already exists in Group table")
        super().save(*args, **kwargs)
