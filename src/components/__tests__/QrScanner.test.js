import QrScannerButton from 'src/components/QrScanner';
import 'jest-canvas-mock';

describe('QrScannerButton', () => {
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
});
