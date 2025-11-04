'''Async tasks run by celery worker to update cached frontend states.'''

from celery import shared_task
from django.conf import settings
from django.core.cache import cache
from django.core.mail import send_mail
from django.contrib.auth import get_user_model
from .models import Photo
from .get_state_views import build_overview_state, update_cached_overview_details_keys


@shared_task
def send_verification_email(user_email, uidb64, token):
    '''Send verification email to new user.'''
    verification_url = f"https://{settings.BASE_URL}/accounts/verify/{uidb64}/{token}"
    send_mail(
        subject='Verify your account',
        message=f'Click to verify: {verification_url}',
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user_email],
    )


@shared_task()
def update_cached_overview_state(user_pk):
    '''Takes user primary key, builds and caches overview state.'''
    user = get_user_model().objects.get(pk=user_pk)
    build_overview_state(user)
    print(f'Rebuilt overview state for {user_pk}')


@shared_task()
def update_all_cached_states():
    '''Updates all cached overview states that have keys in redis store.
    Called when server starts to prevent serving outdated states.
    '''

    # Find cached overview states, parse user primary key from name, rebuild
    for key in cache.keys('overview_state_*'):
        update_cached_overview_state.delay(key.split('_')[-1])


@shared_task()
def process_photo_upload(photo_pk):
    '''Generates thumbnails for a pending photo upload.'''
    try:
        photo = Photo.objects.select_related(
            'plant',
            'plant__default_photo'
        ).get(pk=photo_pk)
    except Photo.DoesNotExist:
        cache.set(
            f"pending_photo_upload_{photo_pk}",
            {'status': 'failed'}
        )
        return

    # Generate thumbnails
    try:
        photo.finalize_upload()
    except Exception as error:
        cache.set(
            f"pending_photo_upload_{photo_pk}",
            {'status': 'failed', 'plant_id': str(photo.plant.uuid)}
        )
        raise error

    # Update pending upload cache key and add details if successful
    cache.set(
        f"pending_photo_upload_{photo_pk}",
        {
            'status': 'complete',
            'plant_id': str(photo.plant.uuid),
            'photo_details': photo.get_details()
        }
    )

    # Update thumbnail in cached overview state unless default photo set
    # (most-recent may have changed)
    if not photo.plant.default_photo:
        update_cached_overview_details_keys(
            photo.plant,
            {'thumbnail': photo.plant.get_thumbnail_url()}
        )
