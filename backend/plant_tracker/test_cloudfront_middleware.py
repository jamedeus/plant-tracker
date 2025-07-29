# pylint: disable=missing-docstring,protected-access,line-too-long

from contextlib import contextmanager
from unittest.mock import Mock, patch, mock_open

from django.test import TestCase, RequestFactory, Client
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from django.core.exceptions import ImproperlyConfigured
from django.http import HttpResponse
from django.conf import settings

from backend.CloudFrontCookieMiddleware import CloudFrontCookieMiddleware

user_model = get_user_model()


class CloudFrontCookieMiddlewareTests(TestCase):
    def setUp(self):
        self.factory = RequestFactory()
        self.client = Client()

        # Create test user
        self.test_user = user_model.objects.create_user(
            username='testuser',
            password='testpass123',
            email='test@example.com'
        )

        # Mock AWS env vars
        self.aws_env_vars = {
            'AWS_ACCESS_KEY_ID': 'AKIATEST123456789',
            'AWS_SECRET_ACCESS_KEY': 'test-secret-access-key',
            'AWS_STORAGE_BUCKET_NAME': 'test-bucket',
            'AWS_S3_REGION_NAME': 'us-west-2',
            'CLOUDFRONT_COOKIE_DOMAIN': '.example.com',
            'CLOUDFRONT_IMAGE_DOMAIN': 'images.example.com',
            'CLOUDFRONT_KEY_ID': 'K86ALCJM6RYZT',
            'CLOUDFRONT_PRIVKEY_PATH': '/test/private_key.pem'
        }

        # Mock private_key.pem contents
        self.mock_private_key_content = b"""-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMN
OPQRSTUVWXYZ1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOP
QRSTUVWXYZ1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQR
STUVWXYZ1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRST
UVWXYZ1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUV
WXYZ1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWX
YZ1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ
1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ12
-----END RSA PRIVATE KEY-----"""

        # Mock response function
        self.mock_get_response = Mock(return_value=HttpResponse("Test response"))

    @contextmanager
    def _aws_settings_context(self):
        '''Context manager to temporarily add AWS env vars to settings.'''

        # Store original values (if they exist)
        original_values = {}
        for key in self.aws_env_vars:
            if hasattr(settings, key):
                original_values[key] = getattr(settings, key)
            else:
                original_values[key] = None

        # Add test AWS settings
        for key, value in self.aws_env_vars.items():
            setattr(settings, key, value)

        try:
            yield
        finally:
            # Restore original values (including None for missing settings)
            for key, original_value in original_values.items():
                setattr(settings, key, original_value)

    def _create_middleware_with_mocks(self):
        '''Set up mocks and create middleware instance.
        Must be called within _aws_settings_context.
        '''
        with patch('builtins.open', mock_open(read_data=self.mock_private_key_content)), \
             patch('backend.CloudFrontCookieMiddleware.serialization.load_pem_private_key') as mock_load_key, \
             patch('backend.CloudFrontCookieMiddleware.CloudFrontSigner') as mock_cf_signer:
            # Mock the private key
            mock_private_key = Mock()
            mock_private_key.sign.return_value = b'mock_signature'
            mock_load_key.return_value = mock_private_key

            # Mock CloudFront signer
            mock_signer_instance = Mock()
            mock_signer_instance.build_policy.return_value = 'mock_policy'
            mock_cf_signer.return_value = mock_signer_instance

            # Instantiate middleware and return
            middleware = CloudFrontCookieMiddleware(self.mock_get_response)
            middleware._cloudfront_signer = mock_signer_instance
            middleware._rsa_signer = mock_private_key.sign
            return middleware, mock_signer_instance, mock_private_key

    def test_middleware_initialization(self):
        '''Confirm loads private_key.pem when initialized.'''
        with self._aws_settings_context():
            with patch('builtins.open', mock_open(read_data=self.mock_private_key_content)), \
                 patch('backend.CloudFrontCookieMiddleware.serialization.load_pem_private_key') as mock_load_key, \
                 patch('backend.CloudFrontCookieMiddleware.CloudFrontSigner') as mock_cf_signer:
                mock_private_key = Mock()
                mock_load_key.return_value = mock_private_key

                middleware = CloudFrontCookieMiddleware(self.mock_get_response)

                # Confirm private key was loaded, CloudFrontSigner was created
                self.assertTrue(mock_load_key.called)
                self.assertEqual(mock_load_key.call_args[0][0], self.mock_private_key_content)
                mock_cf_signer.assert_called_once_with(
                    self.aws_env_vars['CLOUDFRONT_KEY_ID'],
                    middleware._rsa_signer
                )

    def test_middleware_initialization_missing_private_key(self):
        '''Confirm correct exception raised when private key not found.'''
        with self._aws_settings_context():
            with patch('builtins.open', side_effect=FileNotFoundError("No such file")):
                with self.assertRaises(ImproperlyConfigured) as context:
                    CloudFrontCookieMiddleware(self.mock_get_response)
                self.assertIn("Cloudfront private key not found", str(context.exception))

    def test_unauthenticated_user_request(self):
        '''Confirm that cookies are not set for unauthenticated users.'''
        with self._aws_settings_context():
            middleware, _, _ = self._create_middleware_with_mocks()

            # Simulate request from unauthenticated user
            request = self.factory.get('/some/protected/resource')
            request.user = AnonymousUser()
            response = middleware(request)

            # Confirm get_response was called, no cookies were set (response unchanged)
            self.mock_get_response.assert_called_once_with(request)
            self.assertEqual(response, self.mock_get_response.return_value)

    def test_authenticated_user_request_no_cookies(self):
        '''Confirm that cookies are set for authenticated users with no cookies.'''
        with self._aws_settings_context():
            middleware, mock_signer, _ = self._create_middleware_with_mocks()

            # Simulate request from authenticated user with no cookies
            self.client.force_login(self.test_user)
            session = self.client.session
            session_expiry = session.get_expiry_date()
            request = self.factory.get('/manage/af29636e-d418-4721-90f3-bec2f6ada209')
            request.user = self.test_user
            request.session = session  # Real Django session
            request.COOKIES = {}  # No existing cookies

            # Mock session get_expiry_date to return consistent value
            with patch.object(session, 'get_expiry_date', return_value=session_expiry):
                mock_response = Mock(spec=HttpResponse)
                self.mock_get_response.return_value = mock_response
                middleware(request)

            # Confirm all 3 CloudFront cookies were set
            self.assertEqual(mock_response.set_cookie.call_count, 3)

            # Confirm cookie names
            calls = mock_response.set_cookie.call_args_list
            cookie_names = {call[0][0] for call in calls}
            expected_names = {'CloudFront-Policy', 'CloudFront-Signature', 'CloudFront-Key-Pair-Id'}
            self.assertEqual(cookie_names, expected_names)

            # Confirm all cookies have correct attributes
            for call in calls:
                kwargs = call[1]
                self.assertEqual(kwargs['domain'], self.aws_env_vars['CLOUDFRONT_COOKIE_DOMAIN'])
                self.assertTrue(kwargs['httponly'])
                self.assertTrue(kwargs['secure'])
                self.assertEqual(kwargs['samesite'], 'None')

                # Confirm user ID is in path
                self.assertEqual(kwargs['path'], f'/user_{self.test_user.id}/')

                # Confirm expiration matches session
                self.assertEqual(kwargs['expires'], session_expiry)

            # Confirm correct CloudFront policy was generated for the user
            mock_signer.build_policy.assert_called_once_with(
                f"https://{self.aws_env_vars['CLOUDFRONT_IMAGE_DOMAIN']}/user_{self.test_user.id}/*",
                session_expiry
            )

    def test_authenticated_user_request_partial_cookies(self):
        '''Confirm that cookies are set for authenticated users with some existing cookies.'''
        with self._aws_settings_context():
            middleware, mock_signer, _ = self._create_middleware_with_mocks()

            # Simulate request from authenticated user with missing
            # CloudFront-Key-Pair-Id cookie
            self.client.force_login(self.test_user)
            session = self.client.session
            session_expiry = session.get_expiry_date()
            request = self.factory.get('/manage/af29636e-d418-4721-90f3-bec2f6ada209')
            request.user = self.test_user
            request.session = session
            request.COOKIES = {
                'CloudFront-Policy': 'existing_policy_value',
                'CloudFront-Signature': 'existing_signature_value'
            }

            # Mock session get_expiry_date to return consistent value
            with patch.object(session, 'get_expiry_date', return_value=session_expiry):
                mock_response = Mock(spec=HttpResponse)
                self.mock_get_response.return_value = mock_response
                middleware(request)

            # Confirm all 3 cookies were set
            self.assertEqual(mock_response.set_cookie.call_count, 3)

            # Confirm all cookies have correct attributes
            calls = mock_response.set_cookie.call_args_list
            for call in calls:
                kwargs = call[1]
                self.assertEqual(kwargs['domain'], self.aws_env_vars['CLOUDFRONT_COOKIE_DOMAIN'])
                self.assertTrue(kwargs['httponly'])
                self.assertTrue(kwargs['secure'])
                self.assertEqual(kwargs['samesite'], 'None')
                self.assertEqual(kwargs['path'], f'/user_{self.test_user.id}/')
                self.assertEqual(kwargs['expires'], session_expiry)

            # Confirm correct CloudFront policy was generated for the user
            mock_signer.build_policy.assert_called_once_with(
                f"https://{self.aws_env_vars['CLOUDFRONT_IMAGE_DOMAIN']}/user_{self.test_user.id}/*",
                session_expiry
            )

    def test_authenticated_user_request_all_cookies_present(self):
        '''Confirm that cookies are not set for authenticated users with all cookies.'''
        with self._aws_settings_context():
            middleware, mock_signer, _ = self._create_middleware_with_mocks()

            # Simulate request from authenticated user with all cookies
            self.client.force_login(self.test_user)
            session = self.client.session
            request = self.factory.get('/manage/af29636e-d418-4721-90f3-bec2f6ada209')
            request.user = self.test_user
            request.session = session
            request.COOKIES = {
                'CloudFront-Policy': 'existing_policy_value',
                'CloudFront-Signature': 'existing_signature_value',
                'CloudFront-Key-Pair-Id': 'existing_key_id_value'
            }

            # Confirm get_response was called, no cookies were set (response unchanged)
            response = middleware(request)
            self.mock_get_response.assert_called_once_with(request)
            self.assertEqual(response, self.mock_get_response.return_value)

            # Confirm no CloudFront policy was generated
            mock_signer.build_policy.assert_not_called()
