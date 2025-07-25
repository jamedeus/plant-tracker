'''Manual SQL migration to create postgres triggers that prevent a Plant and
Group model sharing the same UUID.

This is more effective than querying other table in python to check if UUID is
available (fails in race condition, and makes extra query to check) and avoids
multi-table inheritance complexity (ie if both Plant and Group were subclassed
from UUID a JOIN would be required to query them).
'''

from django.db import migrations


CREATE_TRIGGERS = """
-- Create trigger function that checks if UUID exists in plant_tracker_uuid --
CREATE OR REPLACE FUNCTION enforce_uuid_unique() RETURNS trigger AS $$
BEGIN
    -- If existing entry updated and UUID did not change: skip check --
    IF TG_OP = 'UPDATE' AND NEW.uuid IS NOT DISTINCT FROM OLD.uuid THEN
        RETURN NEW;
    END IF;

    -- Confirm new UUID available (raises IntegrityError if already exists) --
    INSERT INTO plant_tracker_uuid (uuid) VALUES (NEW.uuid);

    -- If existing entry updated and UUID did change: release old UUID --
    IF TG_OP = 'UPDATE' THEN
        DELETE FROM plant_tracker_uuid WHERE uuid = OLD.uuid;
    END IF;

    RETURN NEW;
EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'UUID % already used by another Plant/Group', NEW.uuid
        USING ERRCODE = '23505';
END;
$$ LANGUAGE plpgsql;

-- Create trigger function that removes UUID from plant_tracker_uuid --
CREATE OR REPLACE FUNCTION release_uuid() RETURNS trigger AS $$
BEGIN
    DELETE FROM plant_tracker_uuid WHERE uuid = OLD.uuid;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Enforce unique UUID on plant and group models --
CREATE TRIGGER plant_uuid_add_or_update
    BEFORE INSERT OR UPDATE OF uuid ON plant_tracker_plant
    FOR EACH ROW EXECUTE FUNCTION enforce_uuid_unique();
CREATE TRIGGER group_uuid_add_or_update
    BEFORE INSERT OR UPDATE OF uuid ON "plant_tracker_group"
    FOR EACH ROW EXECUTE FUNCTION enforce_uuid_unique();

-- Release UUID after plant or group model entry deleted --
CREATE TRIGGER plant_uuid_delete
    AFTER DELETE ON plant_tracker_plant
    FOR EACH ROW EXECUTE FUNCTION release_uuid();
CREATE TRIGGER group_uuid_delete
    AFTER DELETE ON "plant_tracker_group"
    FOR EACH ROW EXECUTE FUNCTION release_uuid();
"""

UNDO_TRIGGERS = """
DROP TRIGGER IF EXISTS plant_uuid_add_or_update ON plant_tracker_plant;
DROP TRIGGER IF EXISTS group_uuid_add_or_update ON "plant_tracker_group";
DROP TRIGGER IF EXISTS plant_uuid_delete ON plant_tracker_plant;
DROP TRIGGER IF EXISTS group_uuid_delete ON "plant_tracker_group";
DROP FUNCTION IF EXISTS enforce_uuid_unique();
DROP FUNCTION IF EXISTS release_uuid();
"""


class Migration(migrations.Migration):
    dependencies = [
        ('plant_tracker', '0033_populate_existing_uuids'),
    ]

    operations = [
        migrations.RunSQL(CREATE_TRIGGERS, reverse_sql=UNDO_TRIGGERS),
    ]
