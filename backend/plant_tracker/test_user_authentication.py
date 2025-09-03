# pylint: disable=missing-docstring,too-many-lines,too-many-public-methods,global-statement,duplicate-code

import re
from uuid import uuid4
from urllib.parse import urlencode, urlsplit
from unittest.mock import patch

from django.core import mail
from django.contrib import auth
from django.conf import settings
from django.test import TestCase
from django.core.cache import cache
from django.contrib.auth import get_user_model
from django.test.utils import override_settings
from django.test.client import MULTIPART_CONTENT
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode

from .view_decorators import get_default_user
from .models import Plant, Group, UserEmailVerification
from .auth_views import email_verification_token_generator
from .unit_test_helpers import (
    JSONClient,
    create_mock_photo,
    enable_isolated_media_root,
    cleanup_isolated_media_root,
)

user_model = get_user_model()


OVERRIDE = None
MODULE_MEDIA_ROOT = None


def setUpModule():
    global OVERRIDE, MODULE_MEDIA_ROOT
    OVERRIDE, MODULE_MEDIA_ROOT = enable_isolated_media_root()


def tearDownModule():
    # Delete mock photo directory after tests
    print("\nDeleting mock photos...\n")
    cleanup_isolated_media_root(OVERRIDE, MODULE_MEDIA_ROOT)


class AuthenticationPageTests(TestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.test_user = user_model.objects.create_user(
            username='unittest',
            password='12345',
            first_name='Bob',
            last_name='Smith',
            email='bob.smith@hotmail.com'
        )
        UserEmailVerification.objects.create(user=cls.test_user)

    def setUp(self):
        # Clear entire cache before each test
        cache.clear()

        # Set default content_type for post requests (avoid long lines)
        self.client = JSONClient()

        # Ensure SINGLE_USER_MODE is disabled
        settings.SINGLE_USER_MODE = False

    def tearDown(self):
        # Ensure user logged out between tests
        self.client.logout()

    def test_login_page(self):
        # Request login page, confirm returns SPA
        response = self.client.get('/accounts/login/')
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'plant_tracker/index.html')

    def test_user_profile_page(self):
        # Log in with test user
        self.client.login(username='unittest', password='12345')

        # Request profle page, confirm returns SPA
        response = self.client.get('/accounts/profile/')
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'plant_tracker/index.html')

        # Request user details, confirm returns current user account details
        response = self.client.get('/accounts/get_user_details/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {
            'user_details': {
                'username': 'unittest',
                'email': 'bob.smith@hotmail.com',
                'email_verified': False,
                'first_name': 'Bob',
                'last_name': 'Smith',
                'date_joined': self.test_user.date_joined.isoformat()
            },
            'title': 'User Profile'
        })

    def test_user_profile_page_not_signed_in(self):
        # Request user profile page without signing in
        self.assertFalse(auth.get_user(self.client).is_authenticated)
        response = self.client.get('/accounts/profile/')

        # Confirm redirected to login page with requested URL in querystring
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.url, '/accounts/login/?next=/accounts/profile/')


