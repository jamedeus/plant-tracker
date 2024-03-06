# syntax=docker/dockerfile:1

# Node dependencies build stage
FROM node:19-buster-slim as node_build

# Copy source and config files
COPY src/ ./src/
COPY .babelrc .
COPY package.json .
COPY package-lock.json .
COPY webpack.config.js .
COPY postcss.config.js .
COPY tailwind.config.js .

# Install dependencies, build frontend
RUN npm install
RUN npm run build


# Python dependencies build stage
FROM python:3.10-slim-buster as py_build

COPY docker/requirements.txt .
RUN pip install --no-cache-dir -r /requirements.txt


# Final build stage
FROM python:3.10-slim-buster
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Copy django app, copy JS bundles from node build stage
COPY backend/manage.py /mnt/backend/manage.py
COPY backend/backend /mnt/backend/backend
COPY backend/generate_qr_code_grid.py /mnt/backend/generate_qr_code_grid.py
COPY backend/plant_tracker /mnt/backend/plant_tracker
RUN rm -r /mnt/backend/plant_tracker/static/plant_tracker/*

COPY --from=node_build backend/plant_tracker/static/plant_tracker/* /mnt/backend/plant_tracker/static/plant_tracker/

# Copy python dependencies from build stage
COPY --from=py_build /usr/local/lib/python3.10/site-packages/ /usr/local/lib/python3.10/site-packages/

# Run migrations, start dev server
COPY docker/entrypoint.sh /mnt/entrypoint.sh
CMD ["/mnt/entrypoint.sh"]
