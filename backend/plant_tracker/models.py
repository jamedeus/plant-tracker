'''Django database models'''

from io import BytesIO
from datetime import datetime, timezone

import piexif
from PIL import Image, ImageOps
from pillow_heif import register_heif_opener
from django.db import models
from django.conf import settings
from django.core.cache import cache
from django.db import IntegrityError
from django.dispatch import receiver
from django.utils import timezone as django_timezone
from django.db.models.signals import post_save, post_delete
from django.core.files.uploadedfile import InMemoryUploadedFile
from django.core.validators import MaxValueValidator, MinValueValidator

from .disable_for_loaddata import disable_for_loaddata

# Timestamp format used to print DateTimeFields, parse exif into datetime, etc.
TIME_FORMAT = '%Y:%m:%d %H:%M:%S'

# HEIC image support
register_heif_opener()


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
        cache.set(f'unnamed_groups_{user.pk}', unnamed_groups, 600)
    return unnamed_groups


def get_plant_options(user):
    '''Takes user, returns list of dicts with details for all of user's plants
    with no group. Populates options in add plants modal on manage_group page.
    List is cached until Plant model changes (detected by hooks in tasks.py).
    '''
    plant_options = cache.get(f'plant_options_{user.pk}')
    if not plant_options:
        plant_options = [
            plant.get_details()
            for plant in Plant.objects.filter(user=user, group=None)
        ]
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


def get_group_options(user):
    '''Takes user, returns list of dicts with details for all groups owner by user.
    List is cached until Group model changes (detected by hooks in tasks.py).
    Used to populate options in add group modal on manage_plant page.
    '''
    group_options = cache.get(f'group_options_{user.pk}')
    if not group_options:
        group_options = [
            group.get_details() for group in Group.objects.filter(user=user)
        ]
        cache.set(f'group_options_{user.pk}', group_options, None)
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

        # If no name or location return string with unnamed group index
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
        '''Returns list of dicts with parameters for each Plant in Group.
        See Plant.get_details for dict parameters.
        '''
        return [plant.get_details() for plant in self.plant_set.all()]

    def save(self, *args, **kwargs):
        # Prevent saving Group with UUID that is already used by Plant
        if Plant.objects.filter(uuid=self.uuid):
            raise IntegrityError("UUID already exists in Plant table")
        super().save(*args, **kwargs)


@receiver(post_save, sender=Group)
@receiver(post_delete, sender=Group)
@disable_for_loaddata
def clear_cached_group_lists(instance, **kwargs):
    '''Clear cached unnamed_groups list when a Group is saved or deleted (will
    be generated and cached next time needed).

    The group_options list is updated automatically by hook in tasks.py.
    '''
    cache.delete(f'unnamed_groups_{instance.user.pk}')


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
    group = models.ForeignKey(Group, on_delete=models.SET_NULL, blank=True, null=True)

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

    # Store the URLs of the current thumbnail and preview
    # These update automatically if a new Photo is uploaded (see Photo.save)
    thumbnail_url = models.URLField(blank=True, null=True)
    preview_url = models.URLField(blank=True, null=True)

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
        return [
            photo.get_details()
            for photo in self.photo_set.all().order_by('-timestamp')
        ]

    def update_thumbnail_url(self):
        '''Updates thumbnail_url and preview_url fields if they are outdated.
        Called when a new Photo associated with this Plant is saved.
        '''
        default_photo = self.get_default_photo_details()
        if default_photo and default_photo['thumbnail'] != self.thumbnail_url:
            self.thumbnail_url = default_photo['thumbnail']
            self.preview_url = default_photo['preview']
            self.save(update_fields=['thumbnail_url', 'preview_url'])

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
            'thumbnail': self.thumbnail_url
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
        return [
            timestamp[0].isoformat()
            for timestamp in queryset
            .order_by('-timestamp')
            .values_list('timestamp')
        ]

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
        if Group.objects.filter(uuid=self.uuid):
            raise IntegrityError("UUID already exists in Group table")
        super().save(*args, **kwargs)


@receiver(post_save, sender=Plant)
@receiver(post_delete, sender=Plant)
@disable_for_loaddata
def clear_cached_plant_lists(instance, **kwargs):
    '''Clear cached unnamed_plant and species_options lists when a Plant is
    saved or deleted (will be generated and cached next time needed).

    The plant_options list is updated automatically by hook in tasks.py.
    '''
    cache.delete(f'unnamed_plants_{instance.user.pk}')
    cache.delete('species_options')


