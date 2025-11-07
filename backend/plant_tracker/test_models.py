# pylint: disable=missing-docstring,line-too-long,global-statement

import os
from uuid import uuid4
from concurrent.futures import ThreadPoolExecutor, wait

from django.conf import settings
from django.utils import timezone
from django.core.cache import cache
from django.contrib.auth import get_user_model
from django.test import TestCase, TransactionTestCase
from django.db import transaction, connection, IntegrityError

from .view_decorators import get_default_user
from .models import (
    Group,
    Plant,
    UUID,
    WaterEvent,
    FertilizeEvent,
    PruneEvent,
    RepotEvent,
    Photo,
    NoteEvent
)
from .unit_test_helpers import (
    JSONClient,
    create_mock_photo,
    enable_isolated_media_root,
    cleanup_isolated_media_root,
)

OVERRIDE = None
MODULE_MEDIA_ROOT = None


def setUpModule():
    global OVERRIDE, MODULE_MEDIA_ROOT
    OVERRIDE, MODULE_MEDIA_ROOT = enable_isolated_media_root()


def tearDownModule():
    # Delete mock photo directory after tests
    cleanup_isolated_media_root(OVERRIDE, MODULE_MEDIA_ROOT)


class PlantModelTests(TestCase):
    def setUp(self):
        # Clear entire cache before each test
        cache.clear()
        # Create blank test model to use in tests
        self.plant = Plant.objects.create(uuid=uuid4(), user=get_default_user())
        # Create test datetime object for creating events
        self.timestamp = timezone.now()

    def tearDown(self):
        # Delete mock photos between tests to prevent duplicate names (django
        # appends random string to keep unique, which makes testing difficult)
        try:
            user_photos = os.path.join(settings.TEST_DIR, 'data', 'images', 'user_1')
            for i in os.listdir(os.path.join(user_photos, 'images')):
                os.remove(os.path.join(user_photos, 'images', i))
            for i in os.listdir(os.path.join(user_photos, 'thumbnails')):
                os.remove(os.path.join(user_photos, 'thumbnails', i))
            for i in os.listdir(os.path.join(user_photos, 'previews')):
                os.remove(os.path.join(user_photos, 'previews', i))
        except FileNotFoundError:
            pass

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

    def test_change_plant_uuid(self):
        # Call change_uuid endpoint, confirm response + uuid changed
        new_id = str(uuid4())
        response = JSONClient().post('/change_uuid', {
            'uuid': self.plant.uuid,
            'new_id': new_id
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'new_uuid': new_id})
        self.plant.refresh_from_db()
        self.assertEqual(str(self.plant.uuid), new_id)

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
        for _ in range(0, 3):
            unnamed.append(Plant.objects.create(uuid=uuid4(), user=get_default_user()))

        # Confirm Unnamed plants have correct sequential display_names
        self.assertEqual(unnamed[0].get_display_name(), 'Unnamed plant 1')
        self.assertEqual(unnamed[1].get_display_name(), 'Unnamed plant 2')
        self.assertEqual(unnamed[2].get_display_name(), 'Unnamed plant 3')

    def test_get_photos(self):
        # Create 3 mock photos with non-chronological creation times
        photo1 = Photo.objects.create(
            photo=create_mock_photo('2024:02:21 10:52:03', 'IMG1.jpg'),
            plant=self.plant
        )
        photo1.finalize_upload()
        photo2 = Photo.objects.create(
            photo=create_mock_photo('2024:03:22 10:52:03', 'IMG2.jpg'),
            plant=self.plant
        )
        photo2.finalize_upload()
        photo3 = Photo.objects.create(
            photo=create_mock_photo('2024:01:28 10:52:03', 'IMG3.jpg'),
            plant=self.plant
        )
        photo3.finalize_upload()

        # Get object containing URLs
        photos = self.plant.get_photos()

        # Confirm photos are sorted most recent to least recent
        self.assertEqual(
            photos,
            {
                photo2.pk: {
                    'timestamp': '2024-03-22T10:52:03+00:00',
                    'photo': '/media/user_1/images/IMG2.jpg',
                    'thumbnail': '/media/user_1/thumbnails/IMG2_thumb.webp',
                    'preview': '/media/user_1/previews/IMG2_preview.webp',
                    'key': photo2.pk,
                    'pending': False
                },
                photo1.pk: {
                    'timestamp': '2024-02-21T10:52:03+00:00',
                    'photo': '/media/user_1/images/IMG1.jpg',
                    'thumbnail': '/media/user_1/thumbnails/IMG1_thumb.webp',
                    'preview': '/media/user_1/previews/IMG1_preview.webp',
                    'key': photo1.pk,
                    'pending': False
                },
                photo3.pk: {
                    'timestamp': '2024-01-28T10:52:03+00:00',
                    'photo': '/media/user_1/images/IMG3.jpg',
                    'thumbnail': '/media/user_1/thumbnails/IMG3_thumb.webp',
                    'preview': '/media/user_1/previews/IMG3_preview.webp',
                    'key': photo3.pk,
                    'pending': False
                },
            }
        )

    def test_get_default_photo_details(self):
        # Confirm returns empty template when no photos exist
        self.assertEqual(
            self.plant.get_default_photo_details(),
            {
                "set": False,
                "timestamp": None,
                "photo": None,
                "thumbnail": None,
                "preview": None,
                "key": None
            }
        )

        # Create 2 mock photos for test plant
        photo1 = Photo.objects.create(
            photo=create_mock_photo('2024:02:21 10:52:03', 'IMG1.jpg'),
            plant=self.plant
        )
        photo1.finalize_upload()
        photo2 = Photo.objects.create(
            photo=create_mock_photo('2024:03:22 10:52:03', 'IMG2.jpg'),
            plant=self.plant
        )
        photo2.finalize_upload()

        # Confirm returns details of most-recent photo with set = False
        self.assertEqual(
            self.plant.get_default_photo_details(),
            {
                "set": False,
                "timestamp": photo2.timestamp.isoformat(),
                "photo": photo2.photo.url,
                "thumbnail": photo2.thumbnail.url,
                "preview": photo2.preview.url,
                "key": photo2.pk,
                "pending": False
            }
        )

        # Set older photo as default_photo
        self.plant.default_photo = photo1

        # Confirm returns details of configured default photo with set = True
        self.assertEqual(
            self.plant.get_default_photo_details(),
            {
                "set": True,
                "timestamp": photo1.timestamp.isoformat(),
                "photo": photo1.photo.url,
                "thumbnail": photo1.thumbnail.url,
                "preview": photo1.preview.url,
                "key": photo1.pk,
                "pending": False
            }
        )

    def test_set_invalid_default_photo(self):
        # Create second plant entry + photo associated with second plant
        wrong_plant = Plant.objects.create(uuid=uuid4(), user=get_default_user())
        wrong_plant_photo = Photo.objects.create(
            photo=create_mock_photo('2024:02:21 10:52:03', 'IMG1.jpg'),
            plant=wrong_plant
        )

        # Confirm an exception is raised if new photo is set as default for the
        # first plant (default_photo must have reverse relation to same plant)
        with self.assertRaises(IntegrityError):
            self.plant.default_photo = wrong_plant_photo
            self.plant.save()

    def test_deletes_photos_from_disk_when_plant_deleted(self):
        # Create photos associated with test plant
        photo1 = Photo.objects.create(
            photo=create_mock_photo('2024:02:21 10:52:03', 'IMG1.jpg'),
            plant=self.plant
        )
        photo2 = Photo.objects.create(
            photo=create_mock_photo('2024:02:21 10:53:03', 'IMG2.jpg'),
            plant=self.plant
        )

        # Confirm photos exist on disk
        photo1_path = photo1.photo.path
        photo2_path = photo2.photo.path
        self.assertTrue(os.path.exists(photo1_path))
        self.assertTrue(os.path.exists(photo2_path))

        # Delete plant, confirm photos no longer exist on disk
        self.plant.delete()
        self.assertFalse(os.path.exists(photo1_path))
        self.assertFalse(os.path.exists(photo2_path))


