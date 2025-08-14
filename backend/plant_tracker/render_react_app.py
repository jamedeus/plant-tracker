'''Helper function to render react app in boilerplate HTML template'''

import json

from django.conf import settings
from django.shortcuts import render
from django.views.decorators.csrf import ensure_csrf_cookie


@ensure_csrf_cookie
def render_react_app(request, title, bundle, state):
    '''Helper function to render react app in boilerplate HTML template.
    Takes request object, page title, react bundle name, and react state object.
    Builds context with all JS + CSS bundles for page (read from manifest.json).
    Context object is printed to console in debug mode.
    '''
    context = {
        'title': title,
        'js_files': settings.PAGE_DEPENDENCIES[bundle]['js'],
        'css_files': settings.PAGE_DEPENDENCIES[bundle]['css'],
        'state': state,
        'user_accounts_enabled': not settings.SINGLE_USER_MODE
    }

    # Print full context object to console in debug mode
    if settings.DEBUG:
        print(json.dumps(context, indent=4))

    return render(request, 'plant_tracker/index.html', context)


def render_permission_denied_page(request, error_string):
    '''Helper function to render permission denied page with custom error.
    Takes request object and error string to display to user.
    '''
    return render_react_app(
        request,
        title='Permission Denied',
        bundle='spa',
        state={'error': error_string}
    )
