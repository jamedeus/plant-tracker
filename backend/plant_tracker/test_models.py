import os
import shutil
from uuid import uuid4
from datetime import datetime, timedelta

from django.utils import timezone
from django.test import TestCase
from django.test import override_settings
from django.core.exceptions import ValidationError

from .models import (
    Tray,
    Plant,
    WaterEvent,
    FertilizeEvent,
    PruneEvent,
    RepotEvent,
    Photo
)
from .unit_test_helpers import JSONClient, create_mock_photo

# Temp directory for mock photo uploads, deleted after tests
TEST_DIR = '/tmp/plant_tracker_unit_test'


# Create test directory or mock photo uploads
def setUpModule():
    if not os.path.isdir(os.path.join(TEST_DIR, 'data', 'images')):
        os.makedirs(os.path.join(TEST_DIR, 'data', 'images'))


# Delete mock photo directory after tests
def tearDownModule():
    print("\nDeleting mock photos...\n")
    shutil.rmtree(TEST_DIR, ignore_errors=True)


class PlantModelTests(TestCase):
    def setUp(self):
        # Create blank test model to use in tests
        self.plant = Plant.objects.create(uuid=uuid4())
        # Create test datetime object for creating events
        self.timestamp = timezone.now()

        # Set default content_type for post requests (avoid long lines)
        self.client = JSONClient()

    def test_str_method(self):
        # Should return "Unnamed plant <num> (UUID)" when no params are set
        self.assertEqual(str(self.plant), f"Unnamed plant 1 ({self.plant.uuid})")
        # Add species, should return "Unnamed <species> (UUID)"
        self.plant.species = "Fittonia"
        self.assertEqual(str(self.plant), f"Unnamed Fittonia ({self.plant.uuid})")
        # Add name, should return "<name> (UUID)"
        self.plant.name = "My Plant"
        self.assertEqual(str(self.plant), f"My Plant ({self.plant.uuid})")

    def test_last_event_methods(self):
        # Confirm all methods return None when no events exist
        self.assertIsNone(self.plant.last_watered())
        self.assertIsNone(self.plant.last_fertilized())
        self.assertIsNone(self.plant.last_pruned())
        self.assertIsNone(self.plant.last_repotted())

        # Create one event of each type
        WaterEvent.objects.create(plant=self.plant, timestamp=self.timestamp)
        FertilizeEvent.objects.create(plant=self.plant, timestamp=self.timestamp)
        PruneEvent.objects.create(plant=self.plant, timestamp=self.timestamp)
        RepotEvent.objects.create(plant=self.plant, timestamp=self.timestamp)

        # Confirm all methods return expected timestamp
        self.assertEqual(self.plant.last_watered(), self.timestamp.isoformat())
        self.assertEqual(self.plant.last_fertilized(), self.timestamp.isoformat())
        self.assertEqual(self.plant.last_pruned(), self.timestamp.isoformat())
        self.assertEqual(self.plant.last_repotted(), self.timestamp.isoformat())

    def test_get_water_timestamps(self):
        # Create 3 WaterEvents for the plant, 1 day apart, non-chronological order in database
        WaterEvent.objects.create(plant=self.plant, timestamp=self.timestamp - timedelta(days=2))
        WaterEvent.objects.create(plant=self.plant, timestamp=self.timestamp)
        WaterEvent.objects.create(plant=self.plant, timestamp=self.timestamp - timedelta(days=1))

        # Confirm method returns correct list sorted most to least recent
        self.assertEqual(
            self.plant.get_water_timestamps(),
            [
                self.timestamp.isoformat(),
                (self.timestamp - timedelta(days=1)).isoformat(),
                (self.timestamp - timedelta(days=2)).isoformat()
            ]
        )

    def test_get_fertilize_timestamps(self):
        # Create 3 FertilizeEvent for the plant, 1 day apart, non-chronological order in database
        FertilizeEvent.objects.create(plant=self.plant, timestamp=self.timestamp - timedelta(days=2))
        FertilizeEvent.objects.create(plant=self.plant, timestamp=self.timestamp)
        FertilizeEvent.objects.create(plant=self.plant, timestamp=self.timestamp - timedelta(days=1))

        # Confirm method returns correct list sorted most to least recent
        self.assertEqual(
            self.plant.get_fertilize_timestamps(),
            [
                self.timestamp.isoformat(),
                (self.timestamp - timedelta(days=1)).isoformat(),
                (self.timestamp - timedelta(days=2)).isoformat()
            ]
        )

    def test_get_prune_timestamps(self):
        # Create 3 PruneEvent for the plant, 1 day apart, non-chronological order in database
        PruneEvent.objects.create(plant=self.plant, timestamp=self.timestamp - timedelta(days=2))
        PruneEvent.objects.create(plant=self.plant, timestamp=self.timestamp)
        PruneEvent.objects.create(plant=self.plant, timestamp=self.timestamp - timedelta(days=1))

        # Confirm method returns correct list sorted most to least recent
        self.assertEqual(
            self.plant.get_prune_timestamps(),
            [
                self.timestamp.isoformat(),
                (self.timestamp - timedelta(days=1)).isoformat(),
                (self.timestamp - timedelta(days=2)).isoformat()
            ]
        )

    def test_get_repot_timestamps(self):
        # Create 3 RepotEvent for the plant, 1 day apart, non-chronological order in database
        RepotEvent.objects.create(plant=self.plant, timestamp=self.timestamp - timedelta(days=2))
        RepotEvent.objects.create(plant=self.plant, timestamp=self.timestamp)
        RepotEvent.objects.create(plant=self.plant, timestamp=self.timestamp - timedelta(days=1))

        # Confirm method returns correct list sorted most to least recent
        self.assertEqual(
            self.plant.get_repot_timestamps(),
            [
                self.timestamp.isoformat(),
                (self.timestamp - timedelta(days=1)).isoformat(),
                (self.timestamp - timedelta(days=2)).isoformat()
            ]
        )

    def test_change_plant_uuid(self):
        # Call change_plant_uuid endpoint, confirm response + uuid changed
        payload = {
            'plant_id': self.plant.uuid,
            'new_id': str(uuid4())
        }
        response = self.client.post('/change_plant_uuid', payload)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'new_uuid': payload['new_id']})
        self.plant.refresh_from_db()
        self.assertEqual(str(self.plant.uuid), payload['new_id'])

    def test_get_display_name(self):
        # Confirm name and species are null, display_name should be unnamed index
        self.assertIsNone(self.plant.name)
        self.assertIsNone(self.plant.species)
        self.assertEqual(self.plant.get_display_name(), 'Unnamed plant 1')

        # Add species, display_name should be "Unnamed <species>"
        self.plant.species = 'Calathea'
        self.plant.save()
        self.assertEqual(self.plant.get_display_name(), 'Unnamed Calathea')

        # Add name, display_name should be name attribute
        self.plant.name = 'Real name'
        self.plant.save()
        self.assertEqual(self.plant.get_display_name(), 'Real name')

        # Create 3 unnamed plants
        unnamed = []
        for i in range(0, 3):
            unnamed.append(Plant.objects.create(uuid=uuid4()))

        # Confirm Unnamed plants have correct sequential display_names
        self.assertEqual(unnamed[0].get_display_name(), 'Unnamed plant 1')
        self.assertEqual(unnamed[1].get_display_name(), 'Unnamed plant 2')
        self.assertEqual(unnamed[2].get_display_name(), 'Unnamed plant 3')

    @override_settings(MEDIA_ROOT=os.path.join(TEST_DIR, 'data', 'images'))
    def test_get_photo_urls(self):
        # Create 3 mock photos with non-chronological creation times
        Photo.objects.create(
            photo=create_mock_photo('2024:02:21 10:52:03', 'photo1.jpg'),
            plant=self.plant
        )
        Photo.objects.create(
            photo=create_mock_photo('2024:03:22 10:52:03', 'photo2.jpg'),
            plant=self.plant
        )
        Photo.objects.create(
            photo=create_mock_photo('2024:01:28 10:52:03', 'photo3.jpg'),
            plant=self.plant
        )

        # Get object containing URLs
        photo_urls = self.plant.get_photo_urls()

        # Confirm photos are sorted most recent to least recent
        self.assertEqual(
            photo_urls,
            [
                {
                    'created': '2024:03:22 10:52:03',
                    'url': '/media/images/photo2.jpg',
                    'key': 2
                },
                {
                    'created': '2024:02:21 10:52:03',
                    'url': '/media/images/photo1.jpg',
                    'key': 1
                },
                {
                    'created': '2024:01:28 10:52:03',
                    'url': '/media/images/photo3.jpg',
                    'key': 3
                },
            ]
        )


