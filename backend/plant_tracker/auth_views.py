'''Django API endpoint functions for user authentication and account management'''

from django.conf import settings
from django.contrib.auth import views
from django.contrib.auth import get_user_model
from django.db import transaction, IntegrityError
from django.http import JsonResponse, HttpResponseRedirect
from django.contrib.auth import login, logout, authenticate

from .views import render_react_app, render_permission_denied_page
from .view_decorators import (
    get_user_token,
    requires_json_post,
    disable_in_single_user_mode
)

user_model = get_user_model()


class LoginView(views.LoginView):
    '''LoginView subclass that returns JSON responses instead of redirects.'''

    # Prevent loading login page if already logged in (redirect to overview)
    redirect_authenticated_user = True

    # Override default django form with boilerplate template + react bundle
    template_name = "plant_tracker/index.html"
    extra_context = {
        "title": "Login",
        "js_bundle": "plant_tracker/login.js"
    }

    def dispatch(self, request, *args, **kwargs):
        '''Returns login page unless SINGLE_USER_MODE is enabled.'''
        if settings.SINGLE_USER_MODE:
            # User requesting login page
            if request.method == "GET":
                return render_permission_denied_page(
                    request,
                    'User accounts are disabled'
                )
            # User submitting credentials from login page form
            return JsonResponse(
                {"error": "user accounts are disabled"},
                status=400
            )
        return super().dispatch(request, *args, **kwargs)

    def form_valid(self, form):
        '''Returns JSON success message instead of redirect.'''
        super().form_valid(form)
        return JsonResponse({"success": "logged in"})

    def form_invalid(self, form):
        '''Returns errors as JSON instead of redirect with error context.'''
        return JsonResponse({"errors": form.errors}, status=400)


@disable_in_single_user_mode
def logout_view(request):
    '''Logs the user out and redirects to login page'''
    logout(request)
    return HttpResponseRedirect("/accounts/login/")


class PasswordChangeView(views.PasswordChangeView):
    '''PasswordChangeView subclass that returns JSON responses instead of redirects.'''

    success_url = "/"

    def dispatch(self, *args, **kwargs):
        '''Changes password unless SINGLE_USER_MODE is enabled.'''
        if settings.SINGLE_USER_MODE:
            return JsonResponse(
                {"error": "user accounts are disabled"},
                status=400
            )
        return super().dispatch(*args, **kwargs)

    def form_valid(self, form):
        '''Returns JSON success message instead of redirect.'''
        super().form_valid(form)
        return JsonResponse({"success": "password_changed"})

    def form_invalid(self, form):
        '''Returns errors as JSON instead of redirect with error context.'''
        return JsonResponse({"errors": form.errors}, status=400)


@disable_in_single_user_mode
@requires_json_post(["username", "password", "email", "first_name", "last_name"])
def create_user(request, data):
    '''Creates a new user account and returns a response with session cookie.
    Requires JSON POST with username, password, email, first_name, and
    last_name keys.
    '''
    try:
        # transaction.atomic cleans up after IntegrityError if username not unique
        with transaction.atomic():
            user_model.objects.create_user(
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


@get_user_token
@disable_in_single_user_mode
def user_profile_page(request, user):
    '''Renders the user profile page'''

    return render_react_app(
        request,
        title='User Profile',
        bundle='user_profile',
        state={
            'user_details': {
                'username': user.username,
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'date_joined': user.date_joined.isoformat()
            }
        }
    )


@get_user_token
@disable_in_single_user_mode
@requires_json_post(["email", "first_name", "last_name"])
def edit_user_details(data, user, **kwargs):
    '''Updates details of an existing user account.
    Requires JSON POST with email, first_name, and last_name keys.
    '''
    user.email = data["email"]
    user.first_name = data["first_name"]
    user.last_name = data["last_name"]
    user.save()
    return JsonResponse({"success": "details updated"})
