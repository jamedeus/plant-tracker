[![pipeline status](https://gitlab.com/jamedeus/plant-tracker/badges/master/pipeline.svg)](https://gitlab.com/jamedeus/plant-tracker/-/pipelines)
[![coverage report](https://gitlab.com/jamedeus/plant-tracker/badges/master/coverage.svg?job=test_backend&key_text=Backend+Coverage&key_width=120)](https://gitlab.com/jamedeus/plant-tracker/-/commits/master)
[![coverage report](https://gitlab.com/jamedeus/plant-tracker/badges/master/coverage.svg?job=test_frontend&key_text=Frontend+Coverage&key_width=120)](https://gitlab.com/jamedeus/plant-tracker/-/commits/master)
[![pylint score](https://gitlab.com/jamedeus/plant-tracker/-/jobs/artifacts/master/raw/pylint/pylint.svg?job=pylint)](https://gitlab.com/jamedeus/plant-tracker/-/jobs/artifacts/master/raw/pylint/pylint.log?job=pylint)

# Plant Tracker


## Run development server

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

### Full setup

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
