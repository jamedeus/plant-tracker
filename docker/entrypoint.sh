#!/bin/bash

# Start celery worker in background
printf "Starting celery worker...\n"
cd /mnt/backend || (printf "FATAL: Unable to find /mnt/backend\n" && exit)
celery -A backend worker --uid "$(id -u celery)" &

# Generate database on first run, apply migrations in new releases
printf "Running database migrations...\n"
python /mnt/backend/manage.py migrate

# Collect staticfiles in backend/staticfiles/
printf "Collecting static files...\n"
python /mnt/backend/manage.py collectstatic --noinput --clear

# Create superuser account if env vars set
if [[ $DJANGO_SUPERUSER_USERNAME && $DJANGO_SUPERUSER_PASSWORD ]]; then
    printf "Creating superuser...\n"
    if [[ $DJANGO_SUPERUSER_EMAIL ]]; then
        python /mnt/backend/manage.py create_superuser \
            --username "$DJANGO_SUPERUSER_USERNAME" \
            --password "$DJANGO_SUPERUSER_PASSWORD" \
            --email "$DJANGO_SUPERUSER_EMAIL"
    else
        python /mnt/backend/manage.py create_superuser \
            --username "$DJANGO_SUPERUSER_USERNAME" \
            --password "$DJANGO_SUPERUSER_PASSWORD"
    fi
fi

printf "\nStarting server...\n"
/usr/local/bin/gunicorn backend.wsgi:application \
    --bind 0:8456 \
    --workers="$GUNICORN_WORKERS" \
    --access-logfile - \
    --access-logformat '%(t)s "%({x-forwarded-for}i)s" "%(r)s" %(s)s %(M)sms %(b)s bytes "%(f)s" "%(a)s"' \
    --error-logfile - \
    --log-level info
