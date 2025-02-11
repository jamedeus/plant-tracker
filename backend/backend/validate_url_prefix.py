'''Contains function used by backend.backend.settings to validate
URL_PREFIX env var (sets beginning of URL embedded in QR codes).
'''

import re


# Matches manage endpoint with no UUID subpath
# Must begin with either http:// or https://
# Must have valid domain or IP address
# May have optional subdomain(s) or port
# Must end with /manage/ (including trailing /)
PATTERN = r"^(https?://)" \
          r"((([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,})|" \
          r"((25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])\.){3}" \
          r"(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9]))" \
          r"(?::([0-9]{1,5}))?/manage/$"


def validate_url_prefix(url_prefix):
    '''Validates manage endpoint URL prefix used to generate QR code stickers.
    Accepts full URL prefix or bare IP/domain with optional port and subdomain(s)
    Returns /manage endpoint prefix with no UUID, or None if input invalid.
    '''

    # Skip if env var not set
    if url_prefix is None:
        return None

    # Add http:// if protocol missing
    if not url_prefix.startswith(('http://', 'https://')):
        url_prefix = 'http://' + url_prefix

    # Add /manage/ if missing
    if not url_prefix.endswith('/'):
        url_prefix += '/'
    if not url_prefix.endswith('/manage/'):
        url_prefix += 'manage/'

    # Confirm that completed prefix starts with protocol, has valid IP or domain
    # (can have subdomain or port numbers), and ends with /manage/
    if re.match(PATTERN, url_prefix):
        return url_prefix

    # Return None if regex failed
    return None
