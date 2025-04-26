#!/usr/bin/env python3

'''Stress test script used to simulate user activity and estimate server
requirements for a given number of concurrent users.'''

import time
import string
import random
import urllib
import datetime
from uuid import uuid4
import requests

# URL for overview page (/)
INSTANCE_URL = 'http://localhost:8005/'

# Global var to store reusable CSRF token (jank)
CSRF_TOKEN = None

CLIENT = None

def get_endpoint_url(endpoint):
    '''Takes endpoint relative path, appends to INSTANCE_URL and returns.'''
    return urllib.parse.urljoin(INSTANCE_URL, endpoint)


def get_random_string(length):
    '''Takes int, returns random ASCII string with same length.'''
    return ''.join(random.choice(string.ascii_letters) for _ in range(length))


def get_random_text(length):
    '''Takes int, returns string with same length made up of "words" consisting
    of 1-12 random ASCII characters separated by spaces.
    '''
    text = ''
    while len(text) < length:
        text += get_random_string(random.randrange(1, 12)) + ' '
    return text.strip()[0:length]


def get_csrf_token(client):
    '''Makes GET request to backend, returns csrftoken cookie from response.'''
    client.get(INSTANCE_URL)
    print('GET /')
    return client.cookies['csrftoken']


def get_client():
    '''Create new client and return, or return existing if already exists.'''
    global CLIENT
    if not CLIENT:
        CLIENT = requests.session()
        get_csrf_token(CLIENT)
    return CLIENT


def register_plant(client, uuid):
    '''Takes UUID, registers plant with random strings for each attribute.'''
    response = client.post(
        get_endpoint_url('/register_plant'),
        json={
            'uuid': str(uuid),
            'name': f'stress test plant {random.randrange(1, 99)}',
            'species': get_random_text(random.randrange(12, 24)),
            'description': get_random_text(random.randrange(20, 500)),
            'pot_size': str(random.randrange(2, 18))
        },
        headers={
            'X-CSRFToken': client.cookies['csrftoken']
        },
        timeout=5
    )
    print('POST /register_plant')
    return response


def delete_plant(client, uuid):
    '''Takes UUID, registers plant with random strings for each attribute.'''
    response = client.post(
        get_endpoint_url('/delete_plant'),
        json={
            'plant_id': str(uuid)
        },
        headers={
            'X-CSRFToken': client.cookies['csrftoken']
        },
        timeout=5
    )
    print('POST /delete_plant')
    return response


def create_plant_event(client, uuid, event_type, timestamp):
    '''Takes UUID, event type, and timestamp, creates plant event.'''
    response = client.post(
        get_endpoint_url('/add_plant_event'),
        json={
            'plant_id': str(uuid),
            'event_type': event_type,
            'timestamp': timestamp
        },
        headers={
            'X-CSRFToken': client.cookies['csrftoken']
        },
        timeout=5
    )
    print('POST /add_plant_event')
    return response


def delete_plant_event(client, uuid, event_type, timestamp):
    '''Takes UUID, event type, and timestamp, deletes plant event.'''
    response = client.post(
        get_endpoint_url('/delete_plant_event'),
        json={
            'plant_id': (uuid),
            'event_type': event_type,
            'timestamp': timestamp
        }
    )
    print('POST /delete_plant_event')
    return response


def create_fake_traffic():
    '''Runs infinite loop that creates plant, loads management page, creates
    water and fertilize events, deletes events, deletes plant, and repeats.
    Inserts random delays between each operation to simulate user activity.
    '''
    client = get_client()
    while True:
        # Create constants for this loop
        plant_id = str(uuid4())
        event_timestamp = datetime.datetime.now().isoformat()

        # Register plant, wait 300-1200ms
        register_plant(client, plant_id)
        time.sleep(random.randrange(300, 1200) / 1000)

        # Load manage plant page (force to build state)
        client.get(f'{INSTANCE_URL}/manage/{plant_id}')
        print(f'GET {INSTANCE_URL}/manage/{plant_id}')

        # Water plant, wait 50-400ms
        create_plant_event(client, plant_id, 'water', event_timestamp)
        time.sleep(random.randrange(50, 400) / 1000)

        # Fertilize plant, wait 50-400ms
        create_plant_event(client, plant_id, 'fertilize', event_timestamp)
        time.sleep(random.randrange(50, 400) / 1000)

        # Delete both plant events separately
        delete_plant_event(client, plant_id, 'water', event_timestamp)
        time.sleep(random.randrange(50, 200) / 1000)
        delete_plant_event(client, plant_id, 'fertilizer', event_timestamp)

        # Load overview page, wait, 800-1200ms
        client.get(INSTANCE_URL)
        print('GET /')
        time.sleep(random.randrange(800, 1200) / 1000)

        # Delete plant, wait 300-2500ms before next loop
        delete_plant(client, plant_id)
        time.sleep(random.randrange(300, 2500) / 1000)
