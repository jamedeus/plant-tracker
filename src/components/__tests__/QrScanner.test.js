import React from 'react';
import QrScanner from 'src/components/QrScanner';
import QrScannerButton, { ScannedUrlButton } from 'src/components/QrScannerButton';
import { postHeaders } from 'src/testUtils/headers';
import mockCurrentURL from 'src/testUtils/mockCurrentURL';
import mockFetchResponse from 'src/testUtils/mockFetchResponse';
import applyQrScannerMocks from 'src/testUtils/applyQrScannerMocks';
import FakeBarcodeDetector, { mockQrCodeInViewport } from 'src/testUtils/mockBarcodeDetector';
import 'jest-canvas-mock';

describe('QrScanner', () => {
    let user, component;

    beforeAll(() => {
        // Mock all browser APIs used by QrScanner
        applyQrScannerMocks();
    });

    beforeEach(() => {
        mockCurrentURL('https://plants.lan/');

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

    it('closes scanner when user presses escape key', async () => {
        // Click button to open scanner
        await user.click(component.getByRole('button'));

        // Confirm qr-scanner-overlay appeared
        await act(async () => await jest.advanceTimersByTimeAsync(100));
        expect(component.getByTestId('qr-scanner-overlay')).toBeInTheDocument();

        // Simulate user pressing Escape key
        await user.keyboard('{Escape}');
        await act(async () => await jest.advanceTimersByTimeAsync(100));

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
        // Simulate QR code with a domain matching current URL entering the viewport
        mockQrCodeInViewport('https://plants.lan/manage/5c256d96-ec7d-408a-83c7-3f86d63968b2');

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
        // Simulate QR code with a domain that does NOT match current URL entering the viewport
        mockQrCodeInViewport('https://www.youtube.com/watch?v=dQw4w9WgXcQ');

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
        // Simulate QR code that contains text (no URL) entering the viewport
        mockQrCodeInViewport('this QR code just contains text');

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
        mockCurrentURL('https://plants.lan/');

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
        // Simulate QR code with a domain matching current URL entering the viewport
        mockQrCodeInViewport('https://plants.lan/manage/5c256d96-ec7d-408a-83c7-3f86d63968b2');
        // Mock fetch function to simulate available URL
        mockFetchResponse({available: true});

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
        // Simulate QR code with a domain matching current URL entering the viewport
        mockQrCodeInViewport('https://plants.lan/manage/5c256d96-ec7d-408a-83c7-3f86d63968b2');
        // Mock fetch function to simulate URL already registered
        mockFetchResponse({available: false}, 409);

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

    it('removes querystring parameters from URLs in scanned QR codes', async () => {
        // Simulate QR code with querystring parameter in URL entering the viewport
        mockQrCodeInViewport('https://plants.lan/manage/5c256d96-ec7d-408a-83c7-3f86d63968b2?scrollToDate=2024-02-10');
        // Mock fetch function to simulate available URL
        mockFetchResponse({available: true});

        // Fast forward to detect QR code, confirm link to scanned URL appears
        await act(async () => {
            await jest.advanceTimersByTimeAsync(100);
        });

        // Confirm only posted UUID to backend (removed querystring)
        expect(global.fetch).toHaveBeenCalledWith('/is_uuid_available', {
            method: 'POST',
            body: JSON.stringify({
                uuid: "5c256d96-ec7d-408a-83c7-3f86d63968b2"
            }),
            headers: postHeaders
        });
    });
});
