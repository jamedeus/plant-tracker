import React from 'react';
import QrScanner from 'src/components/QrScanner';
import QrScannerButton, { ScannedUrlButton } from 'src/components/QrScannerButton';
import FakeBarcodeDetector from 'src/testUtils/mockBarcodeDetector';
import mockCurrentURL from 'src/testUtils/mockCurrentURL';
import applyQrScannerMocks from 'src/testUtils/applyQrScannerMocks';
import { postHeaders } from 'src/testUtils/headers';
import 'jest-canvas-mock';

describe('QrScanner', () => {
    let user, component;

    beforeAll(() => {
        // Mock all browser APIs used by QrScanner
        applyQrScannerMocks();
    });

    beforeEach(() => {
        // Allow fast forwarding (skip debounce)
        jest.useFakeTimers({ doNotFake: ['Date'] });

        // Render component + create userEvent instance to use in tests
        user = userEvent.setup({ advanceTimers: jest.advanceTimersByTimeAsync });
        component = render(<QrScannerButton />);
    });

    // Clean up pending timers after each test
    afterEach(() => {
        jest.clearAllTimers();
        jest.useRealTimers();
    });

    it('toggles QR scanner overlay when button is clicked', async () => {
        // Confirm qr-scanner-overlay is not visible
        expect(component.queryByTestId('qr-scanner-overlay')).toBeNull();

        // Click button to open scanner
        await user.click(component.getByRole('button'));

        // Confirm qr-scanner-overlay appeared
        await act(async () => {
            await jest.advanceTimersByTimeAsync(100);
        });
        expect(component.getByTestId('qr-scanner-overlay')).toBeInTheDocument();

        // Click button again to close scanner
        await user.click(component.getByRole('button'));

        // Confirm qr-scanner-overlay disappeared
        await act(async () => {
            await jest.advanceTimersByTimeAsync(100);
        });
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

        // Open scanner, confirm instructions div is visible
        await user.click(component.getByRole('button'));
        expect(component.getByText('Point the camera at a QR code')).toBeInTheDocument();

        // Fast forward to detect QR code, confirm link to scanned URL appears
        await act(async () => {
            await jest.advanceTimersByTimeAsync(100);
        });
        expect(FakeBarcodeDetector.prototype.detect).toHaveBeenCalled();
        expect(component.getByTestId('scanned-url')).toBeInTheDocument();
        expect(component.getByTestId('scanned-url')).toHaveAttribute(
            'href',
            '/manage/5c256d96-ec7d-408a-83c7-3f86d63968b2'
        );
        // Confirm instructions div is no longer visible
        expect(component.queryByText('Point the camera at a QR code')).toBeNull();

        // Click link to scanned URL, confirm scanner closes (must close with
        // onClick in SPA since QrScanner component does not unmount)
        await user.click(component.getByTestId('scanned-url'));
        await act(async () => {
            await jest.advanceTimersByTimeAsync(100);
        });
        expect(component.queryByTestId('qr-scanner-overlay')).toBeNull();
    });

    it('does not show link to scanned URL if QR code domain is not part of app', async () => {
        // Mock barcode-detector to simulate detecting a QR code with a domain
        // that does NOT match the current URL
        mockCurrentURL('https://plants.lan/');
        jest.spyOn(FakeBarcodeDetector.prototype, 'detect').mockResolvedValue([{
            rawValue: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            boundingBox: { x: 0, y: 0, width: 200, height: 100 },
            cornerPoints: [
                { x: 0,   y: 0   },
                { x: 200, y: 0   },
                { x: 200, y: 100 },
                { x: 0,   y: 100 }
            ],
            format: 'qr_code',
        }]);

        // Open scanner, fast forward until QR code detected
        await user.click(component.getByRole('button'));
        await act(async () => {
            await jest.advanceTimersByTimeAsync(100);
        });

        // Confirm QR code detected, confirm link did NOT appear
        expect(FakeBarcodeDetector.prototype.detect).toHaveBeenCalled();
        expect(component.queryByTestId('scanned-url')).toBeNull();
    });

    it('does not show scanned link when QR code does not contain a URL', async () => {
        // Mock barcode-detector to simulate detecting a QR code that does not
        // contain a URL
        mockCurrentURL('https://plants.lan/');
        jest.spyOn(FakeBarcodeDetector.prototype, 'detect').mockResolvedValue([{
            rawValue: 'this QR code just contains text',
            boundingBox: { x: 0, y: 0, width: 200, height: 100 },
            cornerPoints: [
                { x: 0,   y: 0   },
                { x: 200, y: 0   },
                { x: 200, y: 100 },
                { x: 0,   y: 100 }
            ],
            format: 'qr_code',
        }]);

        // Open scanner, fast forward until QR code detected
        await user.click(component.getByRole('button'));
        await act(async () => {
            await jest.advanceTimersByTimeAsync(100);
        });

        // Confirm QR code detected, confirm link did NOT appear
        expect(FakeBarcodeDetector.prototype.detect).toHaveBeenCalled();
        expect(component.queryByTestId('scanned-url')).toBeNull();
    });
});


