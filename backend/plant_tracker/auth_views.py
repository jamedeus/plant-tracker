import json
from django.contrib.auth import views
from django.db.utils import IntegrityError
from django.contrib.auth.models import User
from django.http import JsonResponse, HttpResponseRedirect
from django.contrib.auth import login, logout, authenticate

from .views import render_react_app
from .view_decorators import requires_json_post


class LoginView(views.LoginView):
    '''LoginView subclass that returns JSON responses instead of redirects.'''

    def form_valid(self, form):
        '''Returns JSON success message instead of redirect.'''
        super().form_valid(form)
        return JsonResponse({"success": "logged in"})

    def form_invalid(self, form):
        '''Returns errors as JSON instead of redirect with error context.'''
        return JsonResponse({"errors": form.errors}, status=400)


def logout_view(request):
    '''Logs the user out and redirects to login page'''
    logout(request)
    return HttpResponseRedirect("/accounts/login/")


def registration_page(request):
    '''Renders the user account registration page'''
    return render_react_app(
        request,
        title='Register Account',
        bundle='register_user',
        state={}
    )


@requires_json_post(["username", "password", "email", "first_name", "last_name"])
def create_user(request, data):
    '''Creates a new user account and returns a response with session cookie.
    Requires JSON POST with username, password, email, first_name, and
    last_name keys.
    '''
    try:
        User.objects.create_user(
            username=data["username"],
            password=data["password"],
            email=data["email"],
            first_name=data["first_name"],
            last_name=data["last_name"],
        )
        user = authenticate(
            request,
            username=data["username"],
            password=data["password"]
        )
        if user is not None:
            login(request, user)
            return JsonResponse({"success": "account created"})
        return JsonResponse({"error": "failed to create account"}, status=400)
    except (ValueError, IntegrityError):
        return JsonResponse({"error": "failed to create account"}, status=400)
