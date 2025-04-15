import { PageWrapper } from 'src/index';
import { postHeaders } from 'src/testUtils/headers';
import App from '../App';

describe('App', () => {
    let app, user;

    beforeEach(() => {
        // Render app + create userEvent instance to use in tests
        user = userEvent.setup();
        app = render(
            <PageWrapper>
                <App />
            </PageWrapper>
        );

        // Mock window.location to expected URL (parsed after logging in)
        Object.defineProperty(window, 'location', {
            configurable: true,
            value: {
                ...window.location,
                href: 'https://plants.lan/accounts/login/',
                assign: jest.fn()
            }
        });
    });

    it('shows registration form when Create account clicked', async () => {
        // Confirm login form is visible
        expect(app.queryAllByText('Login')).not.toStrictEqual([]);
        expect(app.queryAllByText('Create Account')).toStrictEqual([]);

        // Click "Create account" link under login form
        await user.click(app.getByText('Create account'));

        // Confirm registration form is visible
        expect(app.queryAllByText('Login')).toStrictEqual([]);
        expect(app.queryAllByText('Create Account')).not.toStrictEqual([]);

        // Click "Already have an account?" link under registration form
        await user.click(app.getByText('Already have an account?'));

        // Confirm login form is visible
        expect(app.queryAllByText('Login')).not.toStrictEqual([]);
        expect(app.queryAllByText('Create Account')).toStrictEqual([]);
    });

    it('sends correct payload when user logs in', async () => {
        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({success: "logged in"})
        }));

        // Simulate user typing username and password
        await user.type(app.getByLabelText('Username'), 'carlosdanger');
        await user.type(app.getByLabelText('Password'), 'defnotanthonyweiner');

        // Click login button
        await user.click(app.getAllByRole("button", {name: "Login"})[1]);

        // Confirm correct FormData posted to /accounts/login/ endpoint
        expect(global.fetch).toHaveBeenCalled();
        const [[url, fetchOptions]] = global.fetch.mock.calls;
        expect(url).toBe('/accounts/login/');
        expect(fetchOptions.method).toBe('POST');
        expect(fetchOptions.body).toBeInstanceOf(FormData);
        expect(fetchOptions.body.get('username')).toBe('carlosdanger');
        expect(fetchOptions.body.get('password')).toBe('defnotanthonyweiner');

        // Confirm redirected to overview since no querystring in URL
        expect(window.location.href).toBe('/');
    });

    it('redirects to URL in querystring after successful login', async () => {
        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({success: "logged in"})
        }));

        // Add user profile url to "next" querystring parameter
        Object.defineProperty(window, 'location', {
            value: {
                ...window.location,
                href: 'https://plants.lan/accounts/login/?next=/accounts/profile/',
            }
        });

        // Simulate user typing credentials and logging in
        await user.type(app.getByLabelText('Username'), 'carlosdanger');
        await user.type(app.getByLabelText('Password'), 'defnotanthonyweiner');
        await user.click(app.getAllByRole("button", {name: "Login"})[1]);

        // Confirm redirected to user profile after login
        expect(window.location.href).toBe('/accounts/profile/');
    });

    it('shows error if credentials are not accepted', async () => {
        // Mock fetch function to return invalid credentials error
        global.fetch = jest.fn(() => Promise.resolve({
            ok: false,
            status: 400,
            json: () => Promise.resolve({
                "errors": {
                    "__all__": [
                        "Please enter a correct username and password. Note that both fields may be case-sensitive."
                    ]
                }
            })
        }));

        // Confirm error text is not rendered
        expect(app.queryByText("Invalid username or password")).toBeNull();

        // Simulate user typing credentials and logging in
        await user.type(app.getByLabelText('Username'), 'carlosdanger');
        await user.type(app.getByLabelText('Password'), 'defnotanthonyweiner');
        await user.click(app.getAllByRole("button", {name: "Login"})[1]);

        // Confirm fetch was called, error text appeared
        expect(global.fetch).toHaveBeenCalled();
        expect(app.queryByText("Invalid username or password")).not.toBeNull();

        // Simulate user typing in form, confirm error test disappears
        await user.type(app.getByLabelText('Username'), '.');
        expect(app.queryByText("Invalid username or password")).toBeNull();
    });

    it('sends correct payload when user registers account', async () => {
        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({success: "account created"})
        }));

        // Click "Create account" link under login form
        await user.click(app.getByText('Create account'));

        // Simulate user filling out form
        await user.type(app.getByLabelText('Username'), 'carlosdanger');
        await user.type(app.getByLabelText('Password'), 'defnotanthonyweiner');
        await user.type(app.getByLabelText('First name'), 'Carlos');
        await user.type(app.getByLabelText('Last name'), 'Danger');
        await user.type(app.getByLabelText('Email'), 'carlosdanger@gmail.com');

        // Click create account button
        await user.click(app.getByRole("button", {name: "Create account"}));

        // Confirm correct data posted to /delete_plant endpoint
        expect(global.fetch).toHaveBeenCalledWith('/accounts/create_user/', {
            method: 'POST',
            body: JSON.stringify({
                email: 'carlosdanger@gmail.com',
                username: 'carlosdanger',
                password: 'defnotanthonyweiner',
                first_name: 'Carlos',
                last_name: 'Danger'
            }),
            headers: postHeaders
        });

        // Confirm redirected to overview page
        expect(window.location.href).toBe('/');
    });

    it('shows error text under username when backend rejects username', async () => {
        // Mock fetch function to return expected error
        global.fetch = jest.fn(() => Promise.resolve({
            ok: false,
            status: 409,
            json: () => Promise.resolve({error: ["username already exists"]})
        }));

        // Click "Create account" link under login form
        await user.click(app.getByText('Create account'));

        // Confirm error string is not rendered
        expect(app.queryByText('username already exists')).toBeNull();

        // Simulate user filling out form
        await user.type(app.getByLabelText('Username'), 'carlosdanger');
        await user.type(app.getByLabelText('Password'), 'defnotanthonyweiner');
        await user.type(app.getByLabelText('First name'), 'Carlos');
        await user.type(app.getByLabelText('Last name'), 'Danger');
        await user.type(app.getByLabelText('Email'), 'carlosdanger@gmail.com');

        // Click create account button
        await user.click(app.getByRole("button", {name: "Create account"}));

        // Confirm error string appeared, only username field has red highlight
        expect(app.queryByText('username already exists')).not.toBeNull();
        expect(app.getByLabelText('Email').classList).not.toContain('input-error');
        expect(app.getByLabelText('Username').classList).toContain('input-error');
        expect(app.getByLabelText('Password').classList).not.toContain('input-error');
    });

    it('shows error text under email when backend rejects email', async () => {
        // Mock fetch function to return expected error
        global.fetch = jest.fn(() => Promise.resolve({
            ok: false,
            status: 409,
            json: () => Promise.resolve({error: ["email already exists"]})
        }));

        // Click "Create account" link under login form
        await user.click(app.getByText('Create account'));

        // Confirm error string is not rendered
        expect(app.queryByText('email already exists')).toBeNull();

        // Simulate user filling out form
        await user.type(app.getByLabelText('Username'), 'carlosdanger');
        await user.type(app.getByLabelText('Password'), 'defnotanthonyweiner');
        await user.type(app.getByLabelText('First name'), 'Carlos');
        await user.type(app.getByLabelText('Last name'), 'Danger');
        await user.type(app.getByLabelText('Email'), 'carlosdanger@gmail.com');

        // Click create account button
        await user.click(app.getByRole("button", {name: "Create account"}));

        // Confirm error string appeared, only email field has red highlight
        expect(app.queryByText('email already exists')).not.toBeNull();
        expect(app.getByLabelText('Email').classList).toContain('input-error');
        expect(app.getByLabelText('Username').classList).not.toContain('input-error');
        expect(app.getByLabelText('Password').classList).not.toContain('input-error');
    });

    it('shows error text under password when backend rejects password', async () => {
        // Mock fetch function to return expected error
        global.fetch = jest.fn(() => Promise.resolve({
            ok: false,
            status: 400,
            json: () => Promise.resolve({error: ["This password is too common."]})
        }));

        // Click "Create account" link under login form
        await user.click(app.getByText('Create account'));

        // Confirm error string is not rendered
        expect(app.queryByText('This password is too common.')).toBeNull();

        // Simulate user filling out form
        await user.type(app.getByLabelText('Username'), 'carlosdanger');
        await user.type(app.getByLabelText('Password'), 'defnotanthonyweiner');
        await user.type(app.getByLabelText('First name'), 'Carlos');
        await user.type(app.getByLabelText('Last name'), 'Danger');
        await user.type(app.getByLabelText('Email'), 'carlosdanger@gmail.com');

        // Click create account button
        await user.click(app.getByRole("button", {name: "Create account"}));

        // Confirm error string appeared, only password field has red highlight
        expect(app.queryByText('This password is too common.')).not.toBeNull();
        expect(app.getByLabelText('Email').classList).not.toContain('input-error');
        expect(app.getByLabelText('Username').classList).not.toContain('input-error');
        expect(app.getByLabelText('Password').classList).toContain('input-error');
    });

    it('highlights all required fields when a generic error is received', async () => {
        // Mock fetch function to return expected error
        global.fetch = jest.fn(() => Promise.resolve({
            ok: false,
            status: 400,
            json: () => Promise.resolve({error: ["failed to create account"]})
        }));

        // Click "Create account" link under login form
        await user.click(app.getByText('Create account'));

        // Confirm error string is not rendered
        expect(app.queryByText('failed to create account')).toBeNull();

        // Simulate user filling out form
        await user.type(app.getByLabelText('Username'), 'carlosdanger');
        await user.type(app.getByLabelText('Password'), 'defnotanthonyweiner');
        await user.type(app.getByLabelText('First name'), 'Carlos');
        await user.type(app.getByLabelText('Last name'), 'Danger');
        await user.type(app.getByLabelText('Email'), 'carlosdanger@gmail.com');

        // Click create account button
        await user.click(app.getByRole("button", {name: "Create account"}));

        // Confirm error string appeared, all fields have red highlight
        expect(app.queryByText('failed to create account')).not.toBeNull();
        expect(app.getByLabelText('Email').classList).toContain('input-error');
        expect(app.getByLabelText('Username').classList).toContain('input-error');
        expect(app.getByLabelText('Password').classList).toContain('input-error');
    });
});