class GroupModelTests(TestCase):
    def setUp(self):
        # Clear entire cache before each test
        cache.clear()

        # Create test group
        default_user = get_default_user()
        self.test_group = Group.objects.create(uuid=uuid4(), user=default_user)

        # Create 2 plants with relations to Group and 1 without
        self.plant1 = Plant.objects.create(uuid=uuid4(), name="plant1", group=self.test_group, user=default_user)
        self.plant2 = Plant.objects.create(uuid=uuid4(), name="plant2", group=self.test_group, user=default_user)
        self.plant3 = Plant.objects.create(uuid=uuid4(), name="plant3", user=default_user)

    def test_str_method(self):
        # Should return "Unnamed group <num> (UUID)" when no params are set
        self.assertEqual(str(self.test_group), f"Unnamed group 1 ({self.test_group.uuid})")
        # Add location, should return "<location> group (UUID)"
        self.test_group.location = "Top shelf"
        self.assertEqual(str(self.test_group), f"Top shelf group ({self.test_group.uuid})")
        # Add name, should return "<name> (UUID)"
        self.test_group.name = "Top shelf"
        self.assertEqual(str(self.test_group), f"Top shelf ({self.test_group.uuid})")

    def test_water_all(self):
        # Confirm plants have no water events
        self.assertEqual(len(self.plant1.waterevent_set.all()), 0)
        self.assertEqual(len(self.plant2.waterevent_set.all()), 0)
        self.assertEqual(len(self.plant3.waterevent_set.all()), 0)

        # Call water_all, plants in group should have water event, other plant should not
        self.test_group.water_all(timezone.datetime.fromisoformat('2024-02-06T03:06:26+00:00'))
        self.assertEqual(len(self.plant1.waterevent_set.all()), 1)
        self.assertEqual(len(self.plant2.waterevent_set.all()), 1)
        self.assertEqual(len(self.plant3.waterevent_set.all()), 0)

    def test_fertilize_all(self):
        # Confirm plants have no fertilize events
        self.assertEqual(len(self.plant1.fertilizeevent_set.all()), 0)
        self.assertEqual(len(self.plant2.fertilizeevent_set.all()), 0)
        self.assertEqual(len(self.plant3.fertilizeevent_set.all()), 0)

        # Call water_all, plants in group should have fertilize event, other plant should not
        self.test_group.fertilize_all(timezone.datetime.fromisoformat('2024-02-06T03:06:26+00:00'))
        self.assertEqual(len(self.plant1.fertilizeevent_set.all()), 1)
        self.assertEqual(len(self.plant2.fertilizeevent_set.all()), 1)
        self.assertEqual(len(self.plant3.fertilizeevent_set.all()), 0)

    def test_change_group_uuid(self):
        # Call change_uuid endpoint, confirm response + uuid changed
        new_id = str(uuid4())
        response = JSONClient().post('/change_uuid', {
            'uuid': self.test_group.uuid,
            'new_id': new_id
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'new_uuid': new_id})
        self.test_group.refresh_from_db()
        self.assertEqual(str(self.test_group.uuid), new_id)

    def test_get_display_name(self):
        # Confirm name and location are null, display_name should be unnamed index
        self.assertIsNone(self.test_group.name)
        self.assertIsNone(self.test_group.location)
        self.assertEqual(self.test_group.get_display_name(), 'Unnamed group 1')

        # Add location, display_name should be "<location> group"
        self.test_group.location = 'Middle shelf'
        self.test_group.save()
        self.assertEqual(self.test_group.get_display_name(), 'Middle shelf group')

        # Add name, display_name should be name attribute
        self.test_group.name = 'Real name'
        self.test_group.save()
        self.assertEqual(self.test_group.get_display_name(), 'Real name')

        # Create 3 unnamed groups
        unnamed = []
        for _ in range(0, 3):
            unnamed.append(Group.objects.create(uuid=uuid4(), user=get_default_user()))

        # Confirm Unnamed groups have correct sequential display_names
        self.assertEqual(unnamed[0].get_display_name(), 'Unnamed group 1')
        self.assertEqual(unnamed[1].get_display_name(), 'Unnamed group 2')
        self.assertEqual(unnamed[2].get_display_name(), 'Unnamed group 3')

    def test_get_plant_uuids(self):
        # Confirm method returns list of UUIDs of all plants in group
        self.assertEqual(
            self.test_group.get_plant_uuids(),
            [str(self.plant1.uuid), str(self.plant2.uuid)]
        )


