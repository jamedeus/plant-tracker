import QrScannerButton from 'src/components/QrScannerButton';
import FakeBarcodeDetector from 'src/testUtils/mockBarcodeDetector';
import mockCurrentURL from 'src/testUtils/mockCurrentURL';
import 'jest-canvas-mock';

describe('QrScanner', () => {
    let user, component;

    beforeAll(() => {
        // Mock HTTPS (required for camera access)
        Object.defineProperty(window, 'isSecureContext', {
            get: () => true,
        });

        // Mock functions used for video stream
        window.URL.createObjectURL = jest.fn(() => 'blob:mock-stream');
        HTMLMediaElement.prototype.play = () => Promise.resolve();

        // Mock mediaDevices to simulate mobile browser (front + back cameras)
        Object.defineProperty(navigator, 'mediaDevices', {
            value: {
                getSupportedConstraints: () => ({ facingMode: true }),
                enumerateDevices: jest.fn().mockResolvedValue([
                    {
                        deviceId: 'front-id',
                        kind: 'videoinput',
                        label: 'Front Camera',
                        groupId: 'grp1'
                    },
                    {
                        deviceId: 'back-id',
                        kind: 'videoinput',
                        label: 'Back Camera',
                        groupId: 'grp1'
                    }
                ]),
                getUserMedia: jest.fn()
            },
        });

        // Mock video ready as soon as overlay opens
        Object.defineProperty(HTMLMediaElement.prototype, 'readyState', {
            get: () => 4,
        });

        // Mock methods used to draw bounding box around QR code
        window.DOMRectReadOnly = class DOMRectReadOnly {
            constructor(x = 0, y = 0, width = 0, height = 0) {
                this.x      = x;
                this.y      = y;
                this.width  = width;
                this.height = height;
                this.top    = y;
                this.left   = x;
                this.right  = x + width;
                this.bottom = y + height;
            }
        };
        window.DOMRect = window.DOMRectReadOnly;
        window.DOMRectReadOnly.fromRect = function(rect) {
            return new window.DOMRectReadOnly(
                rect.x, rect.y,
                rect.width, rect.height
            );
        };
        window.DOMRect.fromRect = window.DOMRectReadOnly.fromRect;
    });

    beforeEach(() => {
        // Render component + create userEvent instance to use in tests
        user = userEvent.setup();
        component = render(<QrScannerButton />);
    });

    it('toggles QR scanner overlay when button is clicked', async () => {
        // Confirm qr-scanner-overlay is not visible
        expect(component.queryByTestId('qr-scanner-overlay')).toBeNull();

        // Click button to open scanner
        await user.click(component.getByRole('button'));

        // Confirm qr-scanner-overlay appeared
        expect(component.getByTestId('qr-scanner-overlay')).toBeInTheDocument();

        // Click button again to close scanner
        await user.click(component.getByRole('button'));

        // Confirm qr-scanner-overlay disappeared
        expect(component.queryByTestId('qr-scanner-overlay')).toBeNull();
    });

    it('changes button title and aria-label when clicked', async () => {
        const button = component.getByRole('button');

        // Confirm initial title and aria-label say "Open QR scanner"
        expect(button).toHaveAttribute('title', 'Open QR scanner');
        expect(button).toHaveAttribute('aria-label', 'Open QR scanner');

        // Click button to open scanner
        await user.click(button);

        // Confirm title and aria-label changed to "Close QR scanner"
        expect(button).toHaveAttribute('title', 'Close QR scanner');
        expect(button).toHaveAttribute('aria-label', 'Close QR scanner');
    });

    it('shows link to scanned URL when QR code detected', async () => {
        // Mock barcode-detector to simulate detected QR code
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

        // Open scanner, confirm link to scanned URL appears
        await user.click(component.getByRole('button'));
        await waitFor(() => {
            expect(FakeBarcodeDetector.prototype.detect).toHaveBeenCalled();
        });
        expect(component.getByTestId('scanned-url')).toBeInTheDocument();
        expect(component.getByTestId('scanned-url')).toHaveAttribute(
            'href',
            'https://plants.lan/manage/5c256d96-ec7d-408a-83c7-3f86d63968b2'
        );
        // Confirm instructions div is not visible
        expect(component.queryByText('Point the camera at a QR code')).toBeNull();
    });
});
