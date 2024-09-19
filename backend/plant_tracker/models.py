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
from django.core.exceptions import ValidationError
from django.utils import timezone as django_timezone
from django.db.models.signals import post_save, post_delete
from django.core.files.uploadedfile import InMemoryUploadedFile
from django.core.validators import MaxValueValidator, MinValueValidator

# Timestamp format used to print DateTimeFields, parse exif into datetime, etc.
TIME_FORMAT = '%Y:%m:%d %H:%M:%S'

# HEIC image support
register_heif_opener()


def get_unnamed_plants():
    '''Returns list of primary_key ints for all Plants with no name or species
    List is cached for up to 10 minutes, or until Plant model changed
    Uses list instead of QuerySet to avoid serialization overhead
    '''
    unnamed_plants = cache.get('unnamed_plants')
    if not unnamed_plants:
        unnamed_plants = list(Plant.objects.filter(
            name__isnull=True,
            species__isnull=True
        ).values_list('id', flat=True))
        cache.set('unnamed_plants', unnamed_plants, 600)
    return unnamed_plants


def get_unnamed_groups():
    '''Returns list of primary_key ints for all Groups with no name or location
    List is cached for up to 10 minutes, or until Group model changed
    Uses list instead of QuerySet to avoid serialization overhead
    '''
    unnamed_groups = cache.get('unnamed_groups')
    if not unnamed_groups:
        unnamed_groups = list(Group.objects.filter(
            name__isnull=True,
            location__isnull=True
        ).values_list('id', flat=True))
        cache.set('unnamed_groups', unnamed_groups, 600)
    return unnamed_groups


def get_plant_options():
    '''Returns a list of dicts with attributes of all existing plants.
    List is cached until Plant model changes (detected by hooks in tasks.py).
    Used to populate options in add plants modal on manage_group page.
    '''
    plant_options = cache.get('plant_options')
    if not plant_options:
        plant_options = [plant.get_details() for plant in Plant.objects.all()]
        cache.set('plant_options', plant_options, None)
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


def get_group_options():
    '''Returns a list of dicts with attributes of all existing groups.
    List is cached until Group model changes (detected by hooks in tasks.py).
    Used to populate options in add group modal on manage_plant page.
    '''
    group_options = cache.get('group_options')
    if not group_options:
        group_options = [group.get_details() for group in Group.objects.all()]
        cache.set('group_options', group_options, None)
    return group_options


class Group(models.Model):
    '''Tracks a group containing multiple plants, created by scanning QR code
    Provides methods to water or fertilize all plants within group
    '''

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
        '''Returns frontend display string determined from description attributes'''
        if self.name:
            return self.name
        if self.location:
            return f'{self.location} group'

        # If no name or location return string with unnamed group index
        unnamed_groups = get_unnamed_groups()
        return f'Unnamed group {unnamed_groups.index(self.id) + 1}'

    def water_all(self, timestamp):
        '''Takes datetime instance, creates WaterEvent for each Plant in Group'''
        for plant in self.plant_set.all():
            WaterEvent.objects.create(plant=plant, timestamp=timestamp)

    def fertilize_all(self, timestamp):
        '''Takes datetime instance, creates FertilizeEvent for each Plant in Group'''
        for plant in self.plant_set.all():
            FertilizeEvent.objects.create(plant=plant, timestamp=timestamp)

    def get_plant_uuids(self):
        '''Returns a list of UUID strings for all Plants in Group'''
        return [str(uuid) for uuid in self.plant_set.all().values_list('uuid', flat=True)]

    def get_details(self):
        '''Returns dict containing all group attributes and number of plants'''
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
        '''Returns list of dicts with parameters for each Plant in Group
        See Plant.get_details for dict parameters
        '''
        return [plant.get_details() for plant in self.plant_set.all()]

    def save(self, *args, **kwargs):
        # Prevent saving Group with UUID that is already used by Plant
        if Plant.objects.filter(uuid=self.uuid):
            raise IntegrityError("UUID already exists in Plant table")
        super().save(*args, **kwargs)


@receiver(post_save, sender=Group)
@receiver(post_delete, sender=Group)
def clear_cached_group_lists(**kwargs):
    '''Clear cached unnamed_groups list when a Group is saved or deleted (will
    be generated and cached next time needed).

    The group_options list is updated automatically by hook in tasks.py.
    '''
    cache.delete('unnamed_groups')


