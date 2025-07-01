'''UUID model tracks UUIDs being used by both Plant and Group model (prevent
duplicates). Should not be instantiated directly, done automatically by postgres
trigger functions (see plant_tracker/migrations/0033_enforce_unique_uuid.py).
'''

from django.db import models


class UUID(models.Model):
    '''Stores a UUID which is being used by a Plant or Group model.'''
    uuid = models.UUIDField(primary_key=True)

    class Meta:
        db_table = 'uuid'
