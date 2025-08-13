import { PageWrapper } from 'src/index';
import mockCurrentURL from 'src/testUtils/mockCurrentURL';
import App from '../App';

describe('App', () => {
    let app, user;

    beforeEach(() => {
        // Allow fast forwarding
        jest.useFakeTimers({ doNotFake: ['Date'] });

        // Render app + create userEvent instance to use in tests
        user = userEvent.setup({ advanceTimers: jest.advanceTimersByTimeAsync });
        app = render(
            <PageWrapper>
                <App />
            </PageWrapper>
        );

        // Mock window.location to expected URL (parsed after logging in)
        mockCurrentURL(
            'https://plants.lan/accounts/reset/OA/set-password/',
            '/accounts/reset/OA/set-password/'
        );
    });

    // Clean up pending timers after each test
    afterEach(() => {
        act(() => jest.runAllTimers());
        jest.useRealTimers();
    });

    it('sends expected payload when password is changed', async () => {
        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({success: "password_changed"})
        }));

        // Confirm success toast is not rendered
        expect(app.queryByText('Password changed!')).toBeNull();

        // Simulate user entering new password twice
        await user.type(app.getByLabelText('New password'), 'thispasswordisbetter');
        await user.type(app.getByLabelText('Confirm new password'), 'thispasswordisbetter');

        // Click Change Password button
        await user.click(app.getByRole("button", {name: "Change Password"}));

        // Confirm correct data posted to /edit_user_details endpoint
        expect(global.fetch).toHaveBeenCalled();
        const [[url, fetchOptions]] = global.fetch.mock.calls;
        expect(url).toBe('/accounts/reset/OA/set-password/');
        expect(fetchOptions.method).toBe('POST');
        expect(fetchOptions.body).toBeInstanceOf(FormData);
        expect(fetchOptions.body.get('new_password1')).toBe('thispasswordisbetter');
        expect(fetchOptions.body.get('new_password2')).toBe('thispasswordisbetter');

        // Confirm toast message appeared
        expect(app.queryByText('Password changed!')).not.toBeNull();

        // Confirm automatically redirects to profile page
        await act(async () => await jest.advanceTimersByTimeAsync(800));
        expect(window.location.href).toBe('/accounts/profile/');
    });

    it('submits change password form when user presses enter key', async () => {
        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({success: "password_changed"})
        }));

        // Simulate user entering new password twice
        await user.type(app.getByLabelText('New password'), 'thispasswordisbetter');
        await user.type(app.getByLabelText('Confirm new password'), 'thispasswordisbetter');

        // Simulate user pressing enter key in new password field
        await user.type(app.getByLabelText('New password'), '{enter}');

        // Confirm posted data to change_password endpoint
        expect(global.fetch).toHaveBeenCalled();
        const [[url, fetchOptions]] = global.fetch.mock.calls;
        expect(url).toBe('/accounts/reset/OA/set-password/');
        expect(fetchOptions.method).toBe('POST');
    });

    it('highlights new password fields if new passwords do not match', async () => {
        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: false,
            status: 400,
            json: () => Promise.resolve({errors: {
                new_password2: [
                    "The two password fields didn\u2019t match."
                ]
            }})
        }));

        // Confirm error text is not rendered
        expect(app.queryByText("The two password fields didn’t match.")).toBeNull();

        // Simulate user filling out form and clicking Change password button
        // (passwords have to match in test so submit button will be enabled)
        await user.type(app.getByLabelText('New password'), 'thispasswordisbetter');
        await user.type(app.getByLabelText('Confirm new password'), 'thispasswordisbetter');
        await user.click(app.getByRole("button", {name: "Change Password"}));

        // Confirm error text appeared, new password fields have red highlight
        expect(app.queryByText("The two password fields didn’t match.")).not.toBeNull();
        expect(app.getByLabelText('New password').classList).toContain('border-error');
        expect(app.getByLabelText('Confirm new password').classList).toContain('border-error');
    });

    it('shows generic error message if password change fails', async () => {
        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: false,
            status: 400,
            json: () => Promise.resolve({errors: {__all__: ["Unexpected error."]}})
        }));

        // Confirm error text is not rendered
        expect(app.queryByText("Failed to change password.")).toBeNull();

        // Simulate user filling out form and clicking Change password button
        // (passwords have to match in test so submit button will be enabled)
        await user.type(app.getByLabelText('New password'), 'thispasswordisbetter');
        await user.type(app.getByLabelText('Confirm new password'), 'thispasswordisbetter');
        await user.click(app.getByRole("button", {name: "Change Password"}));

        // Confirm error text appeared, new password fields have red highlight
        expect(app.queryByText("Failed to change password.")).not.toBeNull();
        expect(app.getByLabelText('New password').classList).toContain('border-error');
        expect(app.getByLabelText('Confirm new password').classList).toContain('border-error');
    });
});