class Plant(models.Model):
    '''Tracks an individual plant, created by scanning QR code
    Stores optional description params added during registration
    Receives database relation to all WaterEvents and FertilizeEvents
    '''

    # UUID of QR code attached to plant
    uuid = models.UUIDField(unique=True)

    # Description fields are optional, if blank user will just see "Unnamed plant"
    name = models.CharField(max_length=50, blank=True, null=True)
    species = models.CharField(max_length=50, blank=True, null=True)
    description = models.CharField(max_length=500, blank=True, null=True)

    # Store timestamp when created (not editable)
    created = models.DateTimeField(auto_now_add=True)

    # Removes from overview page if True
    archived = models.BooleanField(default=False)

    # Accept pot sizes between 1 inch and 3 feet (optional)
    pot_size = models.PositiveIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(36)],
        blank=True,
        null=True
    )

    # Optional relation to manage multiple plants in the same group
    group = models.ForeignKey(Group, on_delete=models.CASCADE, blank=True, null=True)

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

    # Store the URL of the current overview page thumbnail
    # This is updated automatically if a new Photo is uploaded (see Photo.save)
    thumbnail_url = models.URLField(blank=True, null=True)

    def __str__(self):
        return f"{self.get_display_name()} ({self.uuid})"

    def get_display_name(self):
        '''Returns frontend display string determined from description attributes'''
        if self.name:
            return self.name
        if self.species:
            return f'Unnamed {self.species}'

        # If no name or species return string with unnamed plant index
        unnamed_plants = get_unnamed_plants()
        return f'Unnamed plant {unnamed_plants.index(self.id) + 1}'

    def get_photo_urls(self):
        '''Returns list of dicts containing photo and thumbnail URLs, creation
        timestamps, and database keys of each photo associated with this plant
        '''
        return [
            {
                'created': photo.created.isoformat(),
                'image': photo.get_photo_url(),
                'thumbnail': photo.get_thumbnail_url(),
                'key': photo.pk
            }
            for photo in self.photo_set.all().order_by('-created')
        ]

    def get_thumbnail(self):
        '''Returns thumbnail URL shown on frontend overview page
        Uses user-configured default_photo if set, or most recent photo
        '''
        if self.default_photo:
            return self.default_photo.get_thumbnail_url()
        try:
            # Most recent photo
            return self.photo_set.all().order_by('-created')[0].get_thumbnail_url()
        except IndexError:
            return None

    def update_thumbnail_url(self):
        '''Updates thumbnail_url field if it is outdated.
        Called when a new Photo associated with this Plant is saved.
        '''
        new_thumbnail_url = self.get_thumbnail()
        if self.thumbnail_url != new_thumbnail_url:
            self.thumbnail_url = new_thumbnail_url
            self.save(update_fields=['thumbnail_url'])

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

    def last_watered(self):
        '''Returns timestamp string of last WaterEvent, or None if no events'''
        last_event = self.waterevent_set.all().order_by('timestamp').last()
        if last_event:
            return last_event.timestamp.isoformat()
        return None

    def last_fertilized(self):
        '''Returns timestamp string of last FertilizeEvent, or None if no events'''
        last_event = self.fertilizeevent_set.all().order_by('timestamp').last()
        if last_event:
            return last_event.timestamp.isoformat()
        return None

    def last_pruned(self):
        '''Returns timestamp string of last PruneEvent, or None if no events'''
        last_event = self.pruneevent_set.all().order_by('timestamp').last()
        if last_event:
            return last_event.timestamp.isoformat()
        return None

    def last_repotted(self):
        '''Returns timestamp string of last RepotEvent, or None if no events'''
        last_event = self.repotevent_set.all().order_by('timestamp').last()
        if last_event:
            return last_event.timestamp.isoformat()
        return None

    def get_water_timestamps(self):
        '''Returns list of timestamp strings for every WaterEvent sorted from
        most recent to least recent
        '''
        return [
            timestamp[0].isoformat()
            for timestamp in self.waterevent_set.all()
            .order_by('-timestamp')
            .values_list('timestamp')
        ]

    def get_fertilize_timestamps(self):
        '''Returns list of timestamp strings for every FertilizeEvent sorted from
        most recent to least recent
        '''
        return [
            timestamp[0].isoformat()
            for timestamp in self.fertilizeevent_set.all()
            .order_by('-timestamp')
            .values_list('timestamp')
        ]

    def get_prune_timestamps(self):
        '''Returns list of timestamp strings for every PruneEvent sorted from
        most recent to least recent
        '''
        return [
            timestamp[0].isoformat()
            for timestamp in self.pruneevent_set.all()
            .order_by('-timestamp')
            .values_list('timestamp')
        ]

    def get_repot_timestamps(self):
        '''Returns list of timestamp strings for every RepotEvent sorted from
        most recent to least recent
        '''
        return [
            timestamp[0].isoformat()
            for timestamp in self.repotevent_set.all()
            .order_by('-timestamp')
            .values_list('timestamp')
        ]

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
def clear_cached_plant_lists(**kwargs):
    '''Clear cached unnamed_plant and species_options lists when a Plant is
    saved or deleted (will be generated and cached next time needed)

    The plant_options list is updated automatically by hook in tasks.py.
    '''
    cache.delete('unnamed_plants')
    cache.delete('species_options')


