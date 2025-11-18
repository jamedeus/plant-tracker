'''Custom positive integer field to store plant pot size (1-36 inches).'''

from django.db import models
from django.core.validators import MaxValueValidator, MinValueValidator


class PotSizeField(models.PositiveIntegerField):
    '''Custom positive integer field to store plant pot size (1-36 inches).'''

    default_validators = [MinValueValidator(1), MaxValueValidator(36)]

    def __init__(self, *args, **kwargs):
        kwargs.setdefault('blank', True)
        kwargs.setdefault('null', True)
        super().__init__(*args, **kwargs)