class AuthenticationEndpointTests(TestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.test_user = user_model.objects.create_user(
            username='unittest',
            password='12345',
            first_name='Bob',
            last_name='Smith',
            email='bob.smith@hotmail.com'
        )

    def setUp(self):
        # Clear entire cache before each test
        cache.clear()

        # Set default content_type for post requests (avoid long lines)
        self.client = JSONClient()

        # Ensure SINGLE_USER_MODE is disabled
        settings.SINGLE_USER_MODE = False

    def tearDown(self):
        # Ensure user logged out between tests
        self.client.logout()

    def test_login_with_valid_credentials(self):
        # POST valid credentials to login endpoint
        response = self.client.post(
            "/accounts/login/",
            urlencode({"username": "unittest", "password": "12345"}),
            content_type="application/x-www-form-urlencoded"
        )

        # Confirm returns JSON response with status 200 (not 302)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"success": "logged in"})

    def test_login_with_valid_email_address(self):
        # POST valid credentials with email in username field to login endpoint
        response = self.client.post(
            "/accounts/login/",
            urlencode({"username": "bob.smith@hotmail.com", "password": "12345"}),
            content_type="application/x-www-form-urlencoded"
        )

        # Confirm returns JSON response with status 200 (not 302)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"success": "logged in"})

    def test_login_with_invalid_credentials(self):
        # POST invalid credentials to login endpoint
        response = self.client.post(
            "/accounts/login/",
            urlencode({"username": "unittest", "password": "wrong"}),
            content_type="application/x-www-form-urlencoded"
        )

        # Confirm returns JSON response with status 400 (not 302)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {
            "errors": {
                "__all__": [
                    # pylint: disable-next=line-too-long
                    "Please enter a correct username and password. Note that both fields may be case-sensitive."
                ]
            }
        })

    def test_login_as_default_user(self):
        # Attempt to log in as default user (does not have password)
        response = self.client.post(
            "/accounts/login/",
            urlencode({"username": settings.DEFAULT_USERNAME, "password": ""}),
            content_type="application/x-www-form-urlencoded"
        )

        # Confirm login rejected (default user only used when SINGLE_USER_MODE
        # is enabled, default user does not need to log in)
        self.assertEqual(response.status_code, 400)

    def test_login_with_missing_parameters(self):
        # POST invalid credentials with no password to login endpoint
        response = self.client.post(
            "/accounts/login/",
            urlencode({"username": "unittest", "password": ""}),
            content_type="application/x-www-form-urlencoded"
        )

        # Confirm returns JSON response with status 400 (not 302)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {
            "errors": {
                "password": [
                    "This field is required."
                ]
            }
        })

    def test_logout_endpoint(self):
        # Log in with test user, confirm authenticated
        self.client.login(username='unittest', password='12345')
        self.assertTrue(auth.get_user(self.client).is_authenticated)

        # Request logout endpoint, confirm no longer authenticated
        response = self.client.get('/accounts/logout/')
        self.assertFalse(auth.get_user(self.client).is_authenticated)

        # Confirm redirected to login page
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.url, '/accounts/login/')

        # Request logout endpoint while not signed in, confirm still redirected
        response = self.client.get('/accounts/logout/')
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.url, '/accounts/login/')

    def test_create_user_endpoint(self):
        # Confirm 2 users in database (default + test user from setUpClass)
        self.assertEqual(len(user_model.objects.all()), 2)

        # Post new account credentials to create_user endpoint
        response = self.client.post('/accounts/create_user/', {
            'username': 'newuser',
            'password': 'acceptablepasswordlength',
            'email': 'myfirstemail@hotmail.com',
            'first_name': '',
            'last_name': ''
        })

        # Confirm expected response
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"success": "account created"})

        # Confirm user created in database, did not store password as cleartext
        self.assertEqual(len(user_model.objects.all()), 3)
        user = user_model.objects.get(username='newuser')
        self.assertNotEqual(user.password, 'acceptablepasswordlength')

        # Confirm email verification record was created, is not verified
        verification = UserEmailVerification.objects.get(user=user)
        self.assertFalse(verification.is_email_verified)

    def test_create_user_sends_verification_email(self):
        # Confirm 2 users in database (default + test user from setUpClass)
        self.assertEqual(len(user_model.objects.all()), 2)

        with patch('plant_tracker.auth_views.send_verification_email.delay') as mock_delay:
            response = self.client.post('/accounts/create_user/', {
                'username': 'newuser',
                'password': 'acceptablepasswordlength',
                'email': 'myfirstemail@hotmail.com',
                'first_name': '',
                'last_name': ''
            })

        self.assertEqual(response.status_code, 200)

        # Confirm task was queued with expected params
        self.assertTrue(mock_delay.called)
        args, _ = mock_delay.call_args
        # args: (email, uidb64, token)
        self.assertEqual(args[0], 'myfirstemail@hotmail.com')
        new_user = user_model.objects.get(username='newuser')
        expected_uidb64 = urlsafe_base64_encode(force_bytes(new_user.pk))
        self.assertEqual(args[1], expected_uidb64)
        self.assertTrue(email_verification_token_generator.check_token(new_user, args[2]))

    def test_create_user_endpoint_missing_fields(self):
        # Confirm 2 users in database (default + test user from setUpClass)
        self.assertEqual(len(user_model.objects.all()), 2)

        # Post payload with no username to create_user endpoint
        response = self.client.post('/accounts/create_user/', {
            'username': '',
            'password': 'acceptablepasswordlength',
            'email': 'myfirstemail@hotmail.com',
            'first_name': '',
            'last_name': ''
        })

        # Confirm expected response
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"error": ["missing required field"]})

        # Confirm no user created in database
        self.assertEqual(len(user_model.objects.all()), 2)

    def test_create_user_endpoint_duplicate_username(self):
        # Confirm 2 users in database (default + test user from setUpClass)
        self.assertEqual(len(user_model.objects.all()), 2)

        # Post same username as existing test user to create_user endpoint
        response = self.client.post('/accounts/create_user/', {
            'username': 'unittest',
            'password': 'acceptablepasswordlength',
            'email': 'myfirstemail@hotmail.com',
            'first_name': '',
            'last_name': ''
        })

        # Confirm expected response
        self.assertEqual(response.status_code, 409)
        self.assertEqual(
            response.json(),
            {"error": ["username already exists"]}
        )

        # Confirm no user created in database
        self.assertEqual(len(user_model.objects.all()), 2)

    def test_create_user_endpoint_duplicate_email(self):
        # Confirm 2 users in database (default + test user from setUpClass)
        self.assertEqual(len(user_model.objects.all()), 2)

        # Post same email as existing test user to create_user endpoint
        response = self.client.post('/accounts/create_user/', {
            'username': 'newuser',
            'password': 'acceptablepasswordlength',
            'email': 'bob.smith@hotmail.com',
            'first_name': '',
            'last_name': ''
        })

        # Confirm expected response
        self.assertEqual(response.status_code, 409)
        self.assertEqual(
            response.json(),
            {"error": ["email already exists"]}
        )

        # Confirm no user created in database
        self.assertEqual(len(user_model.objects.all()), 2)

    def test_create_user_endpoint_invalid_email(self):
        # Confirm 2 users in database (default + test user from setUpClass)
        self.assertEqual(len(user_model.objects.all()), 2)

        # Post email address with invalid syntax to create_user endpoint
        response = self.client.post('/accounts/create_user/', {
            'username': 'newuser',
            'password': 'acceptablepasswordlength',
            'email': 'bob.smith',
            'first_name': '',
            'last_name': ''
        })

        # Confirm expected response
        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.json(),
            {"error": ["Enter a valid email address."]}
        )

        # Confirm no user created in database
        self.assertEqual(len(user_model.objects.all()), 2)

    def test_create_user_endpoint_common_password(self):
        # Confirm 2 users in database (default + test user from setUpClass)
        self.assertEqual(len(user_model.objects.all()), 2)

        # Post password that is on the banned common passwords list
        response = self.client.post('/accounts/create_user/', {
            'username': 'newuser',
            'password': 'password',
            'email': 'myfirstemail@hotmail.com',
            'first_name': '',
            'last_name': ''
        })

        # Confirm expected response
        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.json(),
            {"error": ["This password is too common."]}
        )

        # Confirm no user created in database
        self.assertEqual(len(user_model.objects.all()), 2)

    def test_change_password_endpoint(self):
        # Log in with test user
        self.client.login(username='unittest', password='12345')

        # Post old and new passwords to change_password endpoint
        response = self.client.post('/accounts/change_password/',
            urlencode({
                'old_password': '12345',
                'new_password1': 'more secure password',
                'new_password2': 'more secure password',
            }),
            content_type="application/x-www-form-urlencoded"
        )

        # Confirm success response
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"success": "password changed"})

        # Confirm did not store password as cleartext
        user = user_model.objects.get(username='unittest')
        self.assertNotEqual(user.password, 'more secure password')

    def test_resend_verification_email_endpoint(self):
        # Log in with test user
        self.client.login(username='unittest', password='12345')

        # Request new verification email
        with patch('plant_tracker.auth_views.send_verification_email.delay') as mock_delay:
            response = self.client.get('/accounts/resend_verification_email/')

        # Confirm success response
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"success": "verification email sent"})

        # Confirm task was queued to resend email
        self.assertTrue(mock_delay.called)
        args, _ = mock_delay.call_args
        self.assertEqual(args[0], 'bob.smith@hotmail.com')
        expected_uidb64 = urlsafe_base64_encode(force_bytes(self.test_user.pk))
        self.assertEqual(args[1], expected_uidb64)
        # Confirm token in email is valid
        self.test_user.refresh_from_db()
        self.assertTrue(email_verification_token_generator.check_token(self.test_user, args[2]))

    def test_change_password_endpoint_errors(self):
        # Log in with test user
        self.client.login(username='unittest', password='12345')

        # Post new passwords that do not match to change_password endpoint
        response = self.client.post('/accounts/change_password/',
            urlencode({
                'old_password': '12345',
                'new_password1': 'more secure password',
                'new_password2': 'nore secure password',
            }),
            content_type="application/x-www-form-urlencoded"
        )

        # Confirm expected error response
        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.json()['errors'],
            {'new_password2': ['The two password fields didn’t match.']}
        )

    def test_change_password_endpoint_default_user(self):
        # Log in with default user (should not be possible in prod)
        self.client.force_login(get_default_user())

        # Post old and new passwords to change_password endpoint
        response = self.client.post('/accounts/change_password/',
            urlencode({
                'old_password': '',
                'new_password1': 'more secure password',
                'new_password2': 'more secure password',
            }),
            content_type="application/x-www-form-urlencoded"
        )

        # Confirm expected error (refuses to change default user password)
        self.assertEqual(response.status_code, 403)
        self.assertEqual(
            response.json(),
            {"error": "cannot change default user password"}
        )

    @override_settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend')
    def test_password_reset_endpoint_with_username(self):
        mail.outbox.clear()
        response = self.client.post(
            '/accounts/password_reset/',
            urlencode({'email': 'unittest'}),
            content_type='application/x-www-form-urlencoded'
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"success": "password reset email sent"})
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn('Reset your Plant Tracker password', mail.outbox[0].subject)

    @override_settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend')
    def test_password_reset_endpoint_with_email(self):
        mail.outbox.clear()
        response = self.client.post(
            '/accounts/password_reset/',
            urlencode({'email': 'bob.smith@hotmail.com'}),
            content_type='application/x-www-form-urlencoded'
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"success": "password reset email sent"})
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn('Reset your Plant Tracker password', mail.outbox[0].subject)

    @override_settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend')
    def test_password_reset_endpoint_unknown_email(self):
        mail.outbox.clear()
        response = self.client.post(
            '/accounts/password_reset/',
            urlencode({'email': 'doesnotexist'}),
            content_type='application/x-www-form-urlencoded'
        )
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json(), {"error": "account not found"})
        self.assertEqual(len(mail.outbox), 0)

    @override_settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend')
    def test_password_reset_endpoint_invalid_get_request(self):
        mail.outbox.clear()
        response = self.client.get('/accounts/password_reset/')
        self.assertEqual(response.status_code, 405)
        self.assertEqual(response.json(), {'error': 'must post data'})
        self.assertEqual(len(mail.outbox), 0)

    @override_settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend')
    def test_password_reset_endpoint_form_invalid(self):
        mail.outbox.clear()
        # Send request with missing email field, confirm expected error response
        response = self.client.post(
            '/accounts/password_reset/',
            urlencode({}),
            content_type='application/x-www-form-urlencoded'
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn('errors', response.json())
        # Confirm no email was sent
        self.assertEqual(len(mail.outbox), 0)

    @override_settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend')
    def test_password_reset_link_loads_and_changes_password(self):
        # Request password_reset endpoint to generate reset link
        mail.outbox.clear()
        response = self.client.post(
            '/accounts/password_reset/',
            urlencode({'email': 'unittest'}),
            content_type='application/x-www-form-urlencoded'
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(mail.outbox), 1)

        # Extract reset URL from email body
        body = mail.outbox[0].body
        match = re.search(r"https?://[^\s]+/accounts/reset/[^\s]+/[^\s]+/", body)
        self.assertIsNotNone(match)
        reset_url = match.group(0)
        reset_path = urlsplit(reset_url).path

        # Confirm first GET redirects to /set-password/ (renders form)
        first = self.client.get(reset_path)
        self.assertEqual(first.status_code, 302)
        self.assertRegex(first.url, r"^/accounts/reset/[A-Za-z0-9_\-]+/set-password/\Z")

        # Load /set-password/ page, confirm returns SPA
        page = self.client.get(first.url)
        self.assertEqual(page.status_code, 200)
        self.assertTemplateUsed(page, 'plant_tracker/index.html')

        # Simulate user submitting form with new password
        post_response = self.client.post(
            first.url,
            urlencode({
                'new_password1': 'a password I can actually remember',
                'new_password2': 'a password I can actually remember',
            }),
            content_type='application/x-www-form-urlencoded'
        )
        self.assertEqual(post_response.status_code, 200)
        self.assertEqual(post_response.json(), {"success": "password changed"})

        # Confirm user is now authenticated and password was changed
        self.assertTrue(auth.get_user(self.client).is_authenticated)
        user = user_model.objects.get(username='unittest')
        self.assertTrue(user.check_password('a password I can actually remember'))

    @override_settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend')
    def test_password_reset_confirm_form_invalid(self):
        # Request password_reset endpoint to generate reset link
        mail.outbox.clear()
        response = self.client.post(
            '/accounts/password_reset/',
            urlencode({'email': 'unittest'}),
            content_type='application/x-www-form-urlencoded'
        )
        self.assertEqual(response.status_code, 200)
        body = mail.outbox[0].body
        match = re.search(r"https?://[^\s]+/accounts/reset/[^\s]+/[^\s]+/", body)
        reset_path = urlsplit(match.group(0)).path

        # Follow redirect to set-password
        first = self.client.get(reset_path)
        self.assertEqual(first.status_code, 302)
        set_password_path = first.url

        # Submit passwords that don't match, confirm expected error response
        response = self.client.post(
            set_password_path,
            urlencode({
                'new_password1': 'abc123456',
                'new_password2': 'abc1234567',
            }),
            content_type='application/x-www-form-urlencoded'
        )
        self.assertEqual(response.status_code, 400)
        data = response.json()
        self.assertIn('errors', data)
        self.assertIn('new_password2', data['errors'])

    def test_password_reset_confirm_invalid_link_redirects(self):
        # Confirm redirects to login page when token is invalid
        invalid_path = '/accounts/reset/INVALIDUID/invalid-token/'
        response = self.client.get(invalid_path)
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.url, '/accounts/login/')

    def test_edit_user_details_endpoint(self):
        # Confirm initial test user details
        self.assertEqual(self.test_user.first_name, 'Bob')
        self.assertEqual(self.test_user.last_name, 'Smith')
        self.assertEqual(self.test_user.email, 'bob.smith@hotmail.com')

        # Log in with test user, post new account details to backend
        self.client.login(username='unittest', password='12345')
        response = self.client.post('/accounts/edit_user_details/', {
            'first_name': 'Anthony',
            'last_name': 'Weiner',
            'email': 'carlosdanger@hotmail.com'
        })

        # Confirm success response
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {
                "success": "details updated",
                "user_details": {
                    "username": "unittest",
                    "email": "carlosdanger@hotmail.com",
                    "first_name": "Anthony",
                    "last_name": "Weiner",
                    "date_joined": self.test_user.date_joined.isoformat()
                }
            }
        )

        # Confirm test user details were updated
        self.test_user.refresh_from_db()
        self.assertEqual(self.test_user.first_name, 'Anthony')
        self.assertEqual(self.test_user.last_name, 'Weiner')
        self.assertEqual(self.test_user.email, 'carlosdanger@hotmail.com')

    def test_edit_user_details_endpoint_errors(self):
        # Log in with test user, post new account details with invalid email
        self.client.login(username='unittest', password='12345')
        response = self.client.post('/accounts/edit_user_details/', {
            'first_name': 'Anthony',
            'last_name': 'Weiner',
            'email': 'carlosdanger'
        })

        # Confirm expected error response
        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.json(),
            {"error": ["Enter a valid email address."]}
        )


