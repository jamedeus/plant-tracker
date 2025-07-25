# pylint: disable=missing-docstring,too-many-lines

from uuid import uuid4
from urllib.parse import urlencode

from django.contrib import auth
from django.conf import settings
from django.test import TestCase
from django.core.cache import cache
from django.contrib.auth import get_user_model
from django.test.client import MULTIPART_CONTENT

from .models import Plant, Group
from .view_decorators import get_default_user
from .unit_test_helpers import JSONClient, create_mock_photo

user_model = get_user_model()


class AuthenticationPageTests(TestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.test_user = user_model.objects.create_user(
            username='unittest',
            password='12345',
            first_name='Bob',
            last_name='Smith',
            email='bob.smith@hotmail.com'
        )

    def setUp(self):
        # Clear entire cache before each test
        cache.clear()

        # Set default content_type for post requests (avoid long lines)
        self.client = JSONClient()

        # Ensure SINGLE_USER_MODE is disabled
        settings.SINGLE_USER_MODE = False

    def tearDown(self):
        # Ensure user logged out between tests
        self.client.logout()

    def test_login_page(self):
        # Request login page, confirm uses correct JS bundle and title
        response = self.client.get('/accounts/login/')
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'plant_tracker/index.html')
        self.assertEqual(response.context['title'], 'Login')
        self.assertEqual(
            response.context['js_files'],
            settings.PAGE_DEPENDENCIES['login']['js']
        )
        self.assertEqual(
            response.context['css_files'],
            settings.PAGE_DEPENDENCIES['login']['css']
        )

    def test_user_profile_page(self):
        # Log in with test user
        self.client.login(username='unittest', password='12345')

        # Request profle page, confirm uses correct JS bundle and title
        response = self.client.get('/accounts/profile/')
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'plant_tracker/index.html')
        self.assertEqual(response.context['title'], 'User Profile')
        self.assertEqual(
            response.context['js_files'],
            settings.PAGE_DEPENDENCIES['user_profile']['js']
        )

        # Confirm context contains current user account details
        details_context = response.context['state']['user_details']
        self.assertEqual(details_context['first_name'], 'Bob')
        self.assertEqual(details_context['last_name'], 'Smith')
        self.assertEqual(details_context['email'], 'bob.smith@hotmail.com')

    def test_user_profile_page_not_signed_in(self):
        # Request user profile page without signing in
        self.assertFalse(auth.get_user(self.client).is_authenticated)
        response = self.client.get('/accounts/profile/')

        # Confirm redirected to login page with requested URL in querystring
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.url, '/accounts/login/?next=/accounts/profile/')


