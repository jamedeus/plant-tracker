#!/bin/bash

printf "Running database migrations...\n"
python /mnt/backend/manage.py migrate
printf "\nStarting server...\n"
python /mnt/backend/manage.py runserver 0:8456
