import createMockContext from 'src/testUtils/createMockContext';
import { postHeaders } from 'src/testUtils/headers';
import App from '../App';
import { PageWrapper } from 'src/index';
import { mockContext } from './mockContext';

describe('App', () => {
    let app, user;

    beforeAll(() => {
        // Create mock state objects
        createMockContext('type', 'plant');
        createMockContext('instance', mockContext.plant);
        createMockContext('new_uuid', mockContext.new_uuid);
        createMockContext('user_accounts_enabled', true);
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

    it('sends correct payload when confirm button is clicked', async () => {
        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                'uuid': '07919189-514d-4ec1-a967-8af553dfa7e8'
            })
        }));

        // Click confirm button
        await user.click(app.getByTitle('Change QR code'));

        // Confirm correct data posted to /change_uuid endpoint
        expect(global.fetch).toHaveBeenCalledWith('/change_uuid', {
            method: 'POST',
            body: JSON.stringify({
                'uuid': '0640ec3b-1bed-4b15-a078-d6e7ec66be12',
                'new_id': '07919189-514d-4ec1-a967-8af553dfa7e8'
            }),
            headers: postHeaders
        });

        // Confirm window.location.reload was called
        expect(window.location.reload).toHaveBeenCalled();
    });

    it('shows error modal if error received after confirm button clicked', async() => {
        // Mock fetch function to return arbitrary error
        global.fetch = jest.fn(() => Promise.resolve({
            ok: false,
            json: () => Promise.resolve({
                "error": "failed to change QR code"
            })
        }));

        // Confirm arbitrary error does not appear on page
        expect(app.queryByText(/failed to change QR code/)).toBeNull();

        // Click confirm button
        await user.click(app.getByTitle('Change QR code'));

        // Confirm modal appeared with arbitrary error text
        expect(app.queryByText(/failed to change QR code/)).not.toBeNull();
    });

    // Note: this response can only be received if SINGLE_USER_MODE is disabled
    it('redirects to login page if user is not signed in', async () => {
        // Mock fetch function to simulate user with an expired session
        global.fetch = jest.fn(() => Promise.resolve({
            ok: false,
            status: 401,
            json: () => Promise.resolve({
                "error": "authentication required"
            })
        }));

        // Click confirm button
        await user.click(app.getByTitle('Change QR code'));

        // Confirm redirected
        expect(window.location.href).toBe('/accounts/login/');
    });

    it('refreshes when user navigates to confirm page with back button', async () => {
        // Simulate user navigating to confirm_new_qr_code page with back button
        const pageshowEvent = new Event('pageshow');
        Object.defineProperty(pageshowEvent, 'persisted', { value: true });
        window.dispatchEvent(pageshowEvent);

        // Confirm page was reloaded
        expect(window.location.reload).toHaveBeenCalled();
    });

    it('does not refresh when other pageshow events are triggered', () => {
        // Simulate pageshow event with persisted == false (ie initial load)
        const pageshowEvent = new Event('pageshow');
        Object.defineProperty(pageshowEvent, 'persisted', { value: false });
        window.dispatchEvent(pageshowEvent);

        // Confirm page was not reloaded
        expect(window.location.reload).not.toHaveBeenCalled();
    });
});
