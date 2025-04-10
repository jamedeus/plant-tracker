import json
from django.contrib.auth import views
from django.contrib.auth.models import User
from django.db import transaction, IntegrityError
from django.http import JsonResponse, HttpResponseRedirect
from django.contrib.auth import login, logout, authenticate

from .views import render_react_app
from .view_decorators import get_user_token, requires_json_post


class LoginView(views.LoginView):
    '''LoginView subclass that returns JSON responses instead of redirects.'''

    # Prevent loading login page if already logged in (redirect to overview)
    redirect_authenticated_user = True

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

    # Redirect users that are already logged in to overview
    if request.user.is_authenticated:
        return HttpResponseRedirect('/')

    return render_react_app(
        request,
        title='Register Account',
        bundle='register_user',
        state={}
    )


class PasswordChangeView(views.PasswordChangeView):
    '''PasswordChangeView subclass that returns JSON responses instead of redirects.'''

    success_url = "/"

    def form_valid(self, form):
        '''Returns JSON success message instead of redirect.'''
        super().form_valid(form)
        return JsonResponse({"success": "password_changed"})

    def form_invalid(self, form):
        '''Returns errors as JSON instead of redirect with error context.'''
        return JsonResponse({"errors": form.errors}, status=400)


@get_user_token
def change_password_page(request, **kwargs):
    '''Renders the change password page'''

    return render_react_app(
        request,
        title='Change Password',
        bundle='change_password',
        state={}
    )


@requires_json_post(["username", "password", "email", "first_name", "last_name"])
def create_user(request, data):
    '''Creates a new user account and returns a response with session cookie.
    Requires JSON POST with username, password, email, first_name, and
    last_name keys.
    '''
    try:
        # transaction.atomic cleans up after IntegrityError if username not unique
        with transaction.atomic():
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
    except ValueError:
        return JsonResponse({"error": "missing required field"}, status=400)
    except IntegrityError:
        return JsonResponse({"error": "username already exists"}, status=409)
