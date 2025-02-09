import createMockContext from 'src/testUtils/createMockContext';
import { postHeaders } from 'src/testUtils/headers';
import App from '../App';
import { ToastProvider } from 'src/context/ToastContext';
import { ThemeProvider } from 'src/context/ThemeContext';
import { ErrorModalProvider } from 'src/context/ErrorModalContext';
import { mockContext } from './mockContext';

describe('App', () => {
    let app, user;

    beforeAll(() => {
        // Create mock state objects
        createMockContext('type', 'plant');
        createMockContext('instance', mockContext.plant);
        createMockContext('new_uuid', mockContext.new_uuid);
    });

    beforeEach(() => {
        // Render app + create userEvent instance to use in tests
        user = userEvent.setup();
        app = render(
            <ThemeProvider>
                <ToastProvider>
                    <ErrorModalProvider>
                        <App />
                    </ErrorModalProvider>
                </ToastProvider>
            </ThemeProvider>
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
        await user.click(app.container.querySelector('.btn-success'));

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
        await user.click(app.container.querySelector('.btn-success'));

        // Confirm modal appeared with arbitrary error text
        expect(app.queryByText(/failed to change QR code/)).not.toBeNull();
    });

    it('redirects to overview when dropdown option is clicked', async () => {
        // Click overview dropdown option, confirm redirected
        await user.click(app.getByText('Overview'));
        expect(window.location.href).toBe('/');
    });

    it('redirects to overview when cancel button is clicked', async () => {
        // Click cancel button, confirm redirected
        await user.click(app.container.querySelector('.btn-error'));
        expect(window.location.href).toBe('/');
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