class AuthenticationEndpointTests(TestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.test_user = user_model.objects.create_user(
            username='unittest',
            password='12345',
            first_name='Bob',
            last_name='Smith',
            email='bob.smith@hotmail.com'
        )

    def setUp(self):
        # Clear entire cache before each test
        cache.clear()

        # Set default content_type for post requests (avoid long lines)
        self.client = JSONClient()

        # Ensure SINGLE_USER_MODE is disabled
        settings.SINGLE_USER_MODE = False

    def tearDown(self):
        # Ensure user logged out between tests
        self.client.logout()

    def test_login_with_valid_credentials(self):
        # POST valid credentials to login endpoint
        response = self.client.post(
            "/accounts/login/",
            urlencode({"username": "unittest", "password": "12345"}),
            content_type="application/x-www-form-urlencoded"
        )

        # Confirm returns JSON response with status 200 (not 302)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"success": "logged in"})

    def test_login_with_valid_email_address(self):
        # POST valid credentials with email in username field to login endpoint
        response = self.client.post(
            "/accounts/login/",
            urlencode({"username": "bob.smith@hotmail.com", "password": "12345"}),
            content_type="application/x-www-form-urlencoded"
        )

        # Confirm returns JSON response with status 200 (not 302)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"success": "logged in"})

    def test_login_with_invalid_credentials(self):
        # POST invalid credentials to login endpoint
        response = self.client.post(
            "/accounts/login/",
            urlencode({"username": "unittest", "password": "wrong"}),
            content_type="application/x-www-form-urlencoded"
        )

        # Confirm returns JSON response with status 400 (not 302)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {
            "errors": {
                "__all__": [
                    # pylint: disable-next=line-too-long
                    "Please enter a correct username and password. Note that both fields may be case-sensitive."
                ]
            }
        })

    def test_login_as_default_user(self):
        # Attempt to log in as default user (does not have password)
        response = self.client.post(
            "/accounts/login/",
            urlencode({"username": settings.DEFAULT_USERNAME, "password": ""}),
            content_type="application/x-www-form-urlencoded"
        )

        # Confirm login rejected (default user only used when SINGLE_USER_MODE
        # is enabled, default user does not need to log in)
        self.assertEqual(response.status_code, 400)

    def test_login_with_missing_parameters(self):
        # POST invalid credentials with no password to login endpoint
        response = self.client.post(
            "/accounts/login/",
            urlencode({"username": "unittest", "password": ""}),
            content_type="application/x-www-form-urlencoded"
        )

        # Confirm returns JSON response with status 400 (not 302)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {
            "errors": {
                "password": [
                    "This field is required."
                ]
            }
        })

    def test_logout_endpoint(self):
        # Log in with test user, confirm authenticated
        self.client.login(username='unittest', password='12345')
        self.assertTrue(auth.get_user(self.client).is_authenticated)

        # Request logout endpoint, confirm no longer authenticated
        response = self.client.get('/accounts/logout/')
        self.assertFalse(auth.get_user(self.client).is_authenticated)

        # Confirm redirected to login page
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.url, '/accounts/login/')

    def test_create_user_endpoint(self):
        # Confirm 2 users in database (default + test user from setUpClass)
        self.assertEqual(len(user_model.objects.all()), 2)

        # Post new account credentials to create_user endpoint
        response = self.client.post('/accounts/create_user/', {
            'username': 'newuser',
            'password': 'acceptablepasswordlength',
            'email': 'myfirstemail@hotmail.com',
            'first_name': '',
            'last_name': ''
        })

        # Confirm expected response
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"success": "account created"})

        # Confirm user created in database, did not store password as cleartext
        self.assertEqual(len(user_model.objects.all()), 3)
        user = user_model.objects.get(username='newuser')
        self.assertNotEqual(user.password, 'acceptablepasswordlength')

    def test_create_user_endpoint_missing_fields(self):
        # Confirm 2 users in database (default + test user from setUpClass)
        self.assertEqual(len(user_model.objects.all()), 2)

        # Post payload with no username to create_user endpoint
        response = self.client.post('/accounts/create_user/', {
            'username': '',
            'password': 'acceptablepasswordlength',
            'email': 'myfirstemail@hotmail.com',
            'first_name': '',
            'last_name': ''
        })

        # Confirm expected response
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"error": ["missing required field"]})

        # Confirm no user created in database
        self.assertEqual(len(user_model.objects.all()), 2)

    def test_create_user_endpoint_duplicate_username(self):
        # Confirm 2 users in database (default + test user from setUpClass)
        self.assertEqual(len(user_model.objects.all()), 2)

        # Post same username as existing test user to create_user endpoint
        response = self.client.post('/accounts/create_user/', {
            'username': 'unittest',
            'password': 'acceptablepasswordlength',
            'email': 'myfirstemail@hotmail.com',
            'first_name': '',
            'last_name': ''
        })

        # Confirm expected response
        self.assertEqual(response.status_code, 409)
        self.assertEqual(
            response.json(),
            {"error": ["username already exists"]}
        )

        # Confirm no user created in database
        self.assertEqual(len(user_model.objects.all()), 2)

    def test_create_user_endpoint_duplicate_email(self):
        # Confirm 2 users in database (default + test user from setUpClass)
        self.assertEqual(len(user_model.objects.all()), 2)

        # Post same email as existing test user to create_user endpoint
        response = self.client.post('/accounts/create_user/', {
            'username': 'newuser',
            'password': 'acceptablepasswordlength',
            'email': 'bob.smith@hotmail.com',
            'first_name': '',
            'last_name': ''
        })

        # Confirm expected response
        self.assertEqual(response.status_code, 409)
        self.assertEqual(
            response.json(),
            {"error": ["email already exists"]}
        )

        # Confirm no user created in database
        self.assertEqual(len(user_model.objects.all()), 2)

    def test_create_user_endpoint_invalid_email(self):
        # Confirm 2 users in database (default + test user from setUpClass)
        self.assertEqual(len(user_model.objects.all()), 2)

        # Post email address with invalid syntax to create_user endpoint
        response = self.client.post('/accounts/create_user/', {
            'username': 'newuser',
            'password': 'acceptablepasswordlength',
            'email': 'bob.smith',
            'first_name': '',
            'last_name': ''
        })

        # Confirm expected response
        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.json(),
            {"error": ["Enter a valid email address."]}
        )

        # Confirm no user created in database
        self.assertEqual(len(user_model.objects.all()), 2)

    def test_create_user_endpoint_common_password(self):
        # Confirm 2 users in database (default + test user from setUpClass)
        self.assertEqual(len(user_model.objects.all()), 2)

        # Post password that is on the banned common passwords list
        response = self.client.post('/accounts/create_user/', {
            'username': 'newuser',
            'password': 'password',
            'email': 'myfirstemail@hotmail.com',
            'first_name': '',
            'last_name': ''
        })

        # Confirm expected response
        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.json(),
            {"error": ["This password is too common."]}
        )

        # Confirm no user created in database
        self.assertEqual(len(user_model.objects.all()), 2)

    def test_change_password_endpoint(self):
        # Log in with test user
        self.client.login(username='unittest', password='12345')

        # Post old and new passwords to change_password endpoint
        response = self.client.post('/accounts/change_password/',
            urlencode({
                'old_password': '12345',
                'new_password1': 'more secure password',
                'new_password2': 'more secure password',
            }),
            content_type="application/x-www-form-urlencoded"
        )

        # Confirm success response
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"success": "password changed"})

        # Confirm did not store password as cleartext
        user = user_model.objects.get(username='unittest')
        self.assertNotEqual(user.password, 'more secure password')

    def test_change_password_endpoint_errors(self):
        # Log in with test user
        self.client.login(username='unittest', password='12345')

        # Post new passwords that do not match to change_password endpoint
        response = self.client.post('/accounts/change_password/',
            urlencode({
                'old_password': '12345',
                'new_password1': 'more secure password',
                'new_password2': 'nore secure password',
            }),
            content_type="application/x-www-form-urlencoded"
        )

        # Confirm expected error response
        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.json()['errors'],
            {'new_password2': ['The two password fields didn’t match.']}
        )

    def test_change_password_endpoint_default_user(self):
        # Log in with default user (should not be possible in prod)
        self.client.force_login(get_default_user())

        # Post old and new passwords to change_password endpoint
        response = self.client.post('/accounts/change_password/',
            urlencode({
                'old_password': '',
                'new_password1': 'more secure password',
                'new_password2': 'more secure password',
            }),
            content_type="application/x-www-form-urlencoded"
        )

        # Confirm expected error (refuses to change default user password)
        self.assertEqual(response.status_code, 403)
        self.assertEqual(
            response.json(),
            {"error": "cannot change default user password"}
        )

    def test_edit_user_details_endpoint(self):
        # Confirm initial test user details
        self.assertEqual(self.test_user.first_name, 'Bob')
        self.assertEqual(self.test_user.last_name, 'Smith')
        self.assertEqual(self.test_user.email, 'bob.smith@hotmail.com')

        # Log in with test user, post new account details to backend
        self.client.login(username='unittest', password='12345')
        response = self.client.post('/accounts/edit_user_details/', {
            'first_name': 'Anthony',
            'last_name': 'Weiner',
            'email': 'carlosdanger@hotmail.com'
        })

        # Confirm success response
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {
                "success": "details updated",
                "user_details": {
                    "username": "unittest",
                    "email": "carlosdanger@hotmail.com",
                    "first_name": "Anthony",
                    "last_name": "Weiner",
                    "date_joined": self.test_user.date_joined.isoformat()
                }
            }
        )

        # Confirm test user details were updated
        self.test_user.refresh_from_db()
        self.assertEqual(self.test_user.first_name, 'Anthony')
        self.assertEqual(self.test_user.last_name, 'Weiner')
        self.assertEqual(self.test_user.email, 'carlosdanger@hotmail.com')

    def test_edit_user_details_endpoint_errors(self):
        # Log in with test user, post new account details with invalid email
        self.client.login(username='unittest', password='12345')
        response = self.client.post('/accounts/edit_user_details/', {
            'first_name': 'Anthony',
            'last_name': 'Weiner',
            'email': 'carlosdanger'
        })

        # Confirm expected error response
        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.json(),
            {"error": ["Enter a valid email address."]}
        )


