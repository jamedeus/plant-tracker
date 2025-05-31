'''Decorator that turns off post_save signal handlers when loading fixture data.

Without this loaddata will fail if an imported table triggers signals that
reference another table which hasn't been imported yet.

https://docs.djangoproject.com/en/5.2/topics/db/fixtures/#how-fixtures-are-saved-to-the-database
'''

from functools import wraps


def disable_for_loaddata(signal_handler):
    '''Decorator that turns off post_save signal handlers when loading fixture data.'''

    @wraps(signal_handler)
    def wrapper(*args, **kwargs):
        # Set to False (run signal) if kwarg not found (post_delete signals)
        # Only need to disable post_save signals for loaddata
        if kwargs.get("raw", False):
            return  # pragma: no cover
        signal_handler(*args, **kwargs)

    return wrapper
