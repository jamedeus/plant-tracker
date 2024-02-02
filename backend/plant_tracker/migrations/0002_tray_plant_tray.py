# Generated by Django 5.0.1 on 2024-02-02 06:26

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("plant_tracker", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="Tray",
            fields=[
                ("id", models.UUIDField(primary_key=True, serialize=False)),
                ("name", models.CharField(blank=True, max_length=50, null=True)),
                ("location", models.CharField(blank=True, max_length=50, null=True)),
            ],
        ),
        migrations.AddField(
            model_name="plant",
            name="tray",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                to="plant_tracker.tray",
            ),
        ),
    ]