class SingleUserModeTests(TestCase):
    def setUp(self):
        # Clear entire cache before each test
        cache.clear()

        # Set default content_type for post requests (avoid long lines)
        self.client = JSONClient()

        # Ensure SINGLE_USER_MODE is enabled
        settings.SINGLE_USER_MODE = True

    # pylint: disable-next=invalid-name
    def assertReceivedPermissionDeniedPage(self, response):
        '''Takes response object, confirms received status 200 with boilerplate
        index.html, permission_denied.js, and page title "Permission Denied".
        '''
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'plant_tracker/index.html')
        self.assertEqual(response.context['title'], 'Permission Denied')
        self.assertEqual(
            response.context['js_files'],
            settings.PAGE_DEPENDENCIES['permission_denied']['js']
        )

    # pylint: disable-next=invalid-name
    def assertReceivedUserAccountsDisabledError(self, response):
        '''Takes response object, confirms received JSON response with status
        400 and payload {"error": "user accounts are disabled"}.
        '''
        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.json(),
            {"error": "user accounts are disabled"}
        )

    def test_user_accounts_enabled_context(self):
        # Create test plant and group owned by default user
        plant = Plant.objects.create(uuid=uuid4(), user=get_default_user())
        group = Group.objects.create(uuid=uuid4(), user=get_default_user())

        # Confirm all pages have user_accounts_enabled set to False
        for url in ['/', f'/manage/{plant.uuid}', f'/manage/{group.uuid}']:
            response = self.client.get(url)
            self.assertFalse(response.context['user_accounts_enabled'])

    def test_login_page(self):
        # Request login page while SINGLE_USER_MODE is enabled
        response = self.client.get('/accounts/login/')

        # Confirm returns permission denied page
        self.assertReceivedPermissionDeniedPage(response)
        self.assertEqual(
            response.context['state'],
            {'error': 'User accounts are disabled'}
        )

    def test_login_endpoint(self):
        # POST credentials to login endpoint while SINGLE_USER_MODE is enabled
        self.assertReceivedUserAccountsDisabledError(
            self.client.post(
                "/accounts/login/",
                urlencode({"username": "unittest", "password": "12345"}),
                content_type="application/x-www-form-urlencoded"
            )
        )

    def test_logout(self):
        # Request logout endpoint while SINGLE_USER_MODE is enabled
        response = self.client.get('/accounts/logout/')

        # Confirm returns permission denied page
        self.assertReceivedPermissionDeniedPage(response)
        self.assertEqual(
            response.context['state'],
            {'error': 'User accounts are disabled'}
        )

    def test_create_user_endpoint(self):
        # Post new account credentials while SINGLE_USER_MODE is enabled
        self.assertReceivedUserAccountsDisabledError(
            self.client.post('/accounts/create_user/', {
                'username': 'newuser',
                'password': 'acceptablepasswordlength',
                'email': 'myfirstemail@hotmail.com',
                'first_name': '',
                'last_name': ''
            })
        )

    def test_change_password_endpoint(self):
        # Post new password while SINGLE_USER_MODE is enabled
        self.assertReceivedUserAccountsDisabledError(
            self.client.post('/accounts/change_password/',
                urlencode({
                    'old_password': '12345',
                    'new_password1': 'more secure password',
                    'new_password2': 'nore secure password',
                }),
                content_type="application/x-www-form-urlencoded"
            )
        )

    def test_user_profile_page(self):
        # Request profle page while SINGLE_USER_MODE is enabled
        response = self.client.get('/accounts/profile/')

        # Confirm returns permission denied page
        self.assertReceivedPermissionDeniedPage(response)
        self.assertEqual(
            response.context['state'],
            {'error': 'User accounts are disabled'}
        )

    def test_edit_user_details_endpoint(self):
        # Submit new user details while SINGLE_USER_MODE is enabled
        self.assertReceivedUserAccountsDisabledError(
            self.client.post('/accounts/edit_user_details/', {
                'first_name': 'Anthony',
                'last_name': 'Weiner',
                'email': 'carlosdanger@hotmail.com'
            })
        )

    def test_overview_page(self):
        # Create second user (in addition to default user)
        test_user = user_model.objects.create_user(
            username='test',
            password='123',
            email='test@aol.com'
        )

        # Create 1 plant owned by default user, 1 plant owned by test user
        plant = Plant.objects.create(
            uuid=uuid4(),
            name='default user plant',
            user=get_default_user()
        )
        Plant.objects.create(
            uuid=uuid4(),
            name='test user plant',
            user=test_user
        )

        # Ensure logged out, request overview page
        self.assertFalse(auth.get_user(self.client).is_authenticated)
        response = self.client.get('/')

        # Confirm loaded with no authentication, title does not include name
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'plant_tracker/index.html')
        self.assertEqual(response.context['title'], 'Plant Overview')
        self.assertEqual(
            response.context['js_files'],
            settings.PAGE_DEPENDENCIES['overview']['js']
        )

        # Confirm only contains default user's plant
        self.assertEqual(len(response.context['state']['plants']), 1)
        self.assertEqual(
            response.context['state']['plants'][str(plant.uuid)]['name'],
            'default user plant'
        )

    def test_manage_plant_page_user_owns_plant(self):
        # Create plant owned by default user
        plant = Plant.objects.create(uuid=uuid4(), user=get_default_user())

        # Request manage page (comes from default user since SINGLE_USER_MODE enabled)
        response = self.client.get(f'/manage/{plant.uuid}')

        # Confirm rendered manage plant page
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'plant_tracker/index.html')
        self.assertEqual(response.context['title'], 'Manage Plant')
        self.assertEqual(
            response.context['js_files'],
            settings.PAGE_DEPENDENCIES['manage_plant']['js']
        )

    def test_manage_plant_page_user_does_not_own_plant(self):
        # Create second user (in addition to default user) + plant for user
        test_user = user_model.objects.create_user(
            username='test',
            password='123',
            email='test@aol.com'
        )
        plant = Plant.objects.create(uuid=uuid4(), user=test_user)

        # Request manage page (comes from default user since SINGLE_USER_MODE enabled)
        response = self.client.get(f'/manage/{plant.uuid}')

        # Confirm rendered permission denied page, not manage plant
        self.assertReceivedPermissionDeniedPage(response)
        self.assertEqual(
            response.context['state']['error'],
            'You do not have permission to view this plant'
        )

    def test_get_plant_state_user_owns_plant(self):
        # Create plant owned by default user
        plant = Plant.objects.create(uuid=uuid4(), user=get_default_user())

        # Request plant state (comes from default user since SINGLE_USER_MODE enabled)
        response = self.client.get(f'/get_plant_state/{plant.uuid}')

        # Confirm received plant state
        self.assertEqual(response.status_code, 200)
        self.assertTrue(isinstance(response.json(), dict))
        self.assertEqual(response.json()['plant_details']['uuid'], str(plant.uuid))

    def test_get_plant_state_user_does_not_own_plant(self):
        # Create second user (in addition to default user) + plant for user
        test_user = user_model.objects.create_user(
            username='test',
            password='123',
            email='test@aol.com'
        )
        plant = Plant.objects.create(uuid=uuid4(), user=test_user)

        # Request manage page (comes from default user since SINGLE_USER_MODE enabled)
        response = self.client.get(f'/get_plant_state/{plant.uuid}')

        # Confirm received error response, not plant state
        self.assertEqual(response.status_code, 403)
        self.assertEqual(
            response.json(),
            {"error": "plant is owned by a different user"}
        )

    def test_manage_group_page_user_owns_group(self):
        # Create group owned by default user
        group = Group.objects.create(uuid=uuid4(), user=get_default_user())

        # Request manage page (comes from default user since SINGLE_USER_MODE enabled)
        response = self.client.get(f'/manage/{group.uuid}')

        # Confirm rendered manage group page
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'plant_tracker/index.html')
        self.assertEqual(response.context['title'], 'Manage Group')
        self.assertEqual(
            response.context['js_files'],
            settings.PAGE_DEPENDENCIES['manage_group']['js']
        )

    def test_manage_group_page_user_does_not_own_group(self):
        # Create second user (in addition to default user) + group for user
        test_user = user_model.objects.create_user(
            username='test',
            password='123',
            email='test@aol.com'
        )
        group = Group.objects.create(uuid=uuid4(), user=test_user)

        # Request manage page (comes from default user since SINGLE_USER_MODE enabled)
        response = self.client.get(f'/manage/{group.uuid}')

        # Confirm rendered permission denied page, not manage group
        self.assertReceivedPermissionDeniedPage(response)
        self.assertEqual(
            response.context['state']['error'],
            'You do not have permission to view this group'
        )

    def test_get_group_state_user_owns_group(self):
        # Create group owned by default user
        group = Group.objects.create(uuid=uuid4(), user=get_default_user())

        # Request group state (comes from default user since SINGLE_USER_MODE enabled)
        response = self.client.get(f'/get_group_state/{group.uuid}')

        # Confirm received group state
        self.assertEqual(response.status_code, 200)
        self.assertTrue(isinstance(response.json(), dict))
        self.assertEqual(response.json()['group_details']['uuid'], str(group.uuid))

    def test_get_group_state_user_does_not_own_group(self):
        # Create second user (in addition to default user) + group for user
        test_user = user_model.objects.create_user(
            username='test',
            password='123',
            email='test@aol.com'
        )
        group = Group.objects.create(uuid=uuid4(), user=test_user)

        # Request manage page (comes from default user since SINGLE_USER_MODE enabled)
        response = self.client.get(f'/get_group_state/{group.uuid}')

        # Confirm received error response, not group state
        self.assertEqual(response.status_code, 403)
        self.assertEqual(
            response.json(),
            {"error": "group is owned by a different user"}
        )


