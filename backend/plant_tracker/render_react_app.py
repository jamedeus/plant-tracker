'''Helper function to render react app in boilerplate HTML template'''

import json

from django.conf import settings
from django.shortcuts import render
from django.views.decorators.csrf import ensure_csrf_cookie


@ensure_csrf_cookie
def render_react_app(request, title, bundle, state, log_state=True):
    '''Helper function to render react app in boilerplate HTML template.
    Takes request object, page title, react bundle name, and react state object.
    Builds context with all JS + CSS bundles for page (read from manifest.json).
    Context object is printed to console unless optional log_state arg is False.
    '''
    context = {
        'title': title,
        'js_files': settings.PAGE_DEPENDENCIES[bundle]['js'],
        'css_files': settings.PAGE_DEPENDENCIES[bundle]['css'],
        'state': state,
        'user_accounts_enabled': not settings.SINGLE_USER_MODE
    }

    if log_state:
        print(json.dumps(context, indent=4))

    return render(request, 'plant_tracker/index.html', context)


def render_permission_denied_page(request, error_string):
    '''Helper function to render permission denied page with custom error.
    Takes request object and error string to display to user.
    '''
    return render_react_app(
        request,
        title='Permission Denied',
        bundle='permission_denied',
        state={'error': error_string}
    )
