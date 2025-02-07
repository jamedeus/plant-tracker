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

Copy the [docker-compose.yaml](docker/docker-compose.yaml) example to the machine where you'll host the app. Set the `URL_PREFIX` env var to the address you use to access the app (this will be part of the URL in the QR code stickers). If you have a local DNS setup configure it to point `plants.lan` to your docker host and the included reverse proxy configuration will take care of the rest. You can also use the docker host's IP address with no local DNS/reverse proxy, but it's highly recommended to set a static IP so the QR code links don't break if the IP changes.

Once your docker compose is setup up start the app:
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

This runs celery tasks synchronously (no delay) and uses local memory caching instead of redis. Redis does not need to be installed. Photo uploads are also written to `/tmp/plant_tracker_unit_test` instead of the data dir.

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
