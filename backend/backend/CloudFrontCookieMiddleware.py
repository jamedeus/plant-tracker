import base64

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured

from botocore.signers import CloudFrontSigner
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives import hashes, serialization


class CloudFrontCookieMiddleware:
    '''Adds signed cloudfront cookies to all requests by authenticated users.'''

    def __init__(self, get_response):
        self.get_response = get_response

        # Load private key once on startup
        try:
            with open(settings.CLOUDFRONT_PRIVKEY_PATH, 'rb') as key_file:
                self._private_key = serialization.load_pem_private_key(
                    key_file.read(),
                    password=None,
                    backend=default_backend()
                )
        except FileNotFoundError as exc:
            raise ImproperlyConfigured(
                "Cloudfront private key not found (set CLOUDFRONT_PRIVKEY_PATH)"
            ) from exc

        # Signs argument with cloudfront private key
        self._rsa_signer = lambda message: self._private_key.sign(
            message,
            padding.PKCS1v15(),
            hashes.SHA1()
        )

        # Generates cloudfront policies signed by private key
        self._cloudfront_signer = CloudFrontSigner(
            settings.CLOUDFRONT_KEY_ID,
            self._rsa_signer
        )

    def _base64_encode_url(self, data):
        '''Takes bytes, returns URL-safe base64 encoded string.'''
        return base64.b64encode(data) \
            .replace(b"+", b"-") \
            .replace(b"=", b"_") \
            .replace(b"/", b"~") \
            .decode("utf8")

    def _get_cloudfront_cookies(self, user_id, expires_at):
        '''Takes user_id and session expiration time, returns dict of signed
        cloudfront cookies granting access to user's namespace directory.
        '''

        # Build policy with user namespace directory URL, sign with privkey
        policy = self._cloudfront_signer.build_policy(
            f"https://{settings.IMAGE_URL}/user_{user_id}/*",
            expires_at
        ).encode("utf8")
        signature = self._rsa_signer(policy)

        # Return signed cloudfront cookies
        return {
            "CloudFront-Policy": self._base64_encode_url(policy),
            "CloudFront-Signature": self._base64_encode_url(signature),
            "CloudFront-Key-Pair-Id": settings.CLOUDFRONT_KEY_ID
        }

    def __call__(self, request):
        response = self.get_response(request)

        # Don't set cookies if user not signed in
        if not request.user.is_authenticated:
            return response

        # Don't set cookies if all are already set
        cookie_names = [
            "CloudFront-Policy",
            "CloudFront-Signature",
            "CloudFront-Key-Pair-Id",
        ]
        if all(cookie_name in request.COOKIES for cookie_name in cookie_names):
            return response

        # Create cloudfront signed cookies scoped to user's photos
        user = request.user
        cookies = self._get_cloudfront_cookies(
            user_id=user.id,
            expires_at=request.session.get_expiry_date()
        )
        # Add all cookies to response
        for cookie_name, cookie_value in cookies.items():
            response.set_cookie(
                cookie_name,
                cookie_value,
                # Apply to all subdomains
                domain=settings.BASE_URL,
                httponly=True,
                secure=True,
                samesite="None",
                # Only send cookies when requesting photos from namespace
                path=f"/user_{user.id}/",
                # Expire at same time as session cookie
                expires=request.session.get_expiry_date()
            )

        return response
