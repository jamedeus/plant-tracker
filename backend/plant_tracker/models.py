from io import BytesIO
from datetime import datetime

from PIL import Image, ImageOps
from django.db import models
from django.conf import settings
from django.utils import timezone
from django.core.cache import cache
from django.dispatch import receiver
from django.core.exceptions import ValidationError
from django.db.models.signals import post_save, post_delete
from django.core.files.uploadedfile import InMemoryUploadedFile
from django.core.validators import MaxValueValidator, MinValueValidator

# Timestamp format used to print DateTimeFields, parse exif into datetime, etc.
TIME_FORMAT = '%Y:%m:%d %H:%M:%S'


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


def get_unnamed_trays():
    '''Returns list of primary_key ints for all Trays with no name or location
    List is cached for up to 10 minutes, or until Tray model changed
    Uses list instead of QuerySet to avoid serialization overhead
    '''
    unnamed_trays = cache.get('unnamed_trays')
    if not unnamed_trays:
        unnamed_trays = list(Tray.objects.filter(
            name__isnull=True,
            location__isnull=True
        ).values_list('id', flat=True))
        cache.set('unnamed_trays', unnamed_trays, 600)
    return unnamed_trays


class Tray(models.Model):
    '''Tracks a tray containing multiple plants, created by scanning QR code
    Provides methods to water or fertilize all plants within tray
    '''

    # UUID of QR code attached to tray
    uuid = models.UUIDField(unique=True)

    # Description fields are optional, if blank user will just see "Unnamed tray"
    name = models.CharField(max_length=50, blank=True, null=True)
    location = models.CharField(max_length=50, blank=True, null=True)
    description = models.CharField(max_length=500, blank=True, null=True)

    # Store timestamp when created (not editable)
    created = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.get_display_name()} ({self.uuid})"

    def get_display_name(self):
        '''Returns frontend display string determined from description attributes'''
        if self.name:
            return self.name
        if self.location:
            return f'{self.location} tray'

        # If no name or location return string with unnamed tray index
        unnamed_trays = get_unnamed_trays()
        return f'Unnamed tray {unnamed_trays.index(self.id) + 1}'

    def water_all(self, timestamp):
        '''Takes datetime instance, creates WaterEvent for each Plant in Tray'''
        for plant in self.plant_set.all():
            WaterEvent.objects.create(plant=plant, timestamp=timestamp)

    def fertilize_all(self, timestamp):
        '''Takes datetime instance, creates FertilizeEvent for each Plant in Tray'''
        for plant in self.plant_set.all():
            FertilizeEvent.objects.create(plant=plant, timestamp=timestamp)

    def get_plant_uuids(self):
        '''Returns a list of UUID strings for all Plants in Tray'''
        return [str(uuid) for uuid in self.plant_set.all().values_list('uuid', flat=True)]

    def get_details(self):
        '''Returns dict containing all tray attributes and number of plants'''
        return {
            'name': self.get_display_name(),
            'uuid': str(self.uuid),
            'location': self.location,
            'description': self.description,
            'plants': len(self.plant_set.all())
        }

    def get_plant_details(self):
        '''Returns list of dicts with parameters for each Plant in Tray
        See Plant.get_details for dict parameters
        '''
        return [plant.get_details() for plant in self.plant_set.all()]


@receiver(post_save, sender=Tray)
@receiver(post_delete, sender=Tray)
def clear_unnamed_trays_cache(**kwargs):
    '''Clear cached unnamed_trays list when a Tray is saved or deleted'''
    cache.delete('unnamed_trays')


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

    # Accept pot sizes between 1 inch and 3 feet (optional)
    pot_size = models.PositiveIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(36)],
        blank=True,
        null=True
    )

    # Optional relation to manage multiple plants in the same tray
    tray = models.ForeignKey(Tray, on_delete=models.CASCADE, blank=True, null=True)

    # Optional relation to set photo used for overview page thumbnail
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
        else:
            return self.get_most_recent_thumbnail()

    def get_most_recent_thumbnail(self):
        '''Returns thumbnail URL of most recent photo, or None if no Photos exist'''
        try:
            return self.photo_set.all().order_by('-created')[0].get_thumbnail_url()
        except IndexError:
            return None

    def get_details(self):
        '''Returns dict containing all plant attributes and last_watered,
        last_fertilized timestamps. Used as state for frontend components.
        '''
        return {
            'name': self.get_display_name(),
            'uuid': str(self.uuid),
            'species': self.species,
            'description': self.description,
            'pot_size': self.pot_size,
            'last_watered': self.last_watered(),
            'last_fertilized': self.last_fertilized(),
            'thumbnail': self.get_thumbnail()
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
        super().save(*args, **kwargs)


@receiver(post_save, sender=Plant)
@receiver(post_delete, sender=Plant)
def clear_unnamed_plants_cache(**kwargs):
    '''Clear cached plant_options, unnamed_plant and species_options lists when
    a Plant is saved or deleted
    '''
    cache.delete('plant_options')
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

        # Skip if no photo exists
        if not self.photo:
            return

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
            # Read exif data
            exif_data = Image.open(self.photo)._getexif()

            if exif_data:
                # Write Date/Time Original parameter to created field
                datetime_original = exif_data.get(36867)
                if datetime_original:
                    self.created = datetime.strptime(datetime_original, TIME_FORMAT)
                # Default to current time if exif param not found
                else:
                    self.created = timezone.now()
            # Default to current time if no exif data found
            else:
                self.created = timezone.now()

        super().save(*args, **kwargs)


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
