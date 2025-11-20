# Development setup

This document describes how to set up a baremetal development server without containers (except for the database). For a simpler 1-command setup see the main [README](../README.md).

This setup does not include a reverse proxy for SSL. Everything should work if you load the webpage on localhost, but when loading on a mobile device features that require SSL will not work (eg anything that uses the camera). The containerized development setup covered in the main [README](../README.md) does include a reverse proxy.

## Dependencies

### Backend

Copy the `.env.example` to set env vars automatically when the venv is activated:
```
cp .env.example .env
```

Install python dependencies, redis, and cairosvg (used for QR code logos):
```
pipenv install --dev
sudo apt update
sudo apt install -y redis
sudo apt install -y --no-install-recommends libcairo2
```

### Frontend

Install dependencies, rebuild when files change:
```
npm install
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
  plant-tracker-development-db:
```

Run `docker compose up -d` to start the database container.

Make sure the `DATABASE_PASSWORD` env var in `.env` matches what you set in the container:
```
DATABASE_PASSWORD=supersecrettestingpassword
```

This will set the env var automatically every time you run `pipenv shell`.

The other database env vars will default to the values in the docker-compose above, so they don't need to be set unless you change them.

See [settings.py](backend/backend/settings.py) for all database environment variables.

#### Database debug tools

The development dependencies include both [django debug toolbar](https://django-debug-toolbar.readthedocs.io/en/latest/index.html) and [django silk](https://github.com/jazzband/django-silk) which can be useful for debugging SQL queries. These are only available when the `DEBUG_MODE` env var is set to `True` (this can be done in `.env` for convenience).

Only one tool can be used at a time. Silk is enabled by default, to switch to django-debug-toolbar set the `DEBUG_TOOL` env var to `toolbar`.

When running django-debug-toolbar the development server needs to be run with the `--nothreading` arg.

These tools cannot be used in the docker image (does not include development dependencies).

Note that silk is only able to capture SELECT, UPDATE, and DELETE queries. It cannot capture INSERT queries, so any endpoint which creates a model entry will show fewer queries than the [sql query unit tests](backend/plant_tracker/test_sql_queries.py). Tests for new endpoints that create model entries should be added to ensure they create models efficiently (ideally with bulk_create) and do not make o(n) queries.

## Starting the development server

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

The app can now be accessed at [http://localhost:8000](http://localhost:8000).

### File storage

User-uploaded photos will be written to `backend/data/images/` unless the AWS S3 env vars are set in `.env`.

### Caching

In addition to being the celery task queue redis is also used to cache data for the backend. The most important example is the overview page context, which is expensive to build, so it is stored in redis and updated incrementally by views. Avoiding a full rebuild speeds up page load and improves scaling.

During development cached overview contexts can become out of date (especially if database modified manually), if this happens run `redis-cli flushall` to clear all cache entries.

Caching is also used by some endpoints to store small bits of info temporarily, see [here](docs/cache_documentation.md) for all cache names.