class TrayModelTests(TestCase):
    def setUp(self):
        # Create test tray
        self.test_tray = Tray.objects.create(uuid=uuid4())

        # Create 2 plants with relations to Tray and 1 without
        self.plant1 = Plant.objects.create(uuid=uuid4(), name="plant1", tray=self.test_tray)
        self.plant2 = Plant.objects.create(uuid=uuid4(), name="plant2", tray=self.test_tray)
        self.plant3 = Plant.objects.create(uuid=uuid4(), name="plant3")

        # Set default content_type for post requests (avoid long lines)
        self.client = JSONClient()

    def test_str_method(self):
        # Should return "Unnamed tray <num> (UUID)" when no params are set
        self.assertEqual(str(self.test_tray), f"Unnamed tray 1 ({self.test_tray.uuid})")
        # Add location, should return "<location> tray (UUID)"
        self.test_tray.location = "Top shelf"
        self.assertEqual(str(self.test_tray), f"Top shelf tray ({self.test_tray.uuid})")
        # Add name, should return "<name> (UUID)"
        self.test_tray.name = "Top shelf"
        self.assertEqual(str(self.test_tray), f"Top shelf ({self.test_tray.uuid})")

    def test_water_all(self):
        # Confirm plants have no water events
        self.assertEqual(len(self.plant1.waterevent_set.all()), 0)
        self.assertEqual(len(self.plant2.waterevent_set.all()), 0)
        self.assertEqual(len(self.plant3.waterevent_set.all()), 0)

        # Call water_all, plants in tray should have water event, other plant should not
        self.test_tray.water_all(datetime.fromisoformat('2024-02-06T03:06:26+00:00'))
        self.assertEqual(len(self.plant1.waterevent_set.all()), 1)
        self.assertEqual(len(self.plant2.waterevent_set.all()), 1)
        self.assertEqual(len(self.plant3.waterevent_set.all()), 0)

    def test_fertilize_all(self):
        # Confirm plants have no fertilize events
        self.assertEqual(len(self.plant1.fertilizeevent_set.all()), 0)
        self.assertEqual(len(self.plant2.fertilizeevent_set.all()), 0)
        self.assertEqual(len(self.plant3.fertilizeevent_set.all()), 0)

        # Call water_all, plants in tray should have fertilize event, other plant should not
        self.test_tray.fertilize_all(datetime.fromisoformat('2024-02-06T03:06:26+00:00'))
        self.assertEqual(len(self.plant1.fertilizeevent_set.all()), 1)
        self.assertEqual(len(self.plant2.fertilizeevent_set.all()), 1)
        self.assertEqual(len(self.plant3.fertilizeevent_set.all()), 0)

    def test_change_tray_uuid(self):
        # Call change_tray_uuid endpoint, confirm response + uuid changed
        payload = {
            'tray_id': self.test_tray.uuid,
            'new_id': str(uuid4())
        }
        response = self.client.post('/change_tray_uuid', payload)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'new_uuid': payload['new_id']})
        self.test_tray.refresh_from_db()
        self.assertEqual(str(self.test_tray.uuid), payload['new_id'])

    def test_get_display_name(self):
        # Confirm name and location are null, display_name should be unnamed index
        self.assertIsNone(self.test_tray.name)
        self.assertIsNone(self.test_tray.location)
        self.assertEqual(self.test_tray.get_display_name(), 'Unnamed tray 1')

        # Add location, display_name should be "<location> tray"
        self.test_tray.location = 'Middle shelf'
        self.test_tray.save()
        self.assertEqual(self.test_tray.get_display_name(), 'Middle shelf tray')

        # Add name, display_name should be name attribute
        self.test_tray.name = 'Real name'
        self.test_tray.save()
        self.assertEqual(self.test_tray.get_display_name(), 'Real name')

        # Create 3 unnamed trays
        unnamed = []
        for i in range(0, 3):
            unnamed.append(Tray.objects.create(uuid=uuid4()))

        # Confirm Unnamed trays have correct sequential display_names
        self.assertEqual(unnamed[0].get_display_name(), 'Unnamed tray 1')
        self.assertEqual(unnamed[1].get_display_name(), 'Unnamed tray 2')
        self.assertEqual(unnamed[2].get_display_name(), 'Unnamed tray 3')


