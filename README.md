[![pipeline status](https://gitlab.com/jamedeus/plant-tracker/badges/master/pipeline.svg)](https://gitlab.com/jamedeus/plant-tracker/-/pipelines)
[![coverage report](https://gitlab.com/jamedeus/plant-tracker/badges/master/coverage.svg?job=test_backend&key_text=Backend+Coverage&key_width=120)](https://gitlab.com/jamedeus/plant-tracker/-/commits/master)
[![coverage report](https://gitlab.com/jamedeus/plant-tracker/badges/master/coverage.svg?job=test_frontend&key_text=Frontend+Coverage&key_width=120)](https://gitlab.com/jamedeus/plant-tracker/-/commits/master)
[![pylint score](https://gitlab.com/jamedeus/plant-tracker/-/jobs/artifacts/master/raw/pylint/pylint.svg?job=pylint)](https://gitlab.com/jamedeus/plant-tracker/-/jobs/artifacts/master/raw/pylint/pylint.log?job=pylint)

# Plant Tracker

A Django-powered webapp to track all your house plants. Generate QR code stickers for each plant so you don't have to remember names in the app. QR codes open a registration page the first time they're scanned, after that they take you to a page with the full plant history.

## Features

* Generate QR codes to print on sticker paper
* Log water, fertilize, prune, and repot events
* Add photos (from your camera roll or in the app)
* Write text notes to document detailed plant care
* Create plant groups, water/fertilize all with 1 button
* Timeline for each plant with all events, notes, and photos

## Screenshots

<p align="center">
  <img src="https://gitlab.com/jamedeus/plant-tracker/-/raw/master/screenshots/overview.png" width="30%" alt="Overview page">
  <img src="https://gitlab.com/jamedeus/plant-tracker/-/raw/master/screenshots/manage_plant.png" width="30%" alt="Plant page">
  <img src="https://gitlab.com/jamedeus/plant-tracker/-/raw/master/screenshots/manage_plant_timeline.png" width="30%" alt="Plant timeline">
</p>
<details close>
  <summary>More screenshots</summary>
  <p align="center">
    <img src="https://gitlab.com/jamedeus/plant-tracker/-/raw/master/screenshots/registration.png" width="30%" alt="Registration page">
    <img src="https://gitlab.com/jamedeus/plant-tracker/-/raw/master/screenshots/manage_group.png" width="30%" alt="Plant group page">
    <img src="https://gitlab.com/jamedeus/plant-tracker/-/raw/master/screenshots/manage_plant_note.png" width="30%" alt="Plant note popup">
  </p>
</details>

## Setup

Build the docker image:
```
docker build -t plant-tracker . -f docker/Dockerfile
```

Copy the [docker-compose.yaml](docker/docker-compose.yaml) example to the machine where you'll host the app. Set the `URL_PREFIX` env var to the address you use to access the app (this will be part of the URL in the QR code stickers). This could be a domain if the app is served from behind a reverse proxy, or it can be the docker host's IP address. If hosting on a LAN it is highly recommended to set a static IP so the QR code links don't break if the IP changes.

If serving behind a reverse proxy you may need additional configuration to allow uploading multiple photos at once (eg if serving behind nginx you will need to set `client_max_body_size` to a reasonable value like 50MB).

To serve static files from a CDN like cloudfront uncomment the `STATIC_HOST` env var in docker-compose.yaml and add your CDN URL. When this env var is not set static files will be served by django using whitenoise.

By default user-uploaded photos will be stored locally in `backend/data/images/` (created automatically when server starts). To store photos in AWS S3 instead uncomment the 4 env vars in docker-compose.yaml and add your S3 access tokens, bucket name, and region. The default S3 bucket settings should work fine, including blocking public access (django will add querystring parameters to the URL which grant the user permission for 2 hours).

Once your docker compose is set up start the app:
```
docker compose up -d
```

## Usage

Open the menu in the top-left corner of the homepage to print QR codes (ideally on sticker paper). Each QR code contains a unique UUID that will be added to the database once registered.

Each time you scan a new QR code a registration page will open that lets you create either a plant or group. You can edit all the details later so don't worry too much about it. After registration you'll be redirected to the page for your new plant or group, which you can use to log events, photos, and notes. You can reach this page any time by scanning the QR code again, or by finding the plant on the overview page.

If you create an event accidentally or upload the wrong photo click the 3 dots on the right side of the timeline and use the menu to delete them.

## Development

### Dependencies

Install dependencies:
```
pipenv install
npm install
sudo apt update
sudo apt install -y redis
```

Build frontend when files change:
```
npm run watch
```

### Database

A postgres database is required for development. The easiest way to set this up is docker. Create `docker-compose.yaml` with:
```
services:
  plant-tracker-db:
    image: postgres:17.5
    container_name: plant-tracker-development-db
    environment:
      POSTGRES_DB: plant_tracker
      POSTGRES_USER: postgres
      # Remember to add the DATABASE_PASSWORD env var to your .env
      POSTGRES_PASSWORD: supersecrettestingpassword
    volumes:
      - plant-tracker-development-db:/var/lib/postgresql/data
    ports:
      - 5432:5432
    restart: unless-stopped

volumes:
  filestash:
  plant-tracker-development-db:
```

Run `docker compose up -d` to start the database container.

Then create `.env` at the repository root (same directory as `Pipfile`) and set the database password:
```
DATABASE_PASSWORD=supersecrettestingpassword
```

This will set the env var automatically every time you run `pipenv shell`.

The other database env vars do not need to be set, they will default to the values in the docker-compose above. See [settings.py](backend/backend/settings.py) for all database environment variables.

#### Django debug tools

The development dependencies include both [django debug toolbar](https://django-debug-toolbar.readthedocs.io/en/latest/index.html) and [django silk](https://github.com/jazzband/django-silk) which can be useful for debugging SQL queries. These are only available when the `DEBUG_MODE` env var is set to `True` (this can be done in `.env` for convenience). Only one tool can be used at a time, this can be configured with the `DEBUG_TOOL` env var (set to `toolbar` to use django-debug-toolbar, will default to silk if not set).

When running django-debug-toolbar the development server needs to be run with the `--nothreading` arg.

These tools cannot be used in the docker image (does not include development dependencies).

Note that silk is only able to capture SELECT, UPDATE, and DELETE queries. It cannot capture INSERT queries, so any endpoint which creates a model entry will show fewer queries than the [sql query unit tests](backend/plant_tracker/test_sql_queries.py). Tests for new endpoints that create model entries should be added to ensure they create models efficiently (ideally with bulk_create) and do not make o(n) queries.

#### Caching

This project uses caching extensively to avoid building large context objects multiple times (see [here](backend/plant_tracker/cache_documentation.md) for all cache names). These can break during development if the syntax of a context object changes. Run `redis-cli flushall` to clear all old caches after making changes.

### Full development server setup

The production setup requires a celery worker to handle async tasks and redis as a message queue.

Run django server:
```
pipenv shell
cd backend
python manage.py runserver 0.0.0.0:8000
```

Run celery worker (separate terminal):
```
pipenv shell
cd backend
celery -A backend worker
```

If redis is not running enable the systemd service:
```
sudo systemctl enable --now redis-server
```

### Simplified setup

For quick testing or frontend development everything can be run in a single process by using the unit test settings:

```
pipenv shell
export DJANGO_SETTINGS_MODULE=backend.test_settings
cd backend
python manage.py runserver 0.0.0.0:8000
```

This runs celery tasks synchronously (no delay) and stores cached data in memory using [fakeredis](https://pypi.org/project/fakeredis/). Redis does not need to be installed. Photo uploads are also written to `/tmp/plant_tracker_unit_test` instead of the data dir.

This setup behaves differently than production and should not be used for backend development.

### Unit tests

#### Backend

Django tests should be run with the [test_settings](backend/backend/test_settings.py) (see `--settings` flag below). This prevents the tests writing caches to redis, does not require a celery worker, and prevents writing mock photos to the real data directory.

```
pipenv install --dev
pipenv shell
cd backend
coverage run manage.py test --settings=backend.test_settings
coverage report
```

Note: if the tests are accidentally run without `--settings` the cleanup methods will delete all photo thumbnails and previews (but not originals) in the data directory. These can be regenerated with this management command:
```
python manage.py regenerate_thumbnails
```

#### Frontend

Frontend tests require **node v20.12** or newer (some mocks don't work on earlier versions).

Run tests and print coverage report:
```
npm run test -- --coverage -u
```

Update outdated snapshots and print coverage:
```
npm run test -- --coverage -u
```

## Documentation

See [docs](docs) for sphinx configuration.

See [here](backend/plant_tracker/cache_documentation.md) for redis cache documentation.
