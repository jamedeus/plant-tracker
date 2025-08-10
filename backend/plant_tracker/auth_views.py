'''Django API endpoint functions for user authentication and account management'''

from django.conf import settings
from django.contrib.auth import views
from django.contrib.auth import get_user_model
from django.core.validators import validate_email
from django.db import transaction, IntegrityError
from django.core.exceptions import ValidationError
from django.utils.decorators import method_decorator
from django.contrib.auth.forms import AuthenticationForm
from django.http import JsonResponse, HttpResponseRedirect
from django.contrib.auth import login, logout, authenticate
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.debug import sensitive_variables
from django.contrib.auth.password_validation import validate_password
from django.utils import timezone

from .views import render_react_app
from .view_decorators import (
    get_user_token,
    requires_json_post,
    disable_in_single_user_mode
)
from .models import UserEmailVerification
from .tasks import send_verification_email

user_model = get_user_model()

# Names of cloudfront signed cookies used when S3 storage is enabled
CLOUDFRONT_COOKIE_NAMES = (
    "CloudFront-Policy",
    "CloudFront-Signature",
    "CloudFront-Key-Pair-Id"
)


class EmailVerificationTokenGenerator(PasswordResetTokenGenerator):
    '''Token generator for email verification that doesn't depend on last_login
    or password hash. Uses user id, email, current verification flag, and timestamp.
    '''
    def _make_hash_value(self, user, timestamp):
        try:
            verified = user.email_verification.is_email_verified
        except Exception:  # pragma: no cover
            verified = False
        return f"{user.pk}{user.email}{int(verified)}{timestamp}"


email_verification_token_generator = EmailVerificationTokenGenerator()


class EmailOrUsernameAuthenticationForm(AuthenticationForm):
    '''AuthenticationForm subclass that accepts email address or username.'''

    def get_credentials(self, username, password):
        '''Takes username and password, returns kwargs for authenticate func.
        If username matches email regex returns as the email kwarg, otherwise
        returns as the username kwarg.
        '''
        if self.is_email(username):
            return {
                "email": username,
                "password": password
            }
        return {
            "username": username,
            "password": password
        }

    def is_email(self, username):
        '''Returns True if arg matches email regex, otherwise returns False.'''
        try:
            validate_email(username)
            return True
        except ValidationError:
            return False

    @sensitive_variables()
    def clean(self):
        '''Identical to AuthenticationForm.clean but accepts user email address
        or username in username field.
        '''
        username = self.cleaned_data.get("username")
        password = self.cleaned_data.get("password")

        # Prevent default user from logging in (only used when login disabled)
        if username == settings.DEFAULT_USERNAME:
            raise self.get_invalid_login_error()

        if username is not None and password:
            # Convert username to correct kwarg (username or email)
            credentials = self.get_credentials(username, password)
            # Authenticate user, return error if failed or login not allowed
            self.user_cache = authenticate(self.request, **credentials)
            if self.user_cache is None:
                raise self.get_invalid_login_error()
            self.confirm_login_allowed(self.user_cache)
        return self.cleaned_data


class LoginView(views.LoginView):
    '''LoginView subclass that returns JSON responses instead of redirects.'''

    # Prevent loading login page if already logged in (redirect to overview)
    redirect_authenticated_user = True

    # Allow logging in with email address instead of username
    form_class = EmailOrUsernameAuthenticationForm

    # Override default django form with boilerplate template + webpack bundles
    template_name = "plant_tracker/index.html"
    extra_context = {
        "title": "Login",
        'js_files': settings.PAGE_DEPENDENCIES['login']['js'],
        'css_files': settings.PAGE_DEPENDENCIES['login']['css']
    }

    @method_decorator(ensure_csrf_cookie)
    @method_decorator(disable_in_single_user_mode)
    def dispatch(self, request, *args, **kwargs):
        '''Returns login page unless SINGLE_USER_MODE is enabled.'''
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
    response = HttpResponseRedirect("/accounts/login/")

    # Delete cloudfront signed cookies (grants access to user's images)
    user = request.user if request.user.is_authenticated else None
    if user:
        for cookie_name in CLOUDFRONT_COOKIE_NAMES:
            response.delete_cookie(
                cookie_name,
                domain=settings.BASE_URL,
                path=f"/user_{user.id}/"
            )

    logout(request)
    return response


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
        if self.request.user.username == settings.DEFAULT_USERNAME:
            return JsonResponse(
                {"error": "cannot change default user password"},
                status=403
            )
        return super().dispatch(*args, **kwargs)

    def form_valid(self, form):
        '''Returns JSON success message instead of redirect.'''
        super().form_valid(form)
        return JsonResponse({"success": "password changed"})

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

    # Enforce password rules (length, common passwords, etc)
    # Don't accept invalid email address syntax
    try:
        validate_password(data["password"], None)
        validate_email(data["email"])
    except ValidationError as e:
        return JsonResponse({"error": e.messages}, status=400)

    try:
        # Create user account
        # transaction.atomic cleans up after IntegrityError if username not unique
        with transaction.atomic():
            user = user_model.objects.create_user(
                username=data["username"],
                password=data["password"],
                email=data["email"],
                first_name=data["first_name"],
                last_name=data["last_name"],
            )

        # Create email verification record
        verification, _ = UserEmailVerification.objects.get_or_create(user=user)
        verification.verification_sent_at = timezone.now()
        verification.save()

        # Send verification email
        uidb64 = urlsafe_base64_encode(force_bytes(user.pk))
        token = email_verification_token_generator.make_token(user)
        send_verification_email.delay(user.email, uidb64, token)

        # Log user in automatically
        user = authenticate(
            request,
            username=data["username"],
            password=data["password"]
        )
        if user is not None:
            login(request, user)
            return JsonResponse({"success": "account created"})
        return JsonResponse({"error": ["failed to create account"]}, status=400)
    except ValueError:
        return JsonResponse({"error": ["missing required field"]}, status=400)
    except IntegrityError as e:
        duplicate = 'email' if 'email' in str(e) else 'username'
        return JsonResponse({"error": [f"{duplicate} already exists"]}, status=409)


@disable_in_single_user_mode
def verify_email(request, uidb64, token):
    '''Verifies a user's email address (called from link in verification email).'''
    try:
        uid = urlsafe_base64_decode(uidb64).decode()
    except Exception:  # pragma: no cover - defensive
        return JsonResponse({"error": "invalid or expired verification link"}, status=400)

    try:
        user = user_model.objects.get(pk=uid)
    except user_model.DoesNotExist:
        return JsonResponse({"error": "invalid or expired verification link"}, status=400)

    if not email_verification_token_generator.check_token(user, token):
        return JsonResponse({"error": "invalid or expired verification link"}, status=400)

    verification, _ = UserEmailVerification.objects.get_or_create(user=user)
    if not verification.is_email_verified:
        verification.mark_verified()

    return JsonResponse({"success": "email verified"})


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

    # Don't accept invalid email address syntax
    try:
        validate_email(data["email"])
    except ValidationError as e:
        return JsonResponse({"error": e.messages}, status=400)

    user.email = data["email"]
    user.first_name = data["first_name"]
    user.last_name = data["last_name"]
    user.save()
    return JsonResponse({
        "success": "details updated",
        "user_details": {
            "username": user.username,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "date_joined": user.date_joined.isoformat()
        }
    })
