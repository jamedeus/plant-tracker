/** @jest-environment ./src/testUtils/IgnoreExceptionEnv */

import { Toast } from 'src/components/Toast';
import QrScannerButton from 'src/components/QrScannerButton';
import applyQrScannerMocks from 'src/testUtils/applyQrScannerMocks';
import 'jest-canvas-mock';

describe('QrScanner no camera permission', () => {
    beforeAll(() => {
        // Mock all browser APIs used by QrScanner
        applyQrScannerMocks();
    });

    beforeEach(() => {
        // Allow fast forwarding (skip debounce)
        jest.useFakeTimers({ doNotFake: ['Date'] });
    });

    // Clean up pending timers after each test
    afterEach(() => {
        jest.clearAllTimers();
        jest.useRealTimers();
    });

    it('closes scanner and shows error toast if camera permission is disabled', async () => {
        // Silence console.error when scanner closes
        jest.spyOn(console, 'error').mockImplementation(() => {});

        // Mock getUserMedia to simulate camera permission disabled
        navigator.mediaDevices.getUserMedia.mockImplementationOnce(() =>
            Promise.reject({ name: 'NotAllowedError', message: 'Permission denied' })
        );

        const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTimeAsync });
        const component = render(
            <>
                <QrScannerButton />
                <Toast />
            </>
        );

        // Click button to open scanner, fast forward until error detected
        await user.click(component.getByRole('button'));
        await act(async () => await jest.advanceTimersByTimeAsync(1000));

        // Confirm scanner closed, error toast appeared
        expect(component.queryByTestId('qr-scanner-overlay')).toBeNull();
        expect(component.getByText(
            'Unable to open camera, please allow camera access and try again'
        )).toBeInTheDocument();
    });
});
