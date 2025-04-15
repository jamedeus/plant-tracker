import createMockContext from 'src/testUtils/createMockContext';
import { PageWrapper } from 'src/index';
import { postHeaders } from 'src/testUtils/headers';
import App from '../App';

describe('App', () => {
    let app, user;

    // Create mock state object
    createMockContext('user_details', {
        username: "cdanger",
        email: "totally.not.anthony.weiner@gmail.com",
        first_name: "Carlos",
        last_name: "Danger",
        date_joined: "2025-04-06T00:08:53.392806+00:00"
    });

    beforeEach(() => {
        // Render app + create userEvent instance to use in tests
        user = userEvent.setup();
        app = render(
            <PageWrapper>
                <App />
            </PageWrapper>
        );
    });

    it('redirects to overview when dropdown option is clicked', async () => {
        // Click overview dropdown option, confirm redirected
        await user.click(app.getByText('Overview'));
        expect(window.location.href).toBe('/');
    });

    it('sends expected payload when user details are edited', async () => {
        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({success: "details updated"})
        }));

        // Confirm success toast is not rendered
        expect(app.queryByText('Details updated!')).toBeNull();

        // Simulate user changing first and last name
        await user.clear(app.getByTestId('first_name_input'));
        await user.type(app.getByTestId('first_name_input'), 'Bob');
        await user.clear(app.getByTestId('last_name_input'));
        await user.type(app.getByTestId('last_name_input'), 'Smith');

        // Click Save Changes button
        await user.click(app.getByRole("button", {name: "Save Changes"}));

        // Confirm correct data posted to /delete_plant endpoint
        expect(global.fetch).toHaveBeenCalledWith('/accounts/edit_user_details/', {
            method: 'POST',
            body: JSON.stringify({
                first_name: 'Bob',
                last_name: 'Smith',
                email: 'totally.not.anthony.weiner@gmail.com'
            }),
            headers: postHeaders
        });

        // Confirm toast message appeared
        expect(app.queryByText('Details updated!')).not.toBeNull();
    });

    it('shows error toast when unable to update user details', async () => {
        // Mock fetch function to return expected error
        global.fetch = jest.fn(() => Promise.resolve({
            ok: false,
            status: 400,
            json: () => Promise.resolve({error: "failed to update details"})
        }));

        // Confirm error toast is not rendered
        expect(app.queryByText('Unable to update details')).toBeNull();

        // Simulate user changing email address
        await user.clear(app.getByTestId('email_input'));
        await user.type(app.getByTestId('email_input'), 'carlosdanger@gmail.com');

        // Click Save Changes button
        await user.click(app.getByRole("button", {name: "Save Changes"}));

        // Confirm error toast appeared
        expect(app.queryByText('Unable to update details')).not.toBeNull();
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

        // Simulate user entering old password and new password twice
        await user.type(app.getByLabelText('Old password'), 'password123');
        await user.type(app.getByLabelText('New password'), 'thispasswordisbetter');
        await user.type(app.getByLabelText('Confirm new password'), 'thispasswordisbetter');

        // Click Change Password button
        await user.click(app.getByRole("button", {name: "Change Password"}));

        // Confirm correct data posted to /delete_plant endpoint
        expect(global.fetch).toHaveBeenCalled();
        const [[url, fetchOptions]] = global.fetch.mock.calls;
        expect(url).toBe('/accounts/change_password/');
        expect(fetchOptions.method).toBe('POST');
        expect(fetchOptions.body).toBeInstanceOf(URLSearchParams);
        expect(fetchOptions.body.get('old_password')).toBe('password123');
        expect(fetchOptions.body.get('new_password1')).toBe('thispasswordisbetter');
        expect(fetchOptions.body.get('new_password2')).toBe('thispasswordisbetter');

        // Confirm toast message appeared
        expect(app.queryByText('Password changed!')).not.toBeNull();
    });

    it('highlights old password field if old password is incorrect', async () => {
        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: false,
            status: 400,
            json: () => Promise.resolve({errors: {
                old_password: [
                    "Your old password was entered incorrectly. Please enter it again."
                ]
            }})
        }));

        // Confirm error text is not rendered
        expect(app.queryByText('Old password incorrect')).toBeNull();

        // Simulate user filling out form and clicking Change password button
        await user.type(app.getByLabelText('Old password'), 'password123');
        await user.type(app.getByLabelText('New password'), 'thispasswordisbetter');
        await user.type(app.getByLabelText('Confirm new password'), 'thispasswordisbetter');
        await user.click(app.getByRole("button", {name: "Change Password"}));

        // Confirm error text appeared, only old password field has red highlight
        expect(app.queryByText('Old password incorrect')).not.toBeNull();
        expect(app.getByLabelText('Old password').classList).toContain('input-error');
        expect(app.getByLabelText('New password').classList).not.toContain('input-error');
        expect(app.getByLabelText('Confirm new password').classList).not.toContain('input-error');
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
        await user.type(app.getByLabelText('Old password'), 'password123');
        await user.type(app.getByLabelText('New password'), 'thispasswordisbetter');
        await user.type(app.getByLabelText('Confirm new password'), 'thispasswordisbetter');
        await user.click(app.getByRole("button", {name: "Change Password"}));

        // Confirm error text appeared, only new password fields have red highlight
        expect(app.queryByText("The two password fields didn’t match.")).not.toBeNull();
        expect(app.getByLabelText('Old password').classList).not.toContain('input-error');
        expect(app.getByLabelText('New password').classList).toContain('input-error');
        expect(app.getByLabelText('Confirm new password').classList).toContain('input-error');
    });
});