class PhotoModelTests(TestCase):
    def setUp(self):
        # Clear entire cache before each test
        cache.clear()

        self.plant = Plant.objects.create(uuid=uuid4(), user=get_default_user())
        self.timestamp = timezone.now()

        self.photo = Photo.objects.create(
            photo=create_mock_photo('2024:03:21 10:52:03', 'photo1.jpg'),
            plant=self.plant
        )
        self.photo.finalize_upload()

    def tearDown(self):
        # Delete mock photos between tests to prevent duplicate names (django
        # appends random string to keep unique, which makes testing difficult)
        user_photos = os.path.join(settings.TEST_DIR, 'data', 'images', 'user_1')
        for i in os.listdir(os.path.join(user_photos, 'images')):
            os.remove(os.path.join(user_photos, 'images', i))
        for i in os.listdir(os.path.join(user_photos, 'thumbnails')):
            os.remove(os.path.join(user_photos, 'thumbnails', i))
        for i in os.listdir(os.path.join(user_photos, 'previews')):
            os.remove(os.path.join(user_photos, 'previews', i))

    def test_str_method(self):
        # Should return "<plant name> - <photo creation timestamp> - <filename>"
        self.assertEqual(
            str(self.photo),
            "Unnamed plant 1 - 2024:03:21 10:52:03 - photo1.jpg"
        )

    def test_sets_correct_timestamp(self):
        # Create mock photo with DateTime and OffsetTime exif params
        both_exif_params = Photo.objects.create(
            plant=self.plant,
            photo=create_mock_photo(
                creation_time='2024:03:21 10:52:03',
                timezone='-07:00',
                name='both.jpg'
            )
        )

        # Confirm timestamp was converted from -07:00 to UTC
        self.assertEqual(
            both_exif_params.timestamp.isoformat(),
            '2024-03-21T17:52:03+00:00'
        )

        # Create mock photo with DateTime param but no OffsetTime
        only_datetime_param = Photo.objects.create(
            plant=self.plant,
            photo=create_mock_photo(
                creation_time='2024:03:21 10:52:03',
                name='both.jpg'
            )
        )

        # Confirm timestamp is unchanged, UTC timezone is added
        self.assertEqual(
            only_datetime_param.timestamp.isoformat(),
            '2024-03-21T10:52:03+00:00'
        )

        # Create mock photo with no exif data
        no_exif_data = Photo.objects.create(
            plant=self.plant,
            photo=create_mock_photo()
        )

        # Confirm timestamp matches current time in UTC, has timezone offset
        # (ignore seconds to reduce chance of false negatives)
        self.assertEqual(
            no_exif_data.timestamp.strftime('%Y:%m:%d %H:%M +z'),
            timezone.now().strftime('%Y:%m:%d %H:%M +z')
        )

        # Create mock photo with exif data but no timestamp or timezone params
        no_exif_data = Photo.objects.create(
            plant=self.plant,
            photo=create_mock_photo(blank_exif=True)
        )

        # Confirm timestamp matches current time in UTC, has timezone offset
        # (ignore seconds to reduce chance of false negatives)
        self.assertEqual(
            no_exif_data.timestamp.strftime('%Y:%m:%d %H:%M +z'),
            timezone.now().strftime('%Y:%m:%d %H:%M +z')
        )

    def test_crops_thumbnails_to_square(self):
        # Create mock landscape photo, confirm thumbnail is square
        landscape = Photo.objects.create(
            plant=self.plant,
            photo=create_mock_photo(size=(160, 90))
        )
        landscape.finalize_upload()
        self.assertEqual(landscape.thumbnail.height, landscape.thumbnail.width)

        # Create mock portrait photo, confirm thumbnail is square
        portrait = Photo.objects.create(
            plant=self.plant,
            photo=create_mock_photo(size=(90, 160))
        )
        portrait.finalize_upload()
        self.assertEqual(portrait.thumbnail.height, portrait.thumbnail.width)

        # Create mock suqare photo, confirm thumbnail is square
        suqare = Photo.objects.create(
            plant=self.plant,
            photo=create_mock_photo(size=(10, 10))
        )
        suqare.finalize_upload()
        self.assertEqual(suqare.thumbnail.height, suqare.thumbnail.width)

    def test_deletes_files_from_disk_when_photo_model_deleted(self):
        # Get full paths to each resolution, confirm exists on disk
        image_path = self.photo.photo.path
        thumb_path = self.photo.thumbnail.path
        preview_path = self.photo.preview.path
        self.assertTrue(os.path.exists(image_path))
        self.assertTrue(os.path.exists(thumb_path))
        self.assertTrue(os.path.exists(preview_path))

        # Delete photo, confirm images were removed from disk
        self.photo.delete()
        self.assertFalse(os.path.exists(image_path))
        self.assertFalse(os.path.exists(thumb_path))
        self.assertFalse(os.path.exists(preview_path))

    def test_create_thumbnails_argument(self):
        # Instantiate model, call save with no arguments
        photo = Photo(
            photo=create_mock_photo('2024:03:21 10:52:03', 'photo2.jpg'),
            plant=self.plant
        )
        photo.save()

        # Confirm thumbnail and preview were not generate, pending is True
        self.assertIsNone(photo.thumbnail.name)
        self.assertIsNone(photo.preview.name)
        self.assertTrue(photo.pending)

        # Call save with create_thumbnails=True
        photo.save(create_thumbnails=True)

        # Confirm thumbnail and preview were generated, pending is False
        self.assertIsNotNone(photo.thumbnail.name)
        self.assertIsNotNone(photo.preview.name)
        self.assertFalse(photo.pending)

    def test_finalize_upload_does_not_create_duplicate_thumbnails(self):
        # Create photo, finalize upload, confirm thumbnails exist
        plant = Plant.objects.create(uuid=uuid4(), user=get_default_user())
        photo = Photo.objects.create(
            photo=create_mock_photo(name='photo.of.my.plant.flowering.jpg'),
            plant=plant
        )
        photo.finalize_upload()
        photo.refresh_from_db()
        self.assertIsNotNone(photo.thumbnail.name)
        self.assertIsNotNone(photo.preview.name)
        self.assertFalse(photo.pending)

        # Save name of thumbnail and preview
        thumbnail_name = photo.thumbnail.name
        preview_name = photo.preview.name

        # Call finalize_upload again, confirm names did not change (no duplicates)
        photo.finalize_upload()
        photo.refresh_from_db()
        self.assertEqual(photo.thumbnail.name, thumbnail_name)
        self.assertEqual(photo.preview.name, preview_name)
        self.assertFalse(photo.pending)


