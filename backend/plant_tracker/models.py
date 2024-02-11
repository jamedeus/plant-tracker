from django.db import models
from django.core.cache import cache
from django.dispatch import receiver
from django.db.models.signals import post_save, post_delete
from django.core.validators import MaxValueValidator, MinValueValidator


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

    def get_plant_details(self):
        '''Returns nested dict with sub-dict for each Plant in Tray (Plant ID as key)
        Each sub-dict contains name, last_watered timestamp, last_fertilized timestamp
        '''
        details = {}
        for plant in self.plant_set.all():
            details[plant.uuid] = {
                'name': plant.get_display_name(),
                'last_watered': plant.last_watered(),
                'last_fertilized': plant.last_fertilized()
            }
        return details


@receiver(post_save, sender=Tray)
@receiver(post_delete, sender=Tray)
def clear_unnamed_trays_cache(sender, instance, **kwargs):
    """Clear cached unnamed_trays list when a Tray is saved or deleted"""
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

    # Accept pot sizes between 1 inch and 3 feet (optional)
    pot_size = models.PositiveIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(36)],
        blank=True,
        null=True
    )

    # Optional relation to manage multiple plants in the same tray
    tray = models.ForeignKey(Tray, on_delete=models.CASCADE, blank=True, null=True)

    def get_display_name(self):
        '''Returns frontend display string determined from description attributes'''
        if self.name:
            return self.name
        if self.species:
            return f'Unnamed {self.species}'

        # If no name or species return string with unnamed plant index
        unnamed_plants = get_unnamed_plants()
        return f'Unnamed plant {unnamed_plants.index(self.id) + 1}'

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
        '''Returns list of timestamp strings for every WaterEvent'''
        return [
            timestamp[0].isoformat()
            for timestamp in self.waterevent_set.all().values_list('timestamp')
        ]

    def get_fertilize_timestamps(self):
        '''Returns list of timestamp strings for every FertilizeEvent'''
        return [
            timestamp[0].isoformat()
            for timestamp in self.fertilizeevent_set.all().values_list('timestamp')
        ]

    def get_prune_timestamps(self):
        '''Returns list of timestamp strings for every PruneEvent'''
        return [
            timestamp[0].isoformat()
            for timestamp in self.pruneevent_set.all().values_list('timestamp')
        ]

    def get_repot_timestamps(self):
        '''Returns list of timestamp strings for every RepotEvent'''
        return [
            timestamp[0].isoformat()
            for timestamp in self.repotevent_set.all().values_list('timestamp')
        ]


@receiver(post_save, sender=Plant)
@receiver(post_delete, sender=Plant)
def clear_unnamed_plants_cache(sender, instance, **kwargs):
    """Clear cached unnamed_plant list when a Plant is saved or deleted"""
    cache.delete('unnamed_plants')


class WaterEvent(models.Model):
    '''Records timestamp when a Plant entry was watered'''
    plant = models.ForeignKey(Plant, on_delete=models.CASCADE)
    timestamp = models.DateTimeField()


class FertilizeEvent(models.Model):
    '''Records timestamp when a Plant entry was fertilized'''
    plant = models.ForeignKey(Plant, on_delete=models.CASCADE)
    timestamp = models.DateTimeField()


class PruneEvent(models.Model):
    '''Records timestamp when a Plant entry was pruned'''
    plant = models.ForeignKey(Plant, on_delete=models.CASCADE)
    timestamp = models.DateTimeField()


class RepotEvent(models.Model):
    '''Records timestamp when a Plant entry was repotted'''
    plant = models.ForeignKey(Plant, on_delete=models.CASCADE)
    timestamp = models.DateTimeField()
