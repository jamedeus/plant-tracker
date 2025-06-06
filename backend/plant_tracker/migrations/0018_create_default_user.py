# Generated by Django 5.1.6 on 2025-04-06 06:53

from django.db import migrations
from django.conf import settings


def set_default_user(apps, schema_editor):
    '''Creates default user and assigns all existing Plant and Group entries to
    it (intermediary step before making user field non-nullable).
    '''
    User = apps.get_model(settings.AUTH_USER_MODEL)
    Plant = apps.get_model('plant_tracker', 'Plant')
    Group = apps.get_model('plant_tracker', 'Group')

    # Create default user, assign all existing Plants and Groups
    default_user, _ = User.objects.get_or_create(username=settings.DEFAULT_USERNAME)
    Plant.objects.filter(user__isnull=True).update(user=default_user)
    Group.objects.filter(user__isnull=True).update(user=default_user)

class Migration(migrations.Migration):

    dependencies = [
        ('plant_tracker', '0017_group_user_plant_user'),
    ]

    operations = [
        migrations.RunPython(set_default_user),
    ]
