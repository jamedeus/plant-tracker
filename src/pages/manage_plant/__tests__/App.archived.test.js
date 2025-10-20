import mockCurrentURL from 'src/testUtils/mockCurrentURL';
import mockFetchResponse from 'src/testUtils/mockFetchResponse';
import { v4 as mockUuidv4 } from 'uuid';
import { postHeaders } from 'src/testUtils/headers';
import App from '../App';
import { Toast } from 'src/components/Toast';
import { ErrorModal } from 'src/components/ErrorModal';
import { mockContext } from './mockContext';

jest.mock('uuid', () => ({
    v4: jest.fn(),
}));

describe('App', () => {
    let app, user;

    beforeAll(() => {
        // Simulate SINGLE_USER_MODE disabled on backend
        globalThis.USER_ACCOUNTS_ENABLED = true;
    });

    beforeEach(() => {
        // Allow fast forwarding (must hold delete note button to confirm)
        jest.useFakeTimers({ doNotFake: ['Date'] });

        mockUuidv4.mockReset();

        // Mock window.location (querystring parsed when page loads)
        mockCurrentURL('https://plants.lan/manage/0640ec3b-1bed-4b15-a078-d6e7ec66be12');

        // Render app + create userEvent instance to use in tests
        user = userEvent.setup({ advanceTimers: jest.advanceTimersByTimeAsync });
        app = render(
            <>
                <App initialState={{
                    ...mockContext, plant_details: {
                        ...mockContext.plant_details, archived: true
                    }
                }} />
                <Toast />
                <ErrorModal />
            </>
        );
    });

    // Clean up pending timers after each test
    afterEach(() => {
        act(() => jest.runAllTimers());
        jest.useRealTimers();
    });

    it('sends correct payload when RemoveQrCode modal is submitted', async () => {
        // Confirm RemoveQrCode modal is not rendered, success toast not rendered
        expect(app.queryByText(/Scanning it will no longer/)).toBeNull();
        expect(app.queryByText('QR code removed')).toBeNull();

        // Click "Remove QR code" button, confirm modal appears
        await user.click(app.getByText('Remove QR Code'));
        await act(async () => await jest.advanceTimersByTimeAsync(100));
        await waitFor(() => {
            expect(app.queryByText(/Scanning it will no longer/)).not.toBeNull();
        });

        // Mock uuidv4 to return a predictable string
        // Mock fetch function to return expected response
        mockUuidv4.mockReturnValue('new-random-uuid');
        mockFetchResponse({new_uuid: 'new-random-uuid'});

        // Click remove button, confirm modal closes
        await user.click(app.getByRole('button', {name: 'Remove'}));
        await act(async () => await jest.advanceTimersByTimeAsync(100));
        await waitFor(() => {
            expect(app.queryByText(/Scanning it will no longer/)).toBeNull();
        });

        // Confirm corect payload sent to /change_uuid endpoint
        expect(global.fetch).toHaveBeenCalledWith('/change_uuid', {
            method: 'POST',
            body: JSON.stringify({
                uuid: '0640ec3b-1bed-4b15-a078-d6e7ec66be12',
                new_id: 'new-random-uuid'
            }),
            headers: postHeaders
        });
        // Confirm toast appeared
        expect(app.queryByText('QR code removed')).not.toBeNull();
    });
});