class SingleUserModeTests(TestCase):
    def setUp(self):
        # Clear entire cache before each test
        cache.clear()

        # Set default content_type for post requests (avoid long lines)
        self.client = JSONClient()

        # Ensure SINGLE_USER_MODE is enabled
        settings.SINGLE_USER_MODE = True

    # pylint: disable-next=invalid-name
    def assertReceivedPermissionDeniedPage(self, response):
        '''Takes response object, confirms received permission_denied.html.'''
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'plant_tracker/permission_denied.html')

    # pylint: disable-next=invalid-name
    def assertReceivedUserAccountsDisabledError(self, response):
        '''Takes response object, confirms received JSON response with status
        403 and payload {"error": "user accounts are disabled"}.
        '''
        self.assertEqual(response.status_code, 403)
        self.assertEqual(
            response.json(),
            {"error": "user accounts are disabled"}
        )

    def test_user_accounts_enabled_context(self):
        # Create test plant and group owned by default user
        plant = Plant.objects.create(uuid=uuid4(), user=get_default_user())
        group = Group.objects.create(uuid=uuid4(), user=get_default_user())

        # Confirm all pages have user_accounts_enabled set to False
        for url in ['/', f'/manage/{plant.uuid}', f'/manage/{group.uuid}']:
            response = self.client.get(url)
            self.assertFalse(response.context['user_accounts_enabled'])

    def test_login_page(self):
        # Request login page while SINGLE_USER_MODE is enabled
        response = self.client.get('/accounts/login/')

        # Confirm returns permission denied page
        self.assertReceivedPermissionDeniedPage(response)
        self.assertEqual(response.context['error'], 'User accounts are disabled')

    def test_login_endpoint(self):
        # POST credentials to login endpoint while SINGLE_USER_MODE is enabled
        self.assertReceivedUserAccountsDisabledError(
            self.client.post(
                "/accounts/login/",
                urlencode({"username": "unittest", "password": "12345"}),
                content_type="application/x-www-form-urlencoded"
            )
        )

    def test_logout(self):
        # Request logout endpoint while SINGLE_USER_MODE is enabled
        response = self.client.get('/accounts/logout/')

        # Confirm returns permission denied page
        self.assertReceivedPermissionDeniedPage(response)
        self.assertEqual(response.context['error'], 'User accounts are disabled')

    def test_create_user_endpoint(self):
        # Post new account credentials while SINGLE_USER_MODE is enabled
        self.assertReceivedUserAccountsDisabledError(
            self.client.post('/accounts/create_user/', {
                'username': 'newuser',
                'password': 'acceptablepasswordlength',
                'email': 'myfirstemail@hotmail.com',
                'first_name': '',
                'last_name': ''
            })
        )

    def test_change_password_endpoint(self):
        # Post new password while SINGLE_USER_MODE is enabled
        self.assertReceivedUserAccountsDisabledError(
            self.client.post('/accounts/change_password/',
                urlencode({
                    'old_password': '12345',
                    'new_password1': 'more secure password',
                    'new_password2': 'nore secure password',
                }),
                content_type="application/x-www-form-urlencoded"
            )
        )

    def test_user_profile_page(self):
        # Request profle page while SINGLE_USER_MODE is enabled
        response = self.client.get('/accounts/profile/')

        # Confirm returns permission denied page
        self.assertReceivedPermissionDeniedPage(response)
        self.assertEqual(response.context['error'], 'User accounts are disabled')

    def test_verify_email_page_single_user_mode(self):
        # Request verify page while SINGLE_USER_MODE is enabled
        response = self.client.get('/accounts/verify/abc/def/')
        # Confirm returns permission denied page
        self.assertReceivedPermissionDeniedPage(response)
        self.assertEqual(response.context['error'], 'User accounts are disabled')

    def test_resend_verification_email_endpoint(self):
        # Request resend_verification_email endpoint while SINGLE_USER_MODE is enabled
        response = self.client.get('/accounts/resend_verification_email/')

        # Confirm returns permission denied page
        self.assertReceivedPermissionDeniedPage(response)
        self.assertEqual(response.context['error'], 'User accounts are disabled')

    def test_edit_user_details_endpoint(self):
        # Submit new user details while SINGLE_USER_MODE is enabled
        self.assertReceivedUserAccountsDisabledError(
            self.client.post('/accounts/edit_user_details/', {
                'first_name': 'Anthony',
                'last_name': 'Weiner',
                'email': 'carlosdanger@hotmail.com'
            })
        )

    def test_overview_page(self):
        # Create second user (in addition to default user)
        test_user = user_model.objects.create_user(
            username='test',
            password='123',
            email='test@aol.com'
        )

        # Create 1 plant owned by default user, 1 plant owned by test user
        Plant.objects.create(
            uuid=uuid4(),
            name='default user plant',
            user=get_default_user()
        )
        Plant.objects.create(
            uuid=uuid4(),
            name='test user plant',
            user=test_user
        )

        # Ensure logged out, request overview page
        self.assertFalse(auth.get_user(self.client).is_authenticated)
        response = self.client.get('/')

        # Confirm loaded with no authentication, returned SPA
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'plant_tracker/index.html')

    def test_manage_plant_page_user_owns_plant(self):
        # Create plant owned by default user
        plant = Plant.objects.create(uuid=uuid4(), user=get_default_user())

        # Request manage page (comes from default user since SINGLE_USER_MODE enabled)
        response = self.client.get(f'/manage/{plant.uuid}')

        # Confirm returned SPA
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'plant_tracker/index.html')

        # Request state object, confirm contains plant details
        response = self.client.get_json(f'/get_manage_state/{plant.uuid}')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['state']['plant_details'], plant.get_details())
        self.assertEqual(response.json()['title'], 'Manage Plant')

    def test_manage_plant_page_user_does_not_own_plant(self):
        # Create second user (in addition to default user) + plant for user
        test_user = user_model.objects.create_user(
            username='test',
            password='123',
            email='test@aol.com'
        )
        plant = Plant.objects.create(uuid=uuid4(), user=test_user)

        # Request manage page (comes from default user since SINGLE_USER_MODE enabled)
        response = self.client.get(f'/manage/{plant.uuid}')
        self.assertEqual(response.status_code, 200)

        # Request state object, confirm returns permission denied
        response = self.client.get_json(f'/get_manage_state/{plant.uuid}')
        self.assertEqual(response.status_code, 403)
        self.assertEqual(
            response.json(),
            {"error": "plant is owned by a different user"}
        )

    def test_get_new_plant_state_user_owns_plant(self):
        # Create plant owned by default user
        plant = Plant.objects.create(uuid=uuid4(), user=get_default_user())

        # Request plant state (comes from default user since SINGLE_USER_MODE enabled)
        response = self.client.get_json(f'/get_manage_state/{plant.uuid}')

        # Confirm received plant state
        self.assertEqual(response.status_code, 200)
        self.assertTrue(isinstance(response.json(), dict))
        self.assertEqual(
            response.json()['state']['plant_details']['uuid'],
            str(plant.uuid)
        )

    def test_get_new_plant_state_user_does_not_own_plant(self):
        # Create second user (in addition to default user) + plant for user
        test_user = user_model.objects.create_user(
            username='test',
            password='123',
            email='test@aol.com'
        )
        plant = Plant.objects.create(uuid=uuid4(), user=test_user)

        # Request manage page (comes from default user since SINGLE_USER_MODE enabled)
        response = self.client.get_json(f'/get_manage_state/{plant.uuid}')

        # Confirm received error response, not plant state
        self.assertEqual(response.status_code, 403)
        self.assertEqual(
            response.json(),
            {"error": "plant is owned by a different user"}
        )

    def test_manage_group_page_user_owns_group(self):
        # Create group owned by default user
        group = Group.objects.create(uuid=uuid4(), user=get_default_user())

        # Request manage page (comes from default user since SINGLE_USER_MODE enabled)
        response = self.client.get(f'/manage/{group.uuid}')

        # Confirm returned SPA
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'plant_tracker/index.html')

        # Request state object, confirm contains group details
        response = self.client.get_json(f'/get_manage_state/{group.uuid}')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['state']['group_details'], group.get_details())
        self.assertEqual(response.json()['title'], 'Manage Group')

    def test_manage_group_page_user_does_not_own_group(self):
        # Create second user (in addition to default user) + group for user
        test_user = user_model.objects.create_user(
            username='test',
            password='123',
            email='test@aol.com'
        )
        group = Group.objects.create(uuid=uuid4(), user=test_user)

        # Request manage page (comes from default user since SINGLE_USER_MODE enabled)
        response = self.client.get(f'/manage/{group.uuid}')
        self.assertEqual(response.status_code, 200)

        # Request state object, confirm returns permission denied
        response = self.client.get_json(f'/get_manage_state/{group.uuid}')
        self.assertEqual(response.status_code, 403)
        self.assertEqual(
            response.json(),
            {"error": "group is owned by a different user"}
        )

    def test_get_new_group_state_user_owns_group(self):
        # Create group owned by default user
        group = Group.objects.create(uuid=uuid4(), user=get_default_user())

        # Request group state (comes from default user since SINGLE_USER_MODE enabled)
        response = self.client.get_json(f'/get_manage_state/{group.uuid}')

        # Confirm received group state
        self.assertEqual(response.status_code, 200)
        self.assertTrue(isinstance(response.json(), dict))
        self.assertEqual(
            response.json()['state']['group_details']['uuid'],
            str(group.uuid)
        )

    def test_get_new_group_state_user_does_not_own_group(self):
        # Create second user (in addition to default user) + group for user
        test_user = user_model.objects.create_user(
            username='test',
            password='123',
            email='test@aol.com'
        )
        group = Group.objects.create(uuid=uuid4(), user=test_user)

        # Request manage page (comes from default user since SINGLE_USER_MODE enabled)
        response = self.client.get_json(f'/get_manage_state/{group.uuid}')

        # Confirm received error response, not group state
        self.assertEqual(response.status_code, 403)
        self.assertEqual(
            response.json(),
            {"error": "group is owned by a different user"}
        )


