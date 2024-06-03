#!/bin/bash

# Start redis-server (celery message broker)
printf "Starting redis server...\n"
service redis-server start

# Start celery worker in background
printf "Starting celery worker...\n"
cd /mnt/backend || (printf "FATAL: Unable to find /mnt/backend\n" && exit)
celery -A backend worker --uid "$(id -u celery)" &

# Generate database on first run, apply migrations in new releases
printf "Running database migrations...\n"
python /mnt/backend/manage.py migrate

# Create superuser account if env vars set
if [[ $DJANGO_SUPERUSER_USERNAME && $DJANGO_SUPERUSER_PASSWORD ]]; then
    printf "Creating superuser...\n"
    if [[ $DJANGO_SUPERUSER_EMAIL ]]; then
        python /mnt/backend/manage.py create_superuser \
            --username $DJANGO_SUPERUSER_USERNAME \
            --password $DJANGO_SUPERUSER_PASSWORD \
            --email $DJANGO_SUPERUSER_EMAIL
    else
        python /mnt/backend/manage.py create_superuser \
            --username $DJANGO_SUPERUSER_USERNAME \
            --password $DJANGO_SUPERUSER_PASSWORD
    fi
fi

printf "\nStarting server...\n"
python /mnt/backend/manage.py runserver 0:8456