class MultiUserModeTests(TestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.test_user = user_model.objects.create_user(
            username='unittest',
            password='12345',
            first_name='Bob',
            last_name='Smith',
            email='bob.smith@hotmail.com'
        )

    def setUp(self):
        # Clear entire cache before each test
        cache.clear()

        # Set default content_type for post requests (avoid long lines)
        self.client = JSONClient()

        # Ensure SINGLE_USER_MODE is disabled
        settings.SINGLE_USER_MODE = False

    def tearDown(self):
        # Ensure user logged out between tests
        self.client.logout()

    # pylint: disable-next=invalid-name
    def assertAuthenticationRequiredError(self, response):
        '''Takes response object, confirms received JSON response with status
        401 and payload {"error": "authentication required"}.
        '''
        self.assertEqual(response.status_code, 401)
        self.assertEqual(
            response.json(),
            {"error": "authentication required"}
        )

    # pylint: disable-next=invalid-name
    def assertPlantIsOwnedByADifferentUserError(self, response):
        '''Takes response object, confirms received JSON response with status
        403 and payload {"error": "plant is owned by a different user"}.
        '''
        self.assertEqual(response.status_code, 403)
        self.assertEqual(
            response.json(),
            {"error": "plant is owned by a different user"}
        )

    # pylint: disable-next=invalid-name
    def assertInstanceIsOwnedByADifferentUserError(self, response):
        '''Takes response object, confirms received JSON response with status
        403 and payload {"error": "instance is owned by a different user"}.
        '''
        self.assertEqual(response.status_code, 403)
        self.assertEqual(
            response.json(),
            {"error": "instance is owned by a different user"}
        )

    # pylint: disable-next=invalid-name
    def assertGroupIsOwnedByADifferentUserError(self, response):
        '''Takes response object, confirms received JSON response with status
        403 and payload {"error": "group is owned by a different user"}.
        '''
        self.assertEqual(response.status_code, 403)
        self.assertEqual(
            response.json(),
            {"error": "group is owned by a different user"}
        )

    def test_user_accounts_enabled_context(self):
        # Create test plant and group
        plant = Plant.objects.create(uuid=uuid4(), user=self.test_user)
        group = Group.objects.create(uuid=uuid4(), user=self.test_user)

        # Log in as test user
        self.client.login(username='unittest', password='12345')
        response = self.client.get('/')

        # Confirm all pages have user_accounts_enabled set to True
        for url in ['/', f'/manage/{plant.uuid}', f'/manage/{group.uuid}']:
            response = self.client.get(url)
            self.assertTrue(response.context['user_accounts_enabled'])

    def test_overview_page_signed_in(self):
        # Request overview page while signed in
        self.client.login(username='unittest', password='12345')
        response = self.client.get('/')

        # Confirm page loads, title includes user's first name
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.context['title'], "Bob's Plants")
        self.assertTemplateUsed(response, 'plant_tracker/index.html')

        # Confirm user_accounts_enabled context is true
        self.assertTrue(response.context['user_accounts_enabled'])

    def test_overview_page_not_signed_in(self):
        # Request overview page while not signed in
        self.assertFalse(auth.get_user(self.client).is_authenticated)
        response = self.client.get('/')

        # Confirm redirected to login page with requested URL in querystring
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.url, '/accounts/login/?next=/')

    def test_manage_plant_page_signed_in(self):
        # Create plant owned by test user
        plant = Plant.objects.create(uuid=uuid4(), user=self.test_user)

        # Sign in, request manage page
        self.client.login(username='unittest', password='12345')
        response = self.client.get(f'/manage/{plant.uuid}')

        # Confirm rendered manage plant page
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'plant_tracker/index.html')
        self.assertEqual(response.context['title'], 'Manage Plant')
        self.assertEqual(
            response.context['js_files'],
            settings.PAGE_DEPENDENCIES['manage_plant']['js']
        )

    def test_manage_plant_page_not_signed_in(self):
        # Create plant owned by test user
        plant = Plant.objects.create(uuid=uuid4(), user=self.test_user)

        # Request manage page without signing in
        self.assertFalse(auth.get_user(self.client).is_authenticated)
        response = self.client.get(f'/manage/{plant.uuid}')

        # Confirm redirected to login page with requested URL in querystring
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.url, f'/accounts/login/?next=/manage/{plant.uuid}')

    def test_manage_group_page_signed_in(self):
        # Create group owned by test user
        group = Group.objects.create(uuid=uuid4(), user=self.test_user)

        # Sign in, request manage page
        self.client.login(username='unittest', password='12345')
        response = self.client.get(f'/manage/{group.uuid}')

        # Confirm rendered manage group page
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'plant_tracker/index.html')
        self.assertEqual(response.context['title'], 'Manage Group')
        self.assertEqual(
            response.context['js_files'],
            settings.PAGE_DEPENDENCIES['manage_group']['js']
        )

    def test_manage_group_page_not_signed_in(self):
        # Create group owned by test user
        group = Group.objects.create(uuid=uuid4(), user=self.test_user)

        # Request manage page without signing in
        self.assertFalse(auth.get_user(self.client).is_authenticated)
        response = self.client.get(f'/manage/{group.uuid}')

        # Confirm redirected to login page with requested URL in querystring
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.url, f'/accounts/login/?next=/manage/{group.uuid}')

    def test_get_plant_state_not_signed_in(self):
        # Create plant owned by test user
        plant = Plant.objects.create(uuid=uuid4(), user=self.test_user)

        # Request plant state without signing in
        self.assertFalse(auth.get_user(self.client).is_authenticated)
        response = self.client.get(f'/get_plant_state/{plant.uuid}')

        # Confirm redirected to login page with requested URL in querystring
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.url, f'/accounts/login/?next=/get_plant_state/{plant.uuid}')

    def test_get_group_state_not_signed_in(self):
        # Create group owned by test user
        group = Group.objects.create(uuid=uuid4(), user=self.test_user)

        # Request group state without signing in
        self.assertFalse(auth.get_user(self.client).is_authenticated)
        response = self.client.get(f'/get_group_state/{group.uuid}')

        # Confirm redirected to login page with requested URL in querystring
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.url, f'/accounts/login/?next=/get_group_state/{group.uuid}')

    def test_endpoints_require_authenticated_user(self):
        # Create plant and group owned by test user
        plant = Plant.objects.create(uuid=uuid4(), user=self.test_user)
        group = Group.objects.create(uuid=uuid4(), user=self.test_user)

        # Confirm /change_qr_code returns 401, does not cache UUID
        self.assertAuthenticationRequiredError(
            self.client.post('/change_qr_code', {
                'uuid': str(plant.uuid)
            })
        )
        self.assertIsNone(cache.get(f'old_uuid_{get_default_user().pk}'))

        self.assertAuthenticationRequiredError(
            self.client.post('/change_uuid', {
                'uuid': str(plant.uuid),
                'new_id': str(uuid4())
            })
        )
        self.assertAuthenticationRequiredError(
            self.client.post('/edit_plant_details', {
                'plant_id': plant.uuid,
                'name': 'test plant    ',
                'species': '   Giant Sequoia',
                'description': '300 feet and a few thousand years old',
                'pot_size': '4'
            })
        )
        self.assertAuthenticationRequiredError(
            self.client.post('/edit_group_details', {
                'group_id': group.uuid,
                'name': 'test group    ',
                'location': '    middle shelf',
                'description': 'This group is used for propagation'
            })
        )
        self.assertAuthenticationRequiredError(
            self.client.post('/add_plant_event', {
                'plant_id': plant.uuid,
                'event_type': 'water',
                'timestamp': '2024-02-06T03:06:26.000Z'
            })
        )
        self.assertAuthenticationRequiredError(
            self.client.post('/bulk_add_plant_events', {
                'plants': [str(plant.uuid)],
                'event_type': 'water',
                'timestamp': '2024-02-06T03:06:26.000Z'
            })
        )
        self.assertAuthenticationRequiredError(
            self.client.post('/bulk_delete_plant_events', {
                'plant_id': plant.uuid,
                'events': {
                    'water': ['2024-02-06T03:06:26+00:00'],
                    'fertilize': [],
                    'prune': [],
                    'repot': [],
                }
            })
        )
        self.assertAuthenticationRequiredError(
            self.client.post('/add_plant_note', {
                'plant_id': plant.uuid,
                'timestamp': '2024-02-06T03:06:26.000Z',
                'note_text': '  plant is looking healthier than last week  '
            })
        )
        self.assertAuthenticationRequiredError(
            self.client.post('/edit_plant_note', {
                'plant_id': plant.uuid,
                'timestamp': '2024-02-06T03:06:26.000Z',
                'note_text': '   This is the text I forgot to add   '
            })
        )
        self.assertAuthenticationRequiredError(
            self.client.post('/delete_plant_notes', {
                'plant_id': plant.uuid,
                'timestamps': ['2024-02-06T03:06:26.000Z']
            })
        )
        self.assertAuthenticationRequiredError(
            self.client.post('/add_plant_to_group', {
                'plant_id': plant.uuid,
                'group_id': group.uuid
            })
        )
        self.assertAuthenticationRequiredError(
            self.client.post('/remove_plant_from_group', {
                'plant_id': plant.uuid
            })
        )
        self.assertAuthenticationRequiredError(
            self.client.post('/bulk_add_plants_to_group', {
                'group_id': group.uuid,
                'plants': [plant.uuid]
            })
        )
        self.assertAuthenticationRequiredError(
            self.client.post('/bulk_remove_plants_from_group', {
                'group_id': group.uuid,
                'plants': [plant.uuid]
            })
        )
        self.assertAuthenticationRequiredError(
            self.client.post('/repot_plant', {
                'plant_id': plant.uuid,
                'timestamp': '2024-02-06T03:06:26.000Z',
                'new_pot_size': 6
            })
        )
        self.assertAuthenticationRequiredError(
            self.client.post(
                '/add_plant_photos',
                data={
                    'plant_id': str(plant.uuid),
                    'photo_0': create_mock_photo('2024:03:22 10:52:03')
                },
                content_type=MULTIPART_CONTENT
            )
        )
        self.assertAuthenticationRequiredError(
            self.client.post('/delete_plant_photos', {
                'plant_id': str(plant.uuid),
                'delete_photos': [1]
            })
        )
        self.assertAuthenticationRequiredError(
            self.client.post('/set_plant_default_photo', {
                'plant_id': str(plant.uuid),
                'photo_key': 1
            })
        )

    def test_endpoints_reject_requests_from_user_who_does_not_own_plant(self):
        # Create plant and group owned by default user
        plant = Plant.objects.create(uuid=uuid4(), user=get_default_user())
        group = Group.objects.create(uuid=uuid4(), user=get_default_user())

        # Sign in as test user (does not own plant or group)
        self.client.login(username='unittest', password='12345')

        # Confirm /change_qr_code returns 403, does not cache UUID
        self.assertInstanceIsOwnedByADifferentUserError(
            self.client.post('/change_qr_code', {
                'uuid': str(plant.uuid)
            })
        )
        self.assertIsNone(cache.get(f'old_uuid_{get_default_user().pk}'))

        self.assertPlantIsOwnedByADifferentUserError(
            self.client.get(f'/get_plant_state/{plant.uuid}')
        )
        self.assertGroupIsOwnedByADifferentUserError(
            self.client.get(f'/get_group_state/{group.uuid}')
        )
        self.assertInstanceIsOwnedByADifferentUserError(
            self.client.post('/change_uuid', {
                'uuid': str(plant.uuid),
                'new_id': str(uuid4())
            })
        )
        self.assertPlantIsOwnedByADifferentUserError(
            self.client.post('/edit_plant_details', {
                'plant_id': plant.uuid,
                'name': 'test plant    ',
                'species': '   Giant Sequoia',
                'description': '300 feet and a few thousand years old',
                'pot_size': '4'
            })
        )
        self.assertGroupIsOwnedByADifferentUserError(
            self.client.post('/edit_group_details', {
                'group_id': group.uuid,
                'name': 'test group    ',
                'location': '    middle shelf',
                'description': 'This group is used for propagation'
            })
        )
        self.assertPlantIsOwnedByADifferentUserError(
            self.client.post('/add_plant_event', {
                'plant_id': plant.uuid,
                'event_type': 'water',
                'timestamp': '2024-02-06T03:06:26.000Z'
            })
        )

        # Confirm /bulk_add_plant_events returns 400 (does not indicate failure
        # reason but this is only to prevent malicious API calls, should not be
        # possible to make this request from the frontend)
        response = self.client.post('/bulk_add_plant_events', {
            'plants': [str(plant.uuid)],
            'event_type': 'water',
            'timestamp': '2024-02-06T03:06:26.000Z'
        })
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {
            "action": "water",
            "timestamp": "2024-02-06T03:06:26+00:00",
            "plants": [],
            "failed": [str(plant.uuid)]
        })

        self.assertPlantIsOwnedByADifferentUserError(
            self.client.post('/bulk_delete_plant_events', {
                'plant_id': plant.uuid,
                'events': {
                    'water': ['2024-02-06T03:06:26+00:00'],
                    'fertilize': [],
                    'prune': [],
                    'repot': [],
                }
            })
        )
        self.assertPlantIsOwnedByADifferentUserError(
            self.client.post('/add_plant_note', {
                'plant_id': plant.uuid,
                'timestamp': '2024-02-06T03:06:26.000Z',
                'note_text': '  plant is looking healthier than last week  '
            })
        )
        self.assertPlantIsOwnedByADifferentUserError(
            self.client.post('/edit_plant_note', {
                'plant_id': plant.uuid,
                'timestamp': '2024-02-06T03:06:26.000Z',
                'note_text': '   This is the text I forgot to add   '
            })
        )
        self.assertPlantIsOwnedByADifferentUserError(
            self.client.post('/delete_plant_notes', {
                'plant_id': plant.uuid,
                'timestamps': ['2024-02-06T03:06:26.000Z']
            })
        )
        self.assertPlantIsOwnedByADifferentUserError(
            self.client.post('/add_plant_to_group', {
                'plant_id': plant.uuid,
                'group_id': group.uuid
            })
        )
        self.assertPlantIsOwnedByADifferentUserError(
            self.client.post('/remove_plant_from_group', {
                'plant_id': plant.uuid
            })
        )
        self.assertGroupIsOwnedByADifferentUserError(
            self.client.post('/bulk_add_plants_to_group', {
                'group_id': group.uuid,
                'plants': [plant.uuid]
            })
        )
        self.assertGroupIsOwnedByADifferentUserError(
            self.client.post('/bulk_remove_plants_from_group', {
                'group_id': group.uuid,
                'plants': [plant.uuid]
            })
        )
        self.assertPlantIsOwnedByADifferentUserError(
            self.client.post('/repot_plant', {
                'plant_id': plant.uuid,
                'timestamp': '2024-02-06T03:06:26.000Z',
                'new_pot_size': 6
            })
        )
        self.assertPlantIsOwnedByADifferentUserError(
            self.client.post(
                '/add_plant_photos',
                data={
                    'plant_id': str(plant.uuid),
                    'photo_0': create_mock_photo('2024:03:22 10:52:03')
                },
                content_type=MULTIPART_CONTENT
            )
        )
        self.assertPlantIsOwnedByADifferentUserError(
            self.client.post('/delete_plant_photos', {
                'plant_id': str(plant.uuid),
                'delete_photos': [1]
            })
        )
        self.assertPlantIsOwnedByADifferentUserError(
            self.client.post('/set_plant_default_photo', {
                'plant_id': str(plant.uuid),
                'photo_key': 1
            })
        )