class PhotoModelTests(TestCase):
    @override_settings(MEDIA_ROOT=os.path.join(TEST_DIR, 'data', 'images'))
    def setUp(self):
        self.plant = Plant.objects.create(uuid=uuid4())
        self.timestamp = datetime.now()

        self.photo = Photo.objects.create(
            photo=create_mock_photo('2024:03:21 10:52:03', 'photo1.jpg'),
            plant=self.plant
        )


    def tearDown(self):
        # Delete mock photos between tests to prevent duplicate names (django
        # appends random string to keep unique, which makes testing difficult)
        for i in os.listdir(os.path.join(TEST_DIR, 'data', 'images', 'images')):
            os.remove(os.path.join(TEST_DIR, 'data', 'images', 'images', i))

    @override_settings(MEDIA_ROOT=os.path.join(TEST_DIR, 'data', 'images'))
    def test_str_method(self):
        # Should return "<plant name> - <photo creation timestamp> - <filename>"
        self.assertEqual(
            str(self.photo),
            "Unnamed plant 1 - 2024:03:21 10:52:03 - photo1.jpg"
        )


class EventModelTests(TestCase):
    def setUp(self):
        self.plant = Plant.objects.create(uuid=uuid4())
        self.timestamp = datetime.now()

    def test_str_method(self):
        # Create test events
        water = WaterEvent.objects.create(plant=self.plant, timestamp=self.timestamp)
        prune = PruneEvent.objects.create(plant=self.plant, timestamp=self.timestamp)

        # Should return "<plant name> - <event timestamp>"
        timestamp_string = self.timestamp.strftime('%Y:%m:%d %H:%M:%S')
        self.assertEqual(str(water), f"Unnamed plant 1 - {timestamp_string}")
        self.assertEqual(str(prune), f"Unnamed plant 1 - {timestamp_string}")

    def test_duplicate_water_event(self):
        # Create WaterEvent, confirm 1 entry exists
        WaterEvent.objects.create(plant=self.plant, timestamp=self.timestamp)
        self.assertEqual(len(WaterEvent.objects.all()), 1)

        # Attempt to create duplicate with same timestamp, should raise error
        with self.assertRaises(ValidationError):
            WaterEvent.objects.create(plant=self.plant, timestamp=self.timestamp)

        # Confirm second event was not created
        self.assertEqual(len(WaterEvent.objects.all()), 1)

    def test_duplicate_fertilize_event(self):
        # Create FertilizeEvent, confirm 1 entry exists
        FertilizeEvent.objects.create(plant=self.plant, timestamp=self.timestamp)
        self.assertEqual(len(FertilizeEvent.objects.all()), 1)

        # Attempt to create duplicate with same timestamp, should raise error
        with self.assertRaises(ValidationError):
            FertilizeEvent.objects.create(plant=self.plant, timestamp=self.timestamp)

        # Confirm second event was not created
        self.assertEqual(len(FertilizeEvent.objects.all()), 1)

    def test_duplicate_prune_event(self):
        # Create PruneEvent, confirm 1 entry exists
        PruneEvent.objects.create(plant=self.plant, timestamp=self.timestamp)
        self.assertEqual(len(PruneEvent.objects.all()), 1)

        # Attempt to create duplicate with same timestamp, should raise error
        with self.assertRaises(ValidationError):
            PruneEvent.objects.create(plant=self.plant, timestamp=self.timestamp)

        # Confirm second event was not created
        self.assertEqual(len(PruneEvent.objects.all()), 1)

    def test_duplicate_repot_event(self):
        # Create RepotEvent, confirm 1 entry exists
        RepotEvent.objects.create(plant=self.plant, timestamp=self.timestamp)
        self.assertEqual(len(RepotEvent.objects.all()), 1)

        # Attempt to create duplicate with same timestamp, should raise error
        with self.assertRaises(ValidationError):
            RepotEvent.objects.create(plant=self.plant, timestamp=self.timestamp)

        # Confirm second event was not created
        self.assertEqual(len(RepotEvent.objects.all()), 1)