class MultiUserModeTests(TestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.test_user = user_model.objects.create_user(
            username='unittest',
            password='12345',
            first_name='Bob',
            last_name='Smith',
            email='bob.smith@hotmail.com'
        )

    def setUp(self):
        # Clear entire cache before each test
        cache.clear()

        # Set default content_type for post requests (avoid long lines)
        self.client = JSONClient()

        # Ensure SINGLE_USER_MODE is disabled
        settings.SINGLE_USER_MODE = False

    def tearDown(self):
        # Ensure user logged out between tests
        self.client.logout()

    def test_verify_email_endpoint_success(self):
        # Ensure verification row exists and is unverified
        verification, _ = UserEmailVerification.objects.get_or_create(user=self.test_user)
        verification.is_email_verified = False
        verification.save()

        uidb64 = urlsafe_base64_encode(force_bytes(self.test_user.pk))
        token = email_verification_token_generator.make_token(self.test_user)
        response = self.client.get(f'/accounts/verify/{uidb64}/{token}/')

        # Confirm redirected to overview page
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.url, '/')

        verification.refresh_from_db()
        self.assertTrue(verification.is_email_verified)

    def test_verify_email_endpoint_invalid_token(self):
        verification, _ = UserEmailVerification.objects.get_or_create(user=self.test_user)
        verification.is_email_verified = False
        verification.save()

        uidb64 = urlsafe_base64_encode(force_bytes(self.test_user.pk))
        response = self.client.get(f'/accounts/verify/{uidb64}/invalidtoken/')

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"error": "invalid verification link"})
        verification.refresh_from_db()
        self.assertFalse(verification.is_email_verified)

    # pylint: disable-next=invalid-name
    def assertAuthenticationRequiredError(self, response):
        '''Takes response object, confirms received JSON response with status
        401 and payload {"error": "authentication required"}.
        '''
        self.assertEqual(response.status_code, 401)
        self.assertEqual(
            response.json(),
            {"error": "authentication required"}
        )

    # pylint: disable-next=invalid-name
    def assertPlantIsOwnedByADifferentUserError(self, response):
        '''Takes response object, confirms received JSON response with status
        403 and payload {"error": "plant is owned by a different user"}.
        '''
        self.assertEqual(response.status_code, 403)
        self.assertEqual(
            response.json(),
            {"error": "plant is owned by a different user"}
        )

    # pylint: disable-next=invalid-name
    def assertInstanceIsOwnedByADifferentUserError(self, response):
        '''Takes response object, confirms received JSON response with status
        403 and payload {"error": "instance is owned by a different user"}.
        '''
        self.assertEqual(response.status_code, 403)
        self.assertEqual(
            response.json(),
            {"error": "instance is owned by a different user"}
        )

    # pylint: disable-next=invalid-name
    def assertGroupIsOwnedByADifferentUserError(self, response):
        '''Takes response object, confirms received JSON response with status
        403 and payload {"error": "group is owned by a different user"}.
        '''
        self.assertEqual(response.status_code, 403)
        self.assertEqual(
            response.json(),
            {"error": "group is owned by a different user"}
        )

    def test_user_accounts_enabled_context(self):
        # Create test plant and group
        plant = Plant.objects.create(uuid=uuid4(), user=self.test_user)
        group = Group.objects.create(uuid=uuid4(), user=self.test_user)

        # Log in as test user
        self.client.login(username='unittest', password='12345')
        response = self.client.get('/')

        # Confirm all pages have user_accounts_enabled set to True
        for url in ['/', f'/manage/{plant.uuid}', f'/manage/{group.uuid}']:
            response = self.client.get(url)
            self.assertTrue(response.context['user_accounts_enabled'])

    def test_overview_page_signed_in(self):
        # Request overview page while signed in
        self.client.login(username='unittest', password='12345')
        response = self.client.get('/')

        # Confirm returned SPA
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'plant_tracker/index.html')

        # Request state object, confirm title contains user's first name
        response = self.client.get_json('/get_overview_state')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['title'], "Bob's Plants")

    def test_overview_page_not_signed_in(self):
        # Request overview page while not signed in
        self.assertFalse(auth.get_user(self.client).is_authenticated)
        response = self.client.get('/')

        # Confirm redirected to login page with requested URL in querystring
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.url, '/accounts/login/?next=/')

    def test_manage_plant_page_signed_in(self):
        # Create plant owned by test user
        plant = Plant.objects.create(uuid=uuid4(), user=self.test_user)

        # Sign in, request manage page
        self.client.login(username='unittest', password='12345')
        response = self.client.get(f'/manage/{plant.uuid}')

        # Confirm returned SPA
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'plant_tracker/index.html')

        # Request state object, confirm contains plant details
        response = self.client.get_json(f'/get_manage_state/{plant.uuid}')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['state']['plant_details'], plant.get_details())
        self.assertEqual(response.json()['title'], 'Manage Plant')

    def test_manage_plant_page_not_signed_in(self):
        # Create plant owned by test user
        plant = Plant.objects.create(uuid=uuid4(), user=self.test_user)

        # Request manage page without signing in
        self.assertFalse(auth.get_user(self.client).is_authenticated)
        response = self.client.get(f'/manage/{plant.uuid}')

        # Confirm redirected to login page with requested URL in querystring
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.url, f'/accounts/login/?next=/manage/{plant.uuid}')

    def test_manage_group_page_signed_in(self):
        # Create group owned by test user
        group = Group.objects.create(uuid=uuid4(), user=self.test_user)

        # Sign in, request manage page
        self.client.login(username='unittest', password='12345')
        response = self.client.get(f'/manage/{group.uuid}')

        # Confirm returned SPA
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'plant_tracker/index.html')

        # Request state object, confirm contains group details
        response = self.client.get_json(f'/get_manage_state/{group.uuid}')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['state']['group_details'], group.get_details())
        self.assertEqual(response.json()['title'], 'Manage Group')

    def test_manage_group_page_not_signed_in(self):
        # Create group owned by test user
        group = Group.objects.create(uuid=uuid4(), user=self.test_user)

        # Request manage page without signing in
        self.assertFalse(auth.get_user(self.client).is_authenticated)
        response = self.client.get(f'/manage/{group.uuid}')

        # Confirm redirected to login page with requested URL in querystring
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.url, f'/accounts/login/?next=/manage/{group.uuid}')

    def test_get_new_plant_state_not_signed_in(self):
        # Create plant owned by test user
        plant = Plant.objects.create(uuid=uuid4(), user=self.test_user)

        # Request plant state without signing in
        # Accept header is sent by SPA loader when requesting state
        self.assertFalse(auth.get_user(self.client).is_authenticated)
        self.assertAuthenticationRequiredError(self.client.get_json(
            f'/get_manage_state/{plant.uuid}'
        ))


    def test_get_new_group_state_not_signed_in(self):
        # Create group owned by test user
        group = Group.objects.create(uuid=uuid4(), user=self.test_user)

        # Request group state without signing in
        # Accept header is sent by SPA loader when requesting state
        self.assertFalse(auth.get_user(self.client).is_authenticated)
        self.assertAuthenticationRequiredError(self.client.get_json(
            f'/get_manage_state/{group.uuid}'
        ))

    def test_endpoints_require_authenticated_user(self):
        # Create plant and group owned by test user
        plant = Plant.objects.create(uuid=uuid4(), user=self.test_user)
        group = Group.objects.create(uuid=uuid4(), user=self.test_user)

        # Confirm /change_qr_code returns 401, does not cache UUID
        self.assertAuthenticationRequiredError(
            self.client.post('/change_qr_code', {
                'uuid': str(plant.uuid)
            })
        )
        self.assertIsNone(cache.get(f'old_uuid_{get_default_user().pk}'))

        self.assertAuthenticationRequiredError(
            self.client.post('/change_uuid', {
                'uuid': str(plant.uuid),
                'new_id': str(uuid4())
            })
        )
        self.assertAuthenticationRequiredError(
            self.client.post('/edit_plant_details', {
                'plant_id': plant.uuid,
                'name': 'test plant    ',
                'species': '   Giant Sequoia',
                'description': '300 feet and a few thousand years old',
                'pot_size': '4'
            })
        )
        self.assertAuthenticationRequiredError(
            self.client.post('/edit_group_details', {
                'group_id': group.uuid,
                'name': 'test group    ',
                'location': '    middle shelf',
                'description': 'This group is used for propagation'
            })
        )
        self.assertAuthenticationRequiredError(
            self.client.post('/add_plant_event', {
                'plant_id': plant.uuid,
                'event_type': 'water',
                'timestamp': '2024-02-06T03:06:26.000Z'
            })
        )
        self.assertAuthenticationRequiredError(
            self.client.post('/bulk_add_plant_events', {
                'plants': [str(plant.uuid)],
                'event_type': 'water',
                'timestamp': '2024-02-06T03:06:26.000Z'
            })
        )
        self.assertAuthenticationRequiredError(
            self.client.post('/bulk_delete_plant_events', {
                'plant_id': plant.uuid,
                'events': {
                    'water': ['2024-02-06T03:06:26+00:00'],
                    'fertilize': [],
                    'prune': [],
                    'repot': [],
                }
            })
        )
        self.assertAuthenticationRequiredError(
            self.client.post('/add_plant_note', {
                'plant_id': plant.uuid,
                'timestamp': '2024-02-06T03:06:26.000Z',
                'note_text': '  plant is looking healthier than last week  '
            })
        )
        self.assertAuthenticationRequiredError(
            self.client.post('/edit_plant_note', {
                'plant_id': plant.uuid,
                'timestamp': '2024-02-06T03:06:26.000Z',
                'note_text': '   This is the text I forgot to add   '
            })
        )
        self.assertAuthenticationRequiredError(
            self.client.post('/delete_plant_notes', {
                'plant_id': plant.uuid,
                'timestamps': ['2024-02-06T03:06:26.000Z']
            })
        )
        self.assertAuthenticationRequiredError(
            self.client.post('/add_plant_to_group', {
                'plant_id': plant.uuid,
                'group_id': group.uuid
            })
        )
        self.assertAuthenticationRequiredError(
            self.client.post('/remove_plant_from_group', {
                'plant_id': plant.uuid
            })
        )
        self.assertAuthenticationRequiredError(
            self.client.post('/bulk_add_plants_to_group', {
                'group_id': group.uuid,
                'plants': [plant.uuid]
            })
        )
        self.assertAuthenticationRequiredError(
            self.client.post('/bulk_remove_plants_from_group', {
                'group_id': group.uuid,
                'plants': [plant.uuid]
            })
        )
        self.assertAuthenticationRequiredError(
            self.client.post('/repot_plant', {
                'plant_id': plant.uuid,
                'timestamp': '2024-02-06T03:06:26.000Z',
                'new_pot_size': 6
            })
        )
        self.assertAuthenticationRequiredError(
            self.client.post(
                '/add_plant_photos',
                data={
                    'plant_id': str(plant.uuid),
                    'photo_0': create_mock_photo('2024:03:22 10:52:03')
                },
                content_type=MULTIPART_CONTENT
            )
        )
        self.assertAuthenticationRequiredError(
            self.client.post('/delete_plant_photos', {
                'plant_id': str(plant.uuid),
                'delete_photos': [1]
            })
        )
        self.assertAuthenticationRequiredError(
            self.client.post('/set_plant_default_photo', {
                'plant_id': str(plant.uuid),
                'photo_key': 1
            })
        )

        # Confirm resend_verification_email redirects unauthenticated user
        response = self.client.get('/accounts/resend_verification_email/')
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.url, '/accounts/login/?next=/accounts/resend_verification_email/')

    def test_endpoints_reject_requests_from_user_who_does_not_own_plant(self):
        # Create plant and group owned by default user
        plant = Plant.objects.create(uuid=uuid4(), user=get_default_user())
        group = Group.objects.create(uuid=uuid4(), user=get_default_user())

        # Sign in as test user (does not own plant or group)
        self.client.login(username='unittest', password='12345')

        # Confirm /change_qr_code returns 403, does not cache UUID
        self.assertInstanceIsOwnedByADifferentUserError(
            self.client.post('/change_qr_code', {
                'uuid': str(plant.uuid)
            })
        )
        self.assertIsNone(cache.get(f'old_uuid_{get_default_user().pk}'))

        self.assertPlantIsOwnedByADifferentUserError(
            self.client.get_json(f'/get_manage_state/{plant.uuid}')
        )
        self.assertGroupIsOwnedByADifferentUserError(
            self.client.get_json(f'/get_manage_state/{group.uuid}')
        )
        self.assertInstanceIsOwnedByADifferentUserError(
            self.client.post('/change_uuid', {
                'uuid': str(plant.uuid),
                'new_id': str(uuid4())
            })
        )
        self.assertPlantIsOwnedByADifferentUserError(
            self.client.post('/edit_plant_details', {
                'plant_id': plant.uuid,
                'name': 'test plant    ',
                'species': '   Giant Sequoia',
                'description': '300 feet and a few thousand years old',
                'pot_size': '4'
            })
        )
        self.assertGroupIsOwnedByADifferentUserError(
            self.client.post('/edit_group_details', {
                'group_id': group.uuid,
                'name': 'test group    ',
                'location': '    middle shelf',
                'description': 'This group is used for propagation'
            })
        )
        self.assertPlantIsOwnedByADifferentUserError(
            self.client.post('/add_plant_event', {
                'plant_id': plant.uuid,
                'event_type': 'water',
                'timestamp': '2024-02-06T03:06:26.000Z'
            })
        )

        # Confirm /bulk_add_plant_events returns 400 (does not indicate failure
        # reason but this is only to prevent malicious API calls, should not be
        # possible to make this request from the frontend)
        response = self.client.post('/bulk_add_plant_events', {
            'plants': [str(plant.uuid)],
            'event_type': 'water',
            'timestamp': '2024-02-06T03:06:26.000Z'
        })
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {
            "action": "water",
            "timestamp": "2024-02-06T03:06:26+00:00",
            "plants": [],
            "failed": [str(plant.uuid)]
        })

        self.assertPlantIsOwnedByADifferentUserError(
            self.client.post('/bulk_delete_plant_events', {
                'plant_id': plant.uuid,
                'events': {
                    'water': ['2024-02-06T03:06:26+00:00'],
                    'fertilize': [],
                    'prune': [],
                    'repot': [],
                }
            })
        )
        self.assertPlantIsOwnedByADifferentUserError(
            self.client.post('/add_plant_note', {
                'plant_id': plant.uuid,
                'timestamp': '2024-02-06T03:06:26.000Z',
                'note_text': '  plant is looking healthier than last week  '
            })
        )
        self.assertPlantIsOwnedByADifferentUserError(
            self.client.post('/edit_plant_note', {
                'plant_id': plant.uuid,
                'timestamp': '2024-02-06T03:06:26.000Z',
                'note_text': '   This is the text I forgot to add   '
            })
        )
        self.assertPlantIsOwnedByADifferentUserError(
            self.client.post('/delete_plant_notes', {
                'plant_id': plant.uuid,
                'timestamps': ['2024-02-06T03:06:26.000Z']
            })
        )
        self.assertPlantIsOwnedByADifferentUserError(
            self.client.post('/add_plant_to_group', {
                'plant_id': plant.uuid,
                'group_id': group.uuid
            })
        )
        self.assertPlantIsOwnedByADifferentUserError(
            self.client.post('/remove_plant_from_group', {
                'plant_id': plant.uuid
            })
        )
        self.assertGroupIsOwnedByADifferentUserError(
            self.client.post('/bulk_add_plants_to_group', {
                'group_id': group.uuid,
                'plants': [plant.uuid]
            })
        )
        self.assertGroupIsOwnedByADifferentUserError(
            self.client.post('/bulk_remove_plants_from_group', {
                'group_id': group.uuid,
                'plants': [plant.uuid]
            })
        )
        self.assertPlantIsOwnedByADifferentUserError(
            self.client.post('/repot_plant', {
                'plant_id': plant.uuid,
                'timestamp': '2024-02-06T03:06:26.000Z',
                'new_pot_size': 6
            })
        )
        self.assertPlantIsOwnedByADifferentUserError(
            self.client.post(
                '/add_plant_photos',
                data={
                    'plant_id': str(plant.uuid),
                    'photo_0': create_mock_photo('2024:03:22 10:52:03')
                },
                content_type=MULTIPART_CONTENT
            )
        )
        self.assertPlantIsOwnedByADifferentUserError(
            self.client.post('/delete_plant_photos', {
                'plant_id': str(plant.uuid),
                'delete_photos': [1]
            })
        )
        self.assertPlantIsOwnedByADifferentUserError(
            self.client.post('/set_plant_default_photo', {
                'plant_id': str(plant.uuid),
                'photo_key': 1
            })
        )
