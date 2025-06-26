#!/bin/bash

# Functions used to clone database and images from home server to dev machine.
#
# Assumptions:
#   - Server stores images in ~/docker/plants (mounted into /mnt/backend/data)
#   - Server plant tracker image name is "plant-tracker"
#   - Dev machine has $HOME/docker/docker-compose.yaml with postgres container
#   - Dev machine postgres container does not have volume (ie all data is lost
#     if the container is stopped and removed, this is used to clear test db)
#
# Usage:
#   source clone_prod_data.sh
#   clone_prod_data
#
# To clear data and restore backups again (without rebuilding backups):
#   clear_development_database
#   restore_backups
#
# To remove old backups:
#   delete_old_backups
#

SERVER_HOST="nas"
SERVER_USER="jamedeus"
DEV_POSTGRES_CONTAINER="plant-tracker-db"

backup() {
    # Back up images
    tar cf "$HOME/$(date +%Y_%m_%d)_plant_tracker_images.tar" -C "$HOME/docker/plants" .

    # Dump database
    docker exec plant-tracker bash -c "python /mnt/backend/manage.py dumpdata \
        --natural-foreign \
        --natural-primary \
        --exclude auth.permission \
        --indent 2 > /mnt/data.json"

    # Copy database dump from docker container to host home folder
    docker cp plant-tracker:/mnt/data.json $HOME/$(date +%Y_%m_%d)_plant_tracker_database.json
}

copy_backups() {
    # Copy image and database backups from server
    scp $SERVER_HOST:/home/$SERVER_USER/$(date +%Y_%m_%d)_plant_tracker_images.tar .
    scp $SERVER_HOST:/home/$SERVER_USER/$(date +%Y_%m_%d)_plant_tracker_database.json .
}

restore_backups() {
    # Migrate before unpacking images (migration will delete thumbnails)
    python manage.py migrate
    python manage.py loaddata "$(date +%Y_%m_%d)_plant_tracker_database.json"
    # Unpack images
    rm -rf data
    mkdir data
    tar xf $(date +%Y_%m_%d)_plant_tracker_images.tar --directory=data
}

delete_old_backups() {
    rm *_plant_tracker_images.tar
    rm *_plant_tracker_database.json
}

# Assumes postgres container has no volume
clear_development_database() {
    docker stop $DEV_POSTGRES_CONTAINER
    docker rm $DEV_POSTGRES_CONTAINER
    docker compose -f $HOME/docker/docker-compose.yaml up -d
    sleep 5
}

clone_prod_data() {
    # Create backups on server, copy to dev machine
    ssh $SERVER_HOST "$(declare -f backup); backup"
    copy_backups
    # Clear current development database
    clear_development_database
    # Load backups on dev machine
    restore_backups
}

restart() {
    clear_development_database
    restore_backups
    redis-cli flushall
    py manage.py runserver 0.0.0.0:8005 --nothreading
}

# Requires path to fixture as first arg
load_fixture() {
    clear_development_database
    python manage.py migrate
    python manage.py loaddata $1
    py manage.py runserver 0.0.0.0:8005 --nothreading
}
