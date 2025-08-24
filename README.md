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

### Reverse proxy

Serving behind a reverse proxy like nginx is highly recommended for security. You may need additional configuration to allow uploading multiple photos at once. If serving behind nginx you will need to set `client_max_body_size` to a reasonable value like 50MB.

### Static file CDN

By default static files will be served by django using whitenoise. To serve from a CDN instead uncomment the `STATIC_URL` env var in docker-compose.yaml and add your CDN URL. This can speed up page loads and take load off the django backend.

If using cloudfront go to your distribution -> Behaviors -> Edit and make sure `Cache policy` is set to `CachingOptimized` so that cloudfront can store each static file and serve from the cache (much faster). This is disabled by default which will perform worse than no CDN at all (cloudfront will just request the static files from django every time).

### User photo storage

By default user-uploaded photos will be stored locally in `backend/data/images/` (created automatically when server starts).

To store photos in AWS S3 you will need an S3 bucket with public access disabled and a Cloudfront distribution to cache the thumbnails. Original and preview resolutions will be served from S3 and require signed URLs to access, thumbnails are served from Cloudfront and are fully public (their URLs are cached in the overview state, so they can't have querystring auth params because once they expire the cache will be stale).

First create an S3 bucket (the default settings should work fine, including blocking public access - django will add querystring parameters to the URL which grant access for 2 hours). You'll also need to go to Identity Access Management and get tokens for django to access the bucket.

Then go to Cloudfront and create a distribution with default settings. Add an origin and select your S3 bucket. Set Origin access to `Origin access control settings` and create a new OAC with signing behavior set to `Sign requests`. Then go to Behaviors -> Create behavior and select:
- Path pattern: `thumbnails/*`
- Origin: Your S3 bucket
- Compress objects automatically: `Yes`
- Restrict viewer access: `No`
- Cache policy: `CachingOptimized`

To prevent access to the full-resolution photos through the CDN edit the default behavior and set Restrict viewer access to Yes (you can select Trusted signer -> Self to disable all access to everything that isn't covered by one of your other behaviors).

Finally go back to Cloudfront Origins, select your S3 origin, click edit, and click "Copy policy" under origin access control. Then go to your S3 bucket -> Permissions -> Bucket policy, paste the JSON policy, and save (you might want to add `thumbnails/*` to the end of the URI in `Resource` so that Cloudfront can only access that folder, but even without this users won't be able to access anything outside of thumbnails because of the behaviors settings).

Once everything is set up in AWS go back to `docker-compose.yaml` and set these 5 env vars:
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_STORAGE_BUCKET_NAME`
- `AWS_S3_REGION_NAME`
- `THUMBNAIL_CDN_DOMAIN` (cloudfront distribution, domain only no https://)

Django will automatically create `images`, `previews`, and `thumbnails` folders in the bucket for each photo resolution.

### Workers

By default gunicorn will use 2 workers, which is good for a single core VPS. If your server is more powerful uncomment the `GUNICORN_WORKERS` env var and set it to the number of workers you need (usually 2-4 times number of CPU cores).

### Starting the docker container

Once your docker compose is set up start the app:
```
docker compose up -d
```

## Usage

Open the menu in the top-left corner of the homepage to print QR codes (ideally on sticker paper). Each QR code contains a unique UUID that will be added to the database once registered.

Each time you scan a new QR code a registration page will open that lets you create either a plant or group. You can edit all the details later so don't worry too much about it. After registration you'll be redirected to the page for your new plant or group, which you can use to log events, photos, and notes. You can reach this page any time by scanning the QR code again, or by finding the plant on the overview page.

If you create an event accidentally or upload the wrong photo click the 3 dots on the right side of the timeline and use the menu to delete them.

## Development

The simplest way to start a development server is with `development-docker-compose.yaml`, which includes postgres and nginx containers as well as an nginx proxy for HTTPS (some features like opening the camera to scan a QR code will not work over http due to browser policies). This setup mirrors the entire repository into a container where the development server runs, so changes made outside the container will automatically take effect inside.

Before starting the container run `npm install` and `npm run watch` to build the frontend bundles.

To use HTTPS you'll also need to create a `certs/` directory for the reverse proxy. Self-signed certs will not work, you'll need to generate a certificate authority, sign the certs with it, and then install the CA cert on your phone so that the SSL certs will be trusted. Set the `BASE_URL` and `VIRTUAL_HOST` env vars in `development-docker-compose.yaml` to the domain in your certs. You'll also need a local DNS setup to point that domain to your dev server IP.

Once that's done start the server with:
```
docker compose --file development-docker-compose.yaml up --abort-on-container-exit
```

The app can now be accessed at [`http://localhost:8456`](http://localhost:8456) or at your `VIRTUAL_HOST` if using SSL.
- To access django admin add `/admin/`.
- To access django-silk (database query debugging) add `/silk/`.
- To switch from silk to django-debug-toolbar change the `DEBUG_TOOL` env var to `toolbar` and restart the container.

For baremetal development setup instructions see [here](docs/development.md).

### Troubleshooting

The development docker compose uses volumes to store python dependencies so they aren't reinstalled every time it starts up. It should still pick up new dependencies when they are added to Pipfile, since it generates the requirements.txt file every time it starts. However it will not uninstall dependencies that are removed from Pipfile, which can mask failures (eg if the removed dependency is still imported somewhere it will still work in the development container, but a production build would fail). To clear all the dependency volumes run these commands:
```
docker compose -f development-docker-compose.yaml rm -fsv
docker volume rm plant-tracker_pipcache
docker volume rm plant-tracker_pydeps
docker volume rm plant-tracker_pybin
```

The development setup also uses a volume to store the postgres database so data persists between runs. To clear this run:
```
docker compose -f development-docker-compose.yaml rm -fsv
docker volume rm plant-tracker_plant-tracker-database-dev
```

There is also a volume for the redis cache, which can contain outdated cached overview states in some cases. To fix this you can remove the volume with:
```
docker compose -f development-docker-compose.yaml rm -fsv
docker volume rm plant-tracker_plant-tracker-redis-data-dev
```

Or clear the cache in a running container with:
```
docker exec -it redis-dev /bin/bash
redis-cli flushall
```

### Unit tests

#### Backend

Django tests should be run with the [test_settings](backend/backend/test_settings.py) (see `--settings` flag below). This prevents the tests writing caches to redis, does not require a celery worker, and prevents writing mock photos to the real data directory.

```
pipenv install --dev
pipenv shell
cd backend
coverage run manage.py test --settings=backend.test_settings --parallel 16
coverage combine
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

See [here](docs/sphinx) for sphinx configuration.

See [here](docs/cache_documentation.md) for redis cache documentation.

See [here](docs/development.md) for baremetal development server setup instructions.
