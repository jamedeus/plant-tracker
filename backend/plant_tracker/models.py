from django.db import models
from django.core.validators import MaxValueValidator, MinValueValidator


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
    timestamp = models.DateTimeField(auto_now_add=True)


class FertilizeEvent(models.Model):
    plant = models.ForeignKey(Plant, on_delete=models.CASCADE)
    timestamp = models.DateTimeField(auto_now_add=True)
