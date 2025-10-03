import mockCurrentURL from 'src/testUtils/mockCurrentURL';
import { postHeaders } from 'src/testUtils/headers';
import applyQrScannerMocks from 'src/testUtils/applyQrScannerMocks';
import FakeBarcodeDetector from 'src/testUtils/mockBarcodeDetector';
import App from '../App';
import { Toast } from 'src/components/Toast';
import { ErrorModal } from 'src/components/ErrorModal';
import { mockContext } from './mockContext';
import 'jest-canvas-mock';

describe('Group ChangeQrScanner', () => {
    let app, user;

    beforeAll(() => {
        // Simulate SINGLE_USER_MODE disabled on backend
        globalThis.USER_ACCOUNTS_ENABLED = true;
        // Mock all browser APIs used by QrScanner
        applyQrScannerMocks();
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
        // Mock barcode-detector to simulate detecting a QR code with a domain
        // that matches the current URL
        mockCurrentURL('https://plants.lan/');
        jest.spyOn(FakeBarcodeDetector.prototype, 'detect').mockResolvedValue([{
            rawValue: 'https://plants.lan/manage/5c256d96-ec7d-408a-83c7-3f86d63968b2',
            boundingBox: { x: 0, y: 0, width: 200, height: 100 },
            cornerPoints: [
                { x: 0,   y: 0   },
                { x: 200, y: 0   },
                { x: 200, y: 100 },
                { x: 0,   y: 100 }
            ],
            format: 'qr_code',
        }]);

        // Mock fetch function to simulate available URL
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({
                available: true
            })
        }));

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
        // Mock barcode-detector to simulate detecting a QR code with a domain
        // that matches the current URL
        mockCurrentURL('https://plants.lan/');
        jest.spyOn(FakeBarcodeDetector.prototype, 'detect').mockResolvedValue([{
            rawValue: 'https://plants.lan/manage/5c256d96-ec7d-408a-83c7-3f86d63968b2',
            boundingBox: { x: 0, y: 0, width: 200, height: 100 },
            cornerPoints: [
                { x: 0,   y: 0   },
                { x: 200, y: 0   },
                { x: 200, y: 100 },
                { x: 0,   y: 100 }
            ],
            format: 'qr_code',
        }]);

        // Mock fetch function to simulate available URL
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({
                available: true
            })
        }));

        // Open scanner, fast forward until QR code detected
        await user.click(app.getByText('Change QR Code'));
        await act(async () => await jest.advanceTimersByTimeAsync(100));

        // Mock fetch function to return expected response when confirm clicked
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                new_uuid: '5c256d96-ec7d-408a-83c7-3f86d63968b2'
            })
        }));

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
                new_id: '5c256d96-ec7d-408a-83c7-3f86d63968b2'
            }),
            headers: postHeaders
        });

        // Confirm scanner overlay closed, success toast appeared
        expect(app.queryByTestId('qr-scanner-overlay')).toBeNull();
        expect(app.queryByText('QR code changed!')).not.toBeNull();
    });

    it('shows error modal if error received after confirm button clicked', async() => {
        // Mock barcode-detector to simulate detecting a QR code with a domain
        // that matches the current URL
        mockCurrentURL('https://plants.lan/');
        jest.spyOn(FakeBarcodeDetector.prototype, 'detect').mockResolvedValue([{
            rawValue: 'https://plants.lan/manage/5c256d96-ec7d-408a-83c7-3f86d63968b2',
            boundingBox: { x: 0, y: 0, width: 200, height: 100 },
            cornerPoints: [
                { x: 0,   y: 0   },
                { x: 200, y: 0   },
                { x: 200, y: 100 },
                { x: 0,   y: 100 }
            ],
            format: 'qr_code',
        }]);

        // Mock fetch function to simulate available URL
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({
                available: true
            })
        }));

        // Open scanner, fast forward until QR code detected
        await user.click(app.getByText('Change QR Code'));
        await act(async () => await jest.advanceTimersByTimeAsync(100));

        // Mock fetch function to return arbitrary error
        global.fetch = jest.fn(() => Promise.resolve({
            ok: false,
            json: () => Promise.resolve({
                error: "failed to change QR code"
            })
        }));

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
    // redux, so any subsequent actions which post UUID to backend (editing
    // details etc) would fail (UUID no longer matches any plant in database)
    it('updates UUID in redux store when user changes QR code', async () => {
        // Mock fetch function to return expected response when details edited
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                name: "Test group",
                location: "Middle shelf",
                description: "",
                display_name: "Test group"
            })
        }));

        // Open edit modal, click submit button
        await user.click(app.getByRole('button', {name: 'Edit Details'}));
        await act(async () => await jest.advanceTimersByTimeAsync(100));
        await user.click(app.getByRole('button', {name: 'Edit'}));
        // const modal = document.body.querySelector(".modal-box");
        // await user.click(within(modal).getByText("Edit"));

        // Confirm correct data posted to /edit_group_details endpoint
        expect(global.fetch).toHaveBeenCalledWith('/edit_group_details', {
            method: 'POST',
            body: JSON.stringify({
                group_id: "0640ec3b-1bed-4b15-a078-d6e7ec66be14",
                name: "Test group",
                location: "Middle shelf",
                description: "",
            }),
            headers: postHeaders
        });

        // Mock barcode-detector to simulate detecting a QR code with a domain
        // that matches the current URL
        mockCurrentURL('https://plants.lan/');
        jest.spyOn(FakeBarcodeDetector.prototype, 'detect').mockResolvedValue([{
            rawValue: 'https://plants.lan/manage/5c256d96-ec7d-408a-83c7-3f86d63968b2',
            boundingBox: { x: 0, y: 0, width: 200, height: 100 },
            cornerPoints: [
                { x: 0,   y: 0   },
                { x: 200, y: 0   },
                { x: 200, y: 100 },
                { x: 0,   y: 100 }
            ],
            format: 'qr_code',
        }]);

        // Mock fetch function to simulate available URL
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({
                available: true
            })
        }));

        // Open scanner, fast forward until QR code detected
        await user.click(app.getByText('Change QR Code'));
        await act(async () => await jest.advanceTimersByTimeAsync(100));

        // Mock fetch function to return expected response when confirm clicked
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                new_uuid: '5c256d96-ec7d-408a-83c7-3f86d63968b2'
            })
        }));
        // Click confirm button, confirm request made + overlay closed
        await user.click(app.getByTestId('confirm-new-qr-code-button'));
        await act(async () => await jest.advanceTimersByTimeAsync(100));

        // Confirm correct data posted to /change_uuid endpoint
        expect(global.fetch).toHaveBeenCalledWith('/change_uuid', {
            method: 'POST',
            body: JSON.stringify({
                uuid: '0640ec3b-1bed-4b15-a078-d6e7ec66be14',
                new_id: '5c256d96-ec7d-408a-83c7-3f86d63968b2'
            }),
            headers: postHeaders
        });
        expect(app.queryByTestId('qr-scanner-overlay')).toBeNull();

        // Mock fetch function to return expected response when details edited
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                name: "Test group",
                location: "Middle shelf",
                description: "",
                display_name: "Test group"
            })
        }));

        // Open edit modal, click submit button
        await user.click(app.getByRole('button', {name: 'Edit Details'}));
        await act(async () => await jest.advanceTimersByTimeAsync(100));
        await user.click(app.getByRole('button', {name: 'Edit'}));
        // const modal = document.body.querySelector(".modal-box");
        // await user.click(within(modal).getByText("Edit"));

        // Confirm payload contains updated UUID (not old)
        expect(global.fetch).toHaveBeenCalledWith('/edit_group_details', {
            method: 'POST',
            body: JSON.stringify({
                group_id: "5c256d96-ec7d-408a-83c7-3f86d63968b2",
                name: "Test group",
                location: "Middle shelf",
                description: "",
            }),
            headers: postHeaders
        });
    });
});