class EventModelTests(TestCase):
    def setUp(self):
        # Clear entire cache before each test
        cache.clear()

        self.plant = Plant.objects.create(uuid=uuid4(), user=get_default_user())
        self.timestamp = timezone.now()

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
        with self.assertRaises(IntegrityError), transaction.atomic():
            WaterEvent.objects.create(plant=self.plant, timestamp=self.timestamp)

        # Confirm second event was not created
        self.assertEqual(len(WaterEvent.objects.all()), 1)

    def test_duplicate_fertilize_event(self):
        # Create FertilizeEvent, confirm 1 entry exists
        FertilizeEvent.objects.create(plant=self.plant, timestamp=self.timestamp)
        self.assertEqual(len(FertilizeEvent.objects.all()), 1)

        # Attempt to create duplicate with same timestamp, should raise error
        with self.assertRaises(IntegrityError), transaction.atomic():
            FertilizeEvent.objects.create(plant=self.plant, timestamp=self.timestamp)

        # Confirm second event was not created
        self.assertEqual(len(FertilizeEvent.objects.all()), 1)

    def test_duplicate_prune_event(self):
        # Create PruneEvent, confirm 1 entry exists
        PruneEvent.objects.create(plant=self.plant, timestamp=self.timestamp)
        self.assertEqual(len(PruneEvent.objects.all()), 1)

        # Attempt to create duplicate with same timestamp, should raise error
        with self.assertRaises(IntegrityError), transaction.atomic():
            PruneEvent.objects.create(plant=self.plant, timestamp=self.timestamp)

        # Confirm second event was not created
        self.assertEqual(len(PruneEvent.objects.all()), 1)

    def test_duplicate_repot_event(self):
        # Create RepotEvent, confirm 1 entry exists
        RepotEvent.objects.create(plant=self.plant, timestamp=self.timestamp)
        self.assertEqual(len(RepotEvent.objects.all()), 1)

        # Attempt to create duplicate with same timestamp, should raise error
        with self.assertRaises(IntegrityError), transaction.atomic():
            RepotEvent.objects.create(plant=self.plant, timestamp=self.timestamp)

        # Confirm second event was not created
        self.assertEqual(len(RepotEvent.objects.all()), 1)

    def test_duplicate_note_event(self):
        # Create NoteEvent, confirm 1 entry exists
        NoteEvent.objects.create(plant=self.plant, timestamp=self.timestamp)
        self.assertEqual(len(NoteEvent.objects.all()), 1)

        # Attempt to create duplicate with same timestamp, should raise error
        with self.assertRaises(IntegrityError), transaction.atomic():
            NoteEvent.objects.create(plant=self.plant, timestamp=self.timestamp)

        # Confirm second event was not created
        self.assertEqual(len(NoteEvent.objects.all()), 1)


