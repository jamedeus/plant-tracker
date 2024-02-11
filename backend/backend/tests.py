from django.test import TestCase

from .validate_url_prefix import validate_url_prefix


class ValidateUrlPrefixTests(TestCase):
    def test_unset_env_var(self):
        # Should return None when env var not set
        self.assertIsNone(validate_url_prefix(None))

    def test_bare_domain(self):
        # Should add protocol and /manage/
        self.assertEqual(
            validate_url_prefix('mysite.com'),
            'http://mysite.com/manage/'
        )

    def test_bare_domain_with_subdomain(self):
        # Should retain subdomains, add protocol and /manage/
        self.assertEqual(
            validate_url_prefix('www.sub.mysite.com'),
            'http://www.sub.mysite.com/manage/'
        )

    def test_domain_with_protocol(self):
        # Should keep whichever protocol is given, add /manage/
        self.assertEqual(
            validate_url_prefix('http://mysite.com'),
            'http://mysite.com/manage/'
        )
        self.assertEqual(
            validate_url_prefix('https://mysite.com'),
            'https://mysite.com/manage/'
        )

    def test_domain_with_path(self):
        # Should add http to domain missing protocol
        self.assertEqual(
            validate_url_prefix('mysite.com/manage/'),
            'http://mysite.com/manage/'
        )

        # Should add missing trailing /
        self.assertEqual(
            validate_url_prefix('mysite.com/manage'),
            'http://mysite.com/manage/'
        )

    def test_bare_ip(self):
        # Should add protocol and /manage/
        self.assertEqual(
            validate_url_prefix('192.168.1.100'),
            'http://192.168.1.100/manage/'
        )

        # Should retain port number, add protocol and /manage/
        self.assertEqual(
            validate_url_prefix('192.168.1.100:8123'),
            'http://192.168.1.100:8123/manage/'
        )

    def test_ip_with_protocol(self):
        # Should keep whichever protocol is given, add /manage/
        self.assertEqual(
            validate_url_prefix('http://192.168.1.100'),
            'http://192.168.1.100/manage/'
        )
        self.assertEqual(
            validate_url_prefix('https://192.168.1.100'),
            'https://192.168.1.100/manage/'
        )

    def test_ip_with_path(self):
        # Should add http to ip missing protocol
        self.assertEqual(
            validate_url_prefix('192.168.1.100/manage/'),
            'http://192.168.1.100/manage/'
        )

        # Should add missing trailing /
        self.assertEqual(
            validate_url_prefix('192.168.1.100/manage'),
            'http://192.168.1.100/manage/'
        )

    def test_invalid_env_var(self):
        # Should return None if input is not valid domain or IP
        self.assertIsNone(validate_url_prefix('website'))
        self.assertIsNone(validate_url_prefix('website.'))
        self.assertIsNone(validate_url_prefix('192.168.1.'))
        self.assertIsNone(validate_url_prefix('999.999.999.999'))
        self.assertIsNone(validate_url_prefix('10.0.0.1:999999'))
        # Should return None if path is incorrect, protocol is invalid
        self.assertIsNone(validate_url_prefix('https://website.com/index/'))
        self.assertIsNone(validate_url_prefix('htp://website.com/manage/'))
        self.assertIsNone(validate_url_prefix('http//website.com/manage/'))
