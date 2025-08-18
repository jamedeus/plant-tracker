'''Helper function to render react app in boilerplate HTML template'''

import json

from django.conf import settings
from django.shortcuts import render
from django.views.decorators.csrf import ensure_csrf_cookie


@ensure_csrf_cookie
def render_react_app(request, title, error=None):
    '''Helper function to render SPA template. Initial request only includes
    SPA bundles, page bundles will be lazy loaded basaed on route. If error is
    given it will be saved as a hidden JSON object (used by permission denied).
    '''
    context = {
        'title': title,
        'user_accounts_enabled': not settings.SINGLE_USER_MODE,
        'error': error,
    }

    # Print full context object to console in debug mode
    if settings.DEBUG:
        print(json.dumps(context, indent=4))

    return render(request, 'plant_tracker/index.html', context)


def render_permission_denied_page(request, error_string):
    '''Helper function to render permission denied page with custom error.
    Takes request object and error string to display to user.
    Does NOT render SPA shell (loaded after user navigates to different page).
    '''
    context = {
        'user_accounts_enabled': not settings.SINGLE_USER_MODE,
        'error': error_string,
    }
    return render(request, 'plant_tracker/permission_denied.html', context)