describe('QrScanner availableOnly mode', () => {
    let component;

    beforeEach(() => {
        // Allow fast forwarding (skip debounce)
        jest.useFakeTimers({ doNotFake: ['Date'] });

        // Render component with availableOnly = true
        component = render(<QrScanner
            onExit={jest.fn()}
            availableOnly={true}
            ScannedUrlButton={ScannedUrlButton}
        />);
    });

    // Clean up pending timers after each test
    afterEach(() => {
        jest.clearAllTimers();
        jest.useRealTimers();
    });

    it('shows link to scanned URL when QR code with available UUID detected', async () => {
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

        // Confirm instructions div is visible
        expect(component.getByText('Point the camera at a QR code')).toBeInTheDocument();

        // Fast forward to detect QR code, confirm link to scanned URL appears
        await act(async () => {
            await jest.advanceTimersByTimeAsync(100);
        });
        expect(FakeBarcodeDetector.prototype.detect).toHaveBeenCalled();
        expect(component.getByTestId('scanned-url')).toBeInTheDocument();
        expect(component.getByTestId('scanned-url')).toHaveAttribute(
            'href',
            '/manage/5c256d96-ec7d-408a-83c7-3f86d63968b2'
        );
        // Confirm instructions div is no longer visible
        expect(component.queryByText('Point the camera at a QR code')).toBeNull();

        // Confirm made correct request to check availability
        expect(global.fetch).toHaveBeenCalledWith('/is_uuid_available', {
            method: 'POST',
            body: JSON.stringify({
                uuid: "5c256d96-ec7d-408a-83c7-3f86d63968b2"
            }),
            headers: postHeaders
        });
    });

    it('does not show link to scanned URL if QR code UUID is already registered', async () => {
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

        // Mock fetch function to simulate URL already registered
        global.fetch = jest.fn(() => Promise.resolve({
            ok: false,
            status: 409,
            json: () => Promise.resolve({
                available: false
            })
        }));

        // Confirm instructions div is visible
        expect(component.getByText('Point the camera at a QR code')).toBeInTheDocument();

        // Fast forward to detect QR code
        await act(async () => await jest.advanceTimersByTimeAsync(100));

        // Confirm QR code detected, confirm link did NOT appear
        expect(FakeBarcodeDetector.prototype.detect).toHaveBeenCalled();
        expect(component.queryByTestId('scanned-url')).toBeNull();

        // Confirm made correct request to check availability
        expect(global.fetch).toHaveBeenCalledWith('/is_uuid_available', {
            method: 'POST',
            body: JSON.stringify({
                uuid: "5c256d96-ec7d-408a-83c7-3f86d63968b2"
            }),
            headers: postHeaders
        });
    });
});
