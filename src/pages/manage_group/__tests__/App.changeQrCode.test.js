import { postHeaders } from 'src/testUtils/headers';
import mockCurrentURL from 'src/testUtils/mockCurrentURL';
import mockFetchResponse from 'src/testUtils/mockFetchResponse';
import applyQrScannerMocks from 'src/testUtils/applyQrScannerMocks';
import { mockQrCodeInViewport } from 'src/testUtils/mockBarcodeDetector';
import App from '../App';
import { Toast } from 'src/components/Toast';
import { ErrorModal } from 'src/components/ErrorModal';
import { mockContext } from './mockContext';
import { useNavigate } from 'react-router-dom';
import 'jest-canvas-mock';

jest.mock('react-router-dom', () => {
    const actual = jest.requireActual('react-router-dom');
    return { ...actual, useNavigate: jest.fn() };
});

describe('Group ChangeQrScanner', () => {
    let app, user, mockNavigate;

    beforeAll(() => {
        // Simulate SINGLE_USER_MODE disabled on backend
        globalThis.USER_ACCOUNTS_ENABLED = true;
        // Mock all browser APIs used by QrScanner
        applyQrScannerMocks();
        // Mock react-router navigate (confirm revalidated with new UUID)
        mockNavigate = jest.fn();
        useNavigate.mockReturnValue(mockNavigate);
    });

    beforeEach(() => {
        // Allow fast forwarding
        jest.useFakeTimers({ doNotFake: ['Date'] });

        // Mock window.location (querystring parsed when page loads)
        mockCurrentURL('https://plants.lan/manage/0640ec3b-1bed-4b15-a078-d6e7ec66be14');

        // Render app + create userEvent instance to use in tests
        user = userEvent.setup({ advanceTimers: jest.advanceTimersByTimeAsync });
        app = render(
            <>
                <App initialState={mockContext} />
                <Toast />
                <ErrorModal />
            </>
        );
    });

    // Clean up pending timers after each test
    afterEach(() => {
        jest.clearAllTimers();
        jest.useRealTimers();
    });

    it('opens ChangeQrScanner when button in details drawer clicked', async () => {
        // Confirm qr-scanner-overlay is not visible
        expect(app.queryByTestId('qr-scanner-overlay')).toBeNull();
        // Confirm top-right button title says "Open QR scanner"
        expect(app.getByTitle('Open QR scanner')).toBeInTheDocument();
        expect(app.queryByTitle('Close QR scanner')).toBeNull();

        // Click button to open scanner
        await user.click(app.getByText('Change QR Code'));

        // Confirm qr-scanner-overlay appeared
        await act(async () => await jest.advanceTimersByTimeAsync(100));
        expect(app.getByTestId('qr-scanner-overlay')).toBeInTheDocument();

        // Confirm top-right button title changed to "Close QR scanner"
        expect(app.queryByTitle('Open QR scanner')).toBeNull();
        expect(app.getByTitle('Close QR scanner')).toBeInTheDocument();

        // Click close button, confirm scanner overlay closed
        await user.click(app.getByTitle('Close QR scanner'));
        await act(async () => await jest.advanceTimersByTimeAsync(100));
        expect(app.queryByTestId('qr-scanner-overlay')).toBeNull();
    });

    it('shows confirm button when available QR code is scanned', async () => {
        // Simulate valid QR code with available UUID entering the viewport
        mockQrCodeInViewport('https://plants.lan/manage/5c256d96ec7d408a83c73f86d63968b2');
        mockFetchResponse({available: true});

        // Open scanner, confirm instructions are visible, confirm button is not
        await user.click(app.getByText('Change QR Code'));
        expect(app.getByText('Scan the new QR code')).toBeInTheDocument();
        expect(app.queryByTestId('confirm-new-qr-code-button')).toBeNull();

        // Fast forward until QR code detected, confirm button replaces instructions
        await act(async () => await jest.advanceTimersByTimeAsync(100));
        expect(app.queryByText('Scan the new QR code')).toBeNull();
        expect(app.getByTestId('confirm-new-qr-code-button')).toBeInTheDocument();
    });

    it('sends correct payload when confirm button clicked after scanning QR code', async () => {
        // Simulate valid QR code with available UUID entering the viewport
        mockQrCodeInViewport('https://plants.lan/manage/5c256d96ec7d408a83c73f86d63968b2');
        mockFetchResponse({available: true});

        // Open scanner, fast forward until QR code detected
        await user.click(app.getByText('Change QR Code'));
        await act(async () => await jest.advanceTimersByTimeAsync(100));

        // Mock fetch function to return expected response when confirm clicked
        mockFetchResponse({new_uuid: '5c256d96ec7d408a83c73f86d63968b2'});

        // Confirm success message is not rendered
        expect(app.queryByText('QR code changed!')).toBeNull();

        // Click confirm button
        await user.click(app.getByTestId('confirm-new-qr-code-button'));
        await act(async () => await jest.advanceTimersByTimeAsync(100));

        // Confirm correct data posted to /change_uuid endpoint
        expect(global.fetch).toHaveBeenCalledWith('/change_uuid', {
            method: 'POST',
            body: JSON.stringify({
                uuid: '0640ec3b-1bed-4b15-a078-d6e7ec66be14',
                new_id: '5c256d96ec7d408a83c73f86d63968b2'
            }),
            headers: postHeaders
        });

        // Confirm scanner overlay closed, success toast appeared
        expect(app.queryByTestId('qr-scanner-overlay')).toBeNull();
        expect(app.queryByText('QR code changed!')).not.toBeNull();
    });

    it('shows error modal if error received after confirm button clicked', async() => {
        // Simulate valid QR code with available UUID entering the viewport
        mockQrCodeInViewport('https://plants.lan/manage/5c256d96ec7d408a83c73f86d63968b2');
        mockFetchResponse({available: true});

        // Open scanner, fast forward until QR code detected
        await user.click(app.getByText('Change QR Code'));
        await act(async () => await jest.advanceTimersByTimeAsync(100));

        // Mock fetch function to return arbitrary error
        mockFetchResponse({error: "failed to change QR code"}, 400);

        // Confirm error modal is not rendered
        expect(app.queryByTestId('error-modal-body')).toBeNull();

        // Click confirm button
        await user.click(app.getByTestId('confirm-new-qr-code-button'));
        await act(async () => await jest.advanceTimersByTimeAsync(100));

        // Confirm modal appeared with arbitrary error text
        expect(app.getByTestId('error-modal-body')).toBeInTheDocument();
        expect(app.getByTestId('error-modal-body')).toHaveTextContent(
            'failed to change QR code'
        );
    });

    // Regression test, when first implemented the old UUID was not updated in
    // react-router history, so navigating with back button and then forward
    // button would return to old UUID (now registration page). Now calls
    // navigate to replace the URL and revalidate (updates UUID in redux).
    it('updates UUID in redux store when user changes QR code', async () => {
        // Simulate valid QR code with available UUID entering the viewport
        mockQrCodeInViewport('https://plants.lan/manage/5c256d96ec7d408a83c73f86d63968b2');
        mockFetchResponse({available: true});

        // Open scanner, fast forward until QR code detected
        await user.click(app.getByText('Change QR Code'));
        await act(async () => await jest.advanceTimersByTimeAsync(100));

        // Mock fetch function to return expected response when confirm clicked
        mockFetchResponse({new_uuid: '5c256d96ec7d408a83c73f86d63968b2'});
        // Click confirm button, confirm request made + overlay closed
        await user.click(app.getByTestId('confirm-new-qr-code-button'));
        await act(async () => await jest.advanceTimersByTimeAsync(100));

        // Confirm correct data posted to /change_uuid endpoint
        expect(global.fetch).toHaveBeenCalledWith('/change_uuid', {
            method: 'POST',
            body: JSON.stringify({
                uuid: '0640ec3b-1bed-4b15-a078-d6e7ec66be14',
                new_id: '5c256d96ec7d408a83c73f86d63968b2'
            }),
            headers: postHeaders
        });
        expect(app.queryByTestId('qr-scanner-overlay')).toBeNull();

        // Confirm URL was updated to new UUID (revalidates page, updates redux)
        expect(mockNavigate).toHaveBeenCalledWith(
            `/manage/5c256d96ec7d408a83c73f86d63968b2`,
            { replace: true }
        );
    });

    // Regresssion test, was possible to open navigation scanner (top right
    // button) then open change QR scanner (button inside title drawer) on top
    // of it. When close button was clicked only change QR scanner closed
    // (confusing UX, looks like nothing happened, have to close second one).
    it('closes navigation scanner if user opens change QR scanner', async () => {
        // Confirm qr-scanner-overlay is not visible
        expect(app.queryByTestId('qr-scanner-overlay')).toBeNull();

        // Click top right corner button to open navigation scanner
        await user.click(app.getByTitle('Open QR scanner'));

        // Confirm qr-scanner-overlay appeared
        await act(async () => await jest.advanceTimersByTimeAsync(100));
        expect(app.getByTestId('qr-scanner-overlay')).toBeInTheDocument();

        // Open change QR scanner
        await user.click(app.getByText('Change QR Code'));
        await act(async () => await jest.advanceTimersByTimeAsync(100));
        // Confirm scanner open (replaced original scanner)
        expect(app.getByTestId('qr-scanner-overlay')).toBeInTheDocument();

        // Click close button, confirm neither scanner is open
        await user.click(app.getByTitle('Close QR scanner'));
        await act(async () => await jest.advanceTimersByTimeAsync(100));
        expect(app.queryByTestId('qr-scanner-overlay')).toBeNull();
    });
});