class UniqueUUIDTests(TransactionTestCase):
    '''Tests to confirm the same UUID cannot be used for a Plant and Group.'''

    def setUp(self):
        # Set default content_type for post requests (avoid long lines)
        self.client = JSONClient()

        # Recreate default user (deleted by TransactionTestCase)
        self.user, _ = get_user_model().objects.get_or_create(
            username=settings.DEFAULT_USERNAME
        )

        # Clear cached user instance
        get_default_user.cache_clear()

    def register_plant(self, uuid):
        '''Takes UUID, registers new plant with /register_plant endpoint.'''
        return self.client.post('/register_plant', {
            'name': '',
            'species': '',
            'pot_size': '',
            'description': '',
            'uuid': str(uuid),
        })

    def register_group(self, uuid):
        '''Takes UUID, registers new plant with /register_group endpoint.'''
        return self.client.post('/register_group', {
            'name': '',
            'location': '',
            'description': '',
            'uuid': str(uuid),
        })

    def test_plant_uuid_must_be_unique(self):
        # Create existing plant
        plant = Plant.objects.create(user=get_default_user(), uuid=uuid4())

        # Confirm creating another Plant with same UUID raises IntegrityError
        with self.assertRaises(IntegrityError):
            Plant.objects.create(user=get_default_user(), uuid=plant.uuid)

        # Confirm creating Group with same UUID raises IntegrityError
        with self.assertRaises(IntegrityError):
            Group.objects.create(user=get_default_user(), uuid=plant.uuid)

        # Confirm only 1 UUID entry was added to database
        self.assertEqual(len(UUID.objects.all()), 1)

    def test_group_uuid_must_be_unique(self):
        # Create existing group
        group = Group.objects.create(user=get_default_user(), uuid=uuid4())

        # Confirm creating another Group with same UUID raises IntegrityError
        with self.assertRaises(IntegrityError):
            Group.objects.create(user=get_default_user(), uuid=group.uuid)

        # Confirm creating Plant with same UUID raises IntegrityError
        with self.assertRaises(IntegrityError):
            Plant.objects.create(user=get_default_user(), uuid=group.uuid)

        # Confirm only 1 UUID entry was added to database
        self.assertEqual(len(UUID.objects.all()), 1)

    def test_create_duplicate_with_registration_endpoints(self):
        # Register plant, confirm success
        uuid = uuid4()
        response = self.register_plant(uuid)
        self.assertEqual(response.status_code, 200)

        # Register group with same UUID, confirm rejected
        response = self.register_group(uuid)
        self.assertEqual(response.status_code, 409)
        self.assertEqual(
            response.json(),
            {"error": "uuid already exists in database"}
        )

        # Confirm only 1 UUID entry was added to database
        self.assertEqual(len(UUID.objects.all()), 1)

    def test_create_duplicate_with_registration_endpoints_race_condition(self):
        # Create UUID to register Plant and Group with
        uuid = uuid4()

        def worker_plant():
            try:
                return self.register_plant(uuid)
            finally:
                connection.close()

        def worker_group():
            try:
                return self.register_group(uuid)
            finally:
                connection.close()

        # Make 2 simultaneous registration requests using the same UUID
        with ThreadPoolExecutor(max_workers=2) as pool:
            responses = [pool.submit(worker_plant), pool.submit(worker_group)]
            wait(responses)

        # Confirm 1 request succeeded, other was rejected (409 UUID already exists)
        self.assertEqual(
            sorted(response.result().status_code for response in responses),
            [200, 409]
        )

        # Confirm only 1 UUID entry was added to database
        self.assertEqual(len(UUID.objects.all()), 1)

    def test_create_duplicate_with_change_uuid_endpoint(self):
        # Create Plant and Group with different UUIDs
        plant = Plant.objects.create(user=self.user, uuid=uuid4())
        group = Group.objects.create(user=self.user, uuid=uuid4())

        # Attempt to change plant UUID to group UUID
        response = JSONClient().post('/change_uuid', {
            'uuid': str(plant.uuid),
            'new_id': str(group.uuid),
        })
        # Confirm rejected with correct error
        self.assertEqual(response.status_code, 409)
        self.assertEqual(
            response.json(),
            {"error": "new_id is already used by another Plant or Group"}
        )

        # Confirm only 2 UUID entries exist (changed UUID was dropped)
        self.assertEqual(len(UUID.objects.all()), 2)

    def test_create_duplicate_with_change_uuid_endpoint_race_condition(self):
        # Create Plant and Group with different UUIDs
        plant = Plant.objects.create(user=self.user, uuid=uuid4())
        group = Group.objects.create(user=self.user, uuid=uuid4())

        # Create new UUID to change both to
        new_uuid = uuid4()

        def worker_plant():
            try:
                return JSONClient().post('/change_uuid', {
                    'uuid': str(plant.uuid),
                    'new_id': str(new_uuid),
                })
            finally:
                connection.close()

        def worker_group():
            try:
                return JSONClient().post('/change_uuid', {
                    'uuid': str(group.uuid),
                    'new_id': str(new_uuid),
                })
            finally:
                connection.close()

        # Make 2 simultaneous change_uuid requests using the same UUID
        with ThreadPoolExecutor(max_workers=2) as pool:
            responses = [pool.submit(worker_plant), pool.submit(worker_group)]
            wait(responses)

        # Confirm 1 request succeeded (200), other rejected (409 already exists)
        self.assertEqual(
            sorted(response.result().status_code for response in responses),
            [200, 409]
        )

        # Confirm only 2 UUID entries exist (changed UUID was dropped)
        self.assertEqual(len(UUID.objects.all()), 2)

    def test_create_duplicate_by_directly_editing_models(self):
        # Create Plant and Group with different UUIDs
        plant = Plant.objects.create(user=self.user, uuid=uuid4())
        group = Group.objects.create(user=self.user, uuid=uuid4())
        # Confirm 2 UUIDs reserved in database
        self.assertEqual(len(UUID.objects.all()), 2)

        # Confirm an exception is raised if Plant UUID changed to Group UUID
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                plant.uuid = group.uuid
                plant.save()
        # Confirm still 2 UUIDs in database (reservation not cleared)
        self.assertEqual(len(UUID.objects.all()), 2)

        # Refresh plant UUID from DB (local copy still has group uuid even
        # though save failed above)
        plant.refresh_from_db()

        # Confirm an exception is raised if Group UUID changed to Plant UUID
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                group.uuid = plant.uuid
                group.save()
        # Confirm still 2 UUIDs in database (reservation not cleared)
        self.assertEqual(len(UUID.objects.all()), 2)