class Photo(models.Model):
    '''Stores a user-uploaded image of a specific plant.'''

    # Original full-resolution photo
    photo = models.ImageField(upload_to="images")
    # 200x200 thumbnail (shown on PlantCard, timeline thumbnails, etc)
    thumbnail = models.ImageField(upload_to="thumbnails", null=True, blank=True)
    # 800x800 preview (shown in photo modals)
    preview = models.ImageField(upload_to="previews", null=True, blank=True)

    # Store timestamp when created (not editable)
    created = models.DateTimeField(auto_now_add=True)

    # Timestamp will be read from exifdata by save method
    timestamp = models.DateTimeField(null=True, blank=True)

    # Required relation field matching Photo to correct Plant
    plant = models.ForeignKey(Plant, on_delete=models.CASCADE)

    def __str__(self):
        name = self.plant.get_display_name()
        timestamp = self.timestamp.strftime(TIME_FORMAT)
        filename = self.photo.name.split("/", 1)[-1]
        return f"{name} - {timestamp} - {filename}"

    def get_photo_url(self):
        '''Returns public URL of the full-resolution photo.'''
        return f'{settings.MEDIA_URL}{self.photo.name}'

    def get_thumbnail_url(self):
        '''Returns public URL of the reduced-resolution thumbnail (200x200).'''
        return f'{settings.MEDIA_URL}{self.thumbnail.name}'

    def get_preview_url(self):
        '''Returns public URL of the reduced-resolution preview (800x800).'''
        return f'{settings.MEDIA_URL}{self.preview.name}'

    def get_details(self):
        '''Returns dict with timestamp, primary key, and URLs of all resolutions.'''
        return {
            'timestamp': self.timestamp.isoformat(),
            'image': self.get_photo_url(),
            'thumbnail': self.get_thumbnail_url(),
            'preview': self.get_preview_url(),
            'key': self.pk
        }

    def _crop_to_square(self, image):
        '''Takes PIL.Image, crops to square aspect ratio and returns.'''
        width, height = image.size

        # Already square
        if height == width:
            return image

        # Portrait
        if height > width:
            top = (height - width) / 2
            bottom = height - top
            return image.crop((0, top, width, bottom))

        # Landscape
        left = (width - height) / 2
        right = width - left
        return image.crop((left, 0, right, height))

    def _convert_to_webp(self, image, size, quality, suffix):
        '''Takes PIL.Image, size (2-tuple), quality (1-100), and filename suffix.
        Returns as webp with requested dimensions and quality.
        '''

        # Get ICC profile (color accuracy)
        icc_profile = image.info.get('icc_profile')

        # Resize, save to buffer
        image.thumbnail(size)
        image_buffer = BytesIO()
        image.save(
            image_buffer,
            format='webp',
            method=6,
            quality=quality,
            icc_profile=icc_profile
        )
        image_buffer.seek(0)

        # Add requested suffix to name, return
        image_name = self.photo.name.rsplit('.', 1)[0]
        return InMemoryUploadedFile(
            image_buffer,
            field_name="ImageField",
            name=f"{image_name}_{suffix}.webp",
            content_type="image/webp",
            size=image_buffer.tell(),
            charset=None,
        )

    def _create_thumbnails(self):
        '''Generates reduced-resolution images (up to 200x200 and 800x800) and
        writes to the thumbnail and preview fields respectively.
        '''

        # Open image, rotate and remove exif rotation param if needed
        original = ImageOps.exif_transpose(
            Image.open(self.photo)
        )

        # Thumbnail: crop to square, resize to 200x200
        self.thumbnail = self._convert_to_webp(
            self._crop_to_square(original.copy()),
            size=settings.THUMBNAIL_RESOLUTION,
            quality=settings.THUMBNAIL_QUALITY,
            suffix='thumb'
        )

        # Preview: resize to maximum of 800x800 (usually 800x600 or 600x800)
        self.preview = self._convert_to_webp(
            original.copy(),
            size=settings.PREVIEW_RESOLUTION,
            quality=settings.PREVIEW_QUALITY,
            suffix='preview'
        )

    def save(self, *args, **kwargs):
        # Create thumbnail if it doesn't exist
        if not self.thumbnail or not self.preview:
            self._create_thumbnails()

        # Copy exif timestamp to timestamp field when saved for the first time
        if not self.pk:
            # Read raw exif data
            exif_raw = Image.open(self.photo).info.get('exif')

            if exif_raw:
                exif_data = piexif.load(exif_raw)
                # Parse Date/Time Original and Offset Time Original parameters
                datetime_original = exif_data['Exif'].get(36867)
                if datetime_original:
                    datetime_original = datetime_original.decode()
                offset_original = exif_data['Exif'].get(36881)
                if offset_original:
                    offset_original = offset_original.decode()

                # If both found parse as original timezone + convert to UTC
                if datetime_original and offset_original:
                    # Remove colon if present (not supported by strptime)
                    timestamp = datetime.strptime(
                        f"{datetime_original} {offset_original.replace(':', '')}",
                        f"{TIME_FORMAT} %z"
                    )
                    self.timestamp = timestamp.astimezone(timezone.utc)

                # If offset not found parse as UTC
                elif datetime_original:
                    timestamp = datetime.strptime(datetime_original, TIME_FORMAT)
                    self.timestamp = timestamp.astimezone(timezone.utc)

                # Default to current time if neither exif param found
                else:
                    self.timestamp = django_timezone.now()
            # Default to current time if no exif data found
            else:
                self.timestamp = django_timezone.now()

        super().save(*args, **kwargs)

        # Update Plant's thumbnail URL if new Photo is most recent
        self.plant.update_thumbnail_url()


@receiver(post_delete, sender=Photo)
def update_plant_thumbnail_when_photo_deleted(instance, **kwargs):
    '''Updates Plant.thumbnail_url field when associated Photo is deleted (if
    deleted photo was most recent photo the thumbnail_url will be outdated).
    '''
    instance.plant.update_thumbnail_url()


class Event(models.Model):
    '''Abstract base class for all plant events.'''
    plant = models.ForeignKey(Plant, on_delete=models.CASCADE)
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


class FertilizeEvent(Event):
    '''Records timestamp when a Plant entry was fertilized.'''

    class Meta:
        unique_together = ('plant', 'timestamp')


class PruneEvent(Event):
    '''Records timestamp when a Plant entry was pruned.'''

    class Meta:
        unique_together = ('plant', 'timestamp')


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


class NoteEvent(Event):
    '''Records timestamp and user-entered text about a specific Plant.'''
    text = models.CharField(max_length=500)

    class Meta:
        unique_together = ('plant', 'timestamp')


class DivisionEvent(Event):
    '''Records timestamp when a Plant entry was divided.
    The inheritted plant attribute is a reverse relation to the parent plant.
    All child plants have reverse relation back to DivisionEvent with related
    name "created_plants".
    '''

    class Meta:
        unique_together = ('plant', 'timestamp')