class Photo(models.Model):
    '''Stores a user-uploaded image of a specific plant'''
    photo = models.ImageField(upload_to="images")
    thumbnail = models.ImageField(upload_to="thumbnails", null=True, blank=True)

    # Save upload time, created time will be read from exifdata by save method
    uploaded = models.DateTimeField(auto_now_add=True)
    created = models.DateTimeField(null=True, blank=True)

    # Required relation field matching Photo to correct Plant
    plant = models.ForeignKey(Plant, on_delete=models.CASCADE)

    def __str__(self):
        name = self.plant.get_display_name()
        timestamp = self.created.strftime(TIME_FORMAT)
        filename = self.photo.file.file.name.split("/")[-1]
        return f"{name} - {timestamp} - {filename}"

    def get_photo_url(self):
        '''Returns public URL of the full-resolution photo'''
        return f'{settings.MEDIA_URL}{self.photo.name}'

    def get_thumbnail_url(self):
        '''Returns public URL of the reduced-resolution thumbnail'''
        return f'{settings.MEDIA_URL}{self.thumbnail.name}'

    def create_thumbnail(self):
        '''Generate a reduced-resolution image and write to the thumbnail field'''

        # Open image, rotate and remove exif rotation param if needed
        image = ImageOps.exif_transpose(
            Image.open(self.photo)
        )

        # Resize to a maximum resolution of 800x800, write to buffer
        image.thumbnail((800, 800))
        image_buffer = BytesIO()
        image.save(image_buffer, format='JPEG', quality=80)

        # Save to thumbnail field, write to disk with _thumb suffix
        image_name = self.photo.name.split('.')[0]
        self.thumbnail = InMemoryUploadedFile(
            image_buffer,
            'ImageField',
            f"{image_name}_thumb.jpg",
            'image/jpeg',
            image_buffer.tell(),
            None
        )

    def save(self, *args, **kwargs):
        # Create thumbnail if it doesn't exist
        if not self.thumbnail:
            self.create_thumbnail()

        # Copy exif timestamp to created field when saved for the first time
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
                    self.created = timestamp.astimezone(timezone.utc)

                # If offset not found parse as UTC
                elif datetime_original:
                    timestamp = datetime.strptime(datetime_original, TIME_FORMAT)
                    self.created = timestamp.astimezone(timezone.utc)

                # Default to current time if neither exif param found
                else:
                    self.created = django_timezone.now()
            # Default to current time if no exif data found
            else:
                self.created = django_timezone.now()

        super().save(*args, **kwargs)

        # Update Plant's thumbnail URL if new Photo is most recent
        self.plant.update_thumbnail_url()


@receiver(post_delete, sender=Photo)
def update_plant_thumbnail_when_photo_deleted(instance, **kwargs):
    '''Updates Plant.thumbnail_url field when associated Photo is deleted (if
    deleted photo was most recent photo the thumbnail_url will be outdated)
    '''
    instance.plant.update_thumbnail_url()


class Event(models.Model):
    '''Abstract base class for all plant events'''
    plant = models.ForeignKey(Plant, on_delete=models.CASCADE)
    timestamp = models.DateTimeField()

    class Meta:
        abstract = True

    def __str__(self):
        name = self.plant.get_display_name()
        timestamp = self.timestamp.strftime(TIME_FORMAT)
        return f"{name} - {timestamp}"

    def save(self, *args, **kwargs):
        # Prevent creating duplicate events with the same plant and timestamp
        if self.__class__.objects.filter(
            plant=self.plant,
            timestamp=self.timestamp
        ).exclude(pk=self.pk).exists():
            raise ValidationError(
                "Plant already has an event with the same type and timestamp"
            )
        super().save(*args, **kwargs)


class WaterEvent(Event):
    '''Records timestamp when a Plant entry was watered'''


class FertilizeEvent(Event):
    '''Records timestamp when a Plant entry was fertilized'''


class PruneEvent(Event):
    '''Records timestamp when a Plant entry was pruned'''


class RepotEvent(Event):
    '''Records timestamp when a Plant entry was repotted'''

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


class NoteEvent(Event):
    '''Records timestamp and user-entered text about a specific Plant'''
    text = models.CharField(max_length=500)
