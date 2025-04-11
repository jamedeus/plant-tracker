'''Helper function to render react app in boilerplate HTML template'''

import json

from django.shortcuts import render
from django.views.decorators.csrf import ensure_csrf_cookie


@ensure_csrf_cookie
def render_react_app(request, title, bundle, state, log_state=True):
    '''Helper function to render react app in boilerplate HTML template
    Takes request object, page title, react bundle name, and react state object
    Context object is printed to console unless optional log_state arg is False
    '''
    context = {
        'title': title,
        'js_bundle': f'plant_tracker/{bundle}.js',
        'state': state
    }

    if log_state:
        print(json.dumps(context, indent=4))

    return render(request, 'plant_tracker/index.html', context)
