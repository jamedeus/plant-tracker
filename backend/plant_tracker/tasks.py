'''Async tasks run by celery worker to update cached frontend states.'''

from celery import shared_task
from django.conf import settings
from django.core.cache import cache
from django.core.mail import send_mail
from django.contrib.auth import get_user_model
from .get_state_views import build_overview_state


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
