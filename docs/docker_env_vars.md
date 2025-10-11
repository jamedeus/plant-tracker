# Docker environment variables

## Basic setup

### `BASE_URL` (required)

The base URL where the app is accessed (all others will be blocked).
Will be used to generate QR code URLs (syntax: `<BASE_URL>/manage/<uuid>`).
Should not include protocol.

Example: `plants.joshmedeiros.dev`

### `SECRET_KEY` (required)

A random string used for the django secret key.
If this is not set a random string will be generated each time the container starts (not recommended, will cause issues with session cookies).

### `DATABASE_PASSWORD` (required)

Postgres database password, must match the `plant-tracker-db` container's `POSTGRES_PASSWORD` env var.
There is NO DEFAULT for this variable, if it is not set (or does not match postgres) the app will not start.

### `SINGLE_USER_MODE` (optional)

Disables user accounts and authentication if True.
If not set user accounts will be enabled (requires registration + login).

### `DJANGO_SUPERUSER_USERNAME` (optional)

Username for the django superuser (admin control panel).
If not set the superuser will not be created.

### `DJANGO_SUPERUSER_PASSWORD` (optional)

Password for the django superuser (admin control panel).
If not set the superuser will not be created.

### `DJANGO_SUPERUSER_EMAIL` (optional)

Email for the django superuser (admin control panel).
The superuser can be created with no email (only requires username and password).

### `GUNICORN_WORKERS` (optional)

The number of gunicorn workers to use (defaults to 2 if not set).



## Email (optional)

Public deployments should include SES credentials to send user verification emails.
See [deployment.md](docs/deployment.md#Email) for instructions.

### `SES_SMTP_USER`

Amazon SES SMTP username.

### `SES_SMTP_PASSWORD`

Amazon SES SMTP password.

### `DEFAULT_FROM_EMAIL`

Email address users will see as the sender.

Example: `support@plants.joshmedeiros.dev`



## Static file CDN (optional)

Cloudfront will be used to serve static files (JS + CSS bundles) if the variable below is set.

### `STATIC_URL`

The full cloudfront distribution URL including protocol.

Example: `https://static.plants.joshmedeiros.dev`



## S3 storage (optional)

All variables below must be set to store user-uploaded photos in AWS S3.

### `AWS_ACCESS_KEY_ID`

AWS IAM user public access key ID.
User must have `AmazonS3FullAccess` permission policy (read/write S3 access).
AWS -> IAM -> Access management -> Users -> Create user

### `AWS_SECRET_ACCESS_KEY`

AWS IAM user private access key ID (only shown once when created).
User must have `AmazonS3FullAccess` permission policy (read/write S3 access).
AWS -> IAM -> Access management -> Users -> Create user

### `AWS_STORAGE_BUCKET_NAME`

Name of the S3 bucket to store photos.

### `AWS_S3_REGION_NAME`

Name of the AWS region where the S3 bucket is located.

Example: `us-west-2`

### `IMAGE_URL`

Cloudfront distribution URL or alternate domain name, excluding protocol.
Can be the same as `STATIC_URL` (minus protocol) or different subdomain.

Example: `media.plants.joshmedeiros.dev`

### `CLOUDFRONT_KEY_ID`

Cloudfront key group ID, used for signed cookies (photo access control).
See [deployment.md](docs/deployment.md) for instructions.
Must generate rsa key and upload public key to AWS. The `private_key.pem` must be mounted into the docker container at `/mnt/backend/private_key.pem`.
- If a different location is used the `CLOUDFRONT_PRIVKEY_PATH` env var must be set to that location.



## Database + cache overrides (development only)

The variables below can be used to override the default postgres and redis configuration.

These usually DO NOT need to be set, the default [docker-compose.yaml](docker/docker-compose.yaml) comes with postgres and redis containers configured for the defaults.

These are mostly only useful to connect to non-docker postgres and redis instances (development).

### `DATABASE_HOST`

Postgres database host.
Docker image defaults to `plant-tracker-db` if not set (postgres container name).
When running outside docker this defaults to `127.0.0.1` (local postgres instance).

### `DATABASE_PASSWORD`

Postgres database password - no default, app will not work without setting this.

### `DATABASE_NAME`

Postgres database name (defaults to `plant_tracker` if not set).

### `DATABASE_USER`

Postgres database username (defaults to `postgres` if not set).

### `DATABASE_PORT`

Postgres database port (defaults to `5432` if not set).

### `REDIS_HOST`

Redis host.
Docker image defaults to `plant-tracker-redis` if not set (redis container name).
When running outside docker this defaults to `127.0.0.1` (local redis instance).

### `REDIS_PORT`

Redis port (defaults to `6379` if not set).
