"""Model for tracking whether a user's email address has been verified."""

from django.db import models
from django.conf import settings
from django.utils import timezone


class UserEmailVerification(models.Model):
    '''Tracks email verification status for a User.'''

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="email_verification",
    )

    is_email_verified = models.BooleanField(default=False)

    # Track when verification email was sent and when it was verified
    verification_sent_at = models.DateTimeField(blank=True, null=True)
    verified_at = models.DateTimeField(blank=True, null=True)

    created = models.DateTimeField(auto_now_add=True)
    updated = models.DateTimeField(auto_now=True)

    def mark_verified(self):
        '''Mark the user as verified and set timestamp.'''
        if not self.is_email_verified:
            self.is_email_verified = True
            self.verified_at = timezone.now()
            self.save(update_fields=["is_email_verified", "verified_at", "updated"])
