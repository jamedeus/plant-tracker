from datetime import datetime

from django.db import models
from django.core.validators import MaxValueValidator, MinValueValidator


class Tray(models.Model):
    # UUID of QR code attached to tray
    id = models.UUIDField(primary_key=True, editable=True)

    # Description fields are optional, if blank user will just see "Unnamed tray"
    name = models.CharField(max_length=50, blank=True, null=True)
    location = models.CharField(max_length=50, blank=True, null=True)

    def water_all(self, timestamp):
        '''Takes datetime instance, creates WaterEvent for each Plant in Tray'''
        for plant in self.plant_set.all():
            WaterEvent.objects.create(plant=plant, timestamp=timestamp)

    def fertilize_all(self, timestamp):
        '''Takes datetime instance, creates FertilizeEvent for each Plant in Tray'''
        for plant in self.plant_set.all():
            FertilizeEvent.objects.create(plant=plant, timestamp=timestamp)

    def get_plant_details(self):
        details = {}
        for plant in self.plant_set.all():
            details[plant.id] = {
                'name': plant.name,
                'last_watered': plant.last_watered(),
                'last_fertilized': plant.last_fertilized()
            }
        return details


class Plant(models.Model):
    # UUID of QR code attached to plant
    id = models.UUIDField(primary_key=True, editable=True)

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

    def last_watered(self):
        last_event = self.waterevent_set.all().order_by('timestamp').last()
        if last_event:
            return last_event.timestamp.isoformat()
        else:
            return None

    def last_fertilized(self):
        last_event = self.fertilizeevent_set.all().order_by('timestamp').last()
        if last_event:
            return last_event.timestamp.isoformat()
        else:
            return None


class WaterEvent(models.Model):
    plant = models.ForeignKey(Plant, on_delete=models.CASCADE)
    timestamp = models.DateTimeField()


class FertilizeEvent(models.Model):
    plant = models.ForeignKey(Plant, on_delete=models.CASCADE)
    timestamp = models.DateTimeField()
