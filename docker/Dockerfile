# syntax=docker/dockerfile:1

# Node dependencies build stage
FROM node:22-bookworm-slim AS node_build

WORKDIR /build

# Copy source and config files
COPY src/ ./src/
COPY .babelrc .
COPY package.json .
COPY package-lock.json .
COPY webpack.config.js .
COPY postcss.config.js .

# Install dependencies, build frontend
RUN npm install
RUN npm run build


# Python dependencies build stage
FROM python:3.13-slim-bookworm AS py_build

COPY Pipfile .
COPY Pipfile.lock .

# Convert pipfile to requirements.txt, install
RUN pip install pipenv
RUN pipenv requirements > requirements.txt
RUN pip install --no-cache-dir -r requirements.txt


# Final build stage
FROM python:3.13-slim-bookworm
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Copy django app
COPY backend/manage.py /mnt/backend/manage.py
COPY backend/backend /mnt/backend/backend
COPY backend/generate_qr_code_grid.py /mnt/backend/generate_qr_code_grid.py
COPY backend/plant_tracker /mnt/backend/plant_tracker

# Copy JS bundles from node build stage
COPY --from=node_build /build/backend/plant_tracker/static/plant_tracker/* /mnt/backend/plant_tracker/static/plant_tracker/

# Copy python dependencies from build stage
COPY --from=py_build /usr/local/lib/python3.13/site-packages/ /usr/local/lib/python3.13/site-packages/

# Copy celery binary from build stage
COPY --from=py_build /usr/local/bin/celery /usr/local/bin/

# Install redis
RUN apt-get update
RUN apt-get install -y redis-server

# Create celery user
RUN groupadd -r celery
RUN useradd -r -g celery celery

# Run migrations, start dev server
COPY docker/entrypoint.sh /mnt/entrypoint.sh
CMD ["/mnt/entrypoint.sh"]
