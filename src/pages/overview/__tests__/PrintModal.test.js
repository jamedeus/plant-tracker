import React from 'react';
import { postHeaders } from 'src/testUtils/headers';
import PrintModal, { openPrintModal } from '../PrintModal';
import print from 'print-js';
import { waitFor } from '@testing-library/react';

jest.mock('print-js');

describe('PrintModal', () => {
    let component, user;

    // Mock Blob and URL.createObjectURL (used to print QR codes)
    beforeAll(() => {
        global.Blob = jest.fn();
        URL.createObjectURL = jest.fn(() => 'url');
    });

    beforeEach(async () => {
        // Render component + create userEvent instance to use in tests
        user = userEvent.setup();
        component = render(
            <PrintModal />
        );

        // Open modal
        openPrintModal();
        await waitFor(() => {
            expect(component.getByText("Generate")).not.toBeNull();
        });
    });

    it('makes request and opens print dialog when small QR codes requested', async () => {
        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                qr_codes: "base64data"
            })
        }));

        // Click generate button with default size selected (small, 8 codes per row)
        await user.click(component.getByText("Generate"));

        // Confirm correct data posted to get_qr_codes endpoint
        expect(global.fetch).toHaveBeenCalledWith('/get_qr_codes', {
            method: 'POST',
            body: JSON.stringify({
                qr_per_row: 8
            }),
            headers: postHeaders
        });

        // Confirm Blob was created and print dialog was opened
        expect(global.Blob).toHaveBeenCalled();
        expect(print).toHaveBeenCalled();
    });

    it('makes request and opens print dialog when medium QR codes requested', async () => {
        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                qr_codes: "base64data"
            })
        }));

        // Select medium size option, click generate button
        await user.click(component.getByText("medium"));
        await user.click(component.getByText("Generate"));

        // Confirm correct data posted to get_qr_codes endpoint
        expect(global.fetch).toHaveBeenCalledWith('/get_qr_codes', {
            method: 'POST',
            body: JSON.stringify({
                qr_per_row: 6
            }),
            headers: postHeaders
        });

        // Confirm Blob was created and print dialog was opened
        expect(global.Blob).toHaveBeenCalled();
        expect(print).toHaveBeenCalled();
    });

    it('makes request and opens print dialog when large QR codes requested', async () => {
        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                qr_codes: "base64data"
            })
        }));

        // Select large size option, click generate button
        await user.click(component.getByText("large"));
        await user.click(component.getByText("Generate"));

        // Confirm correct data posted to get_qr_codes endpoint
        expect(global.fetch).toHaveBeenCalledWith('/get_qr_codes', {
            method: 'POST',
            body: JSON.stringify({
                qr_per_row: 4
            }),
            headers: postHeaders
        });

        // Confirm Blob was created and print dialog was opened
        expect(global.Blob).toHaveBeenCalled();
        expect(print).toHaveBeenCalled();
    });

    it('aborts printing QR codes if cancel clicked during request', async () => {
        // Mock fetch function to return blank promise, save resolve function
        // in variable so it can be called manually to resolve the promise
        let resolveFetch;
        global.fetch = jest.fn(() => new Promise((resolve) => {
            resolveFetch = resolve;
        }));

        // Click generate button (fetch will not complete until resolveFetch called)
        await user.click(component.getByText('Generate'));

        // Click cancel button before response received
        await user.click(component.getByText('Cancel'));

        // Resolve fetch promise with simulated API response
        resolveFetch({
            ok: true,
            json: () => Promise.resolve({ qr_codes: 'base64data' }),
        });

        // Confirm no Blob was created, print dialog was not opened
        expect(global.Blob).not.toHaveBeenCalled();
        expect(print).not.toHaveBeenCalled();
    });

    it('aborts printing QR codes if modal closed during request', async () => {
        // Mock fetch function to return blank promise, save resolve function
        // in variable so it can be called manually to resolve the promise
        let resolveFetch;
        global.fetch = jest.fn(() => new Promise((resolve) => {
            resolveFetch = resolve;
        }));

        // Click generate button (fetch will not complete until resolveFetch called)
        await user.click(component.getByText('Generate'));

        // Close modal before response received
        let event = new Event("close");
        document.querySelector('dialog').dispatchEvent(event);

        // Resolve fetch promise with simulated API response
        resolveFetch({
            ok: true,
            json: () => Promise.resolve({ qr_codes: 'base64data' }),
        });

        // Confirm no Blob was created, print dialog was not opened
        expect(global.Blob).not.toHaveBeenCalled();
        expect(print).not.toHaveBeenCalled();
    });

    it('remembers last-selected tab when options are rendered again', async () => {
        // Mock fetch function to return promise that never resolves (stay loading)
        global.fetch = jest.fn(() => new Promise(() => {}));

        // Select medium size option, confirm tab has selected class
        await user.click(component.getByText("medium"));
        expect(component.getByText("medium").classList).toContain("tab-option-selected");

        // Click generate button, then click cancel to render options again
        await user.click(component.getByText("Generate"));
        await user.click(component.getByText('Cancel'));

        // Confirm medium tab is still selected (did not default back to small)
        expect(component.getByText("medium").classList).toContain("tab-option-selected");
    });

    it('shows correct error when URL_PREFIX env var is not set', async () => {
        // Mock fetch function to return expected error
        global.fetch = jest.fn(() => Promise.resolve({
            ok: false,
            status: 501,
            json: () => Promise.resolve({
                error: 'URL_PREFIX not configured'
            })
        }));

        // Confirm error text is not in document
        expect(component.queryByText('Check docker config')).toBeNull();

        // Click generate button, confirm error text appears
        await user.click(component.getByText('Generate'));
        expect(component.getByText('Check docker config')).not.toBeNull();
    });

    it('shows correct error when URL_PREFIX env var is too long', async () => {
        // Mock fetch function to return expected error
        global.fetch = jest.fn(() => Promise.resolve({
            ok: false,
            status: 500,
            json: () => Promise.resolve({
                error: 'failed to generate, try a shorter URL_PREFIX'
            })
        }));

        // Confirm error text is not in document
        expect(component.queryByText(/shorter URL_PREFIX/)).toBeNull();

        // Click generate button, confirm error text appears
        await user.click(component.getByText('Generate'));
        expect(component.getByText(/shorter URL_PREFIX/)).not.toBeNull();
    });

    it('shows placeholder error when an unexpected error is received', async () => {
        // Mock fetch function to return unexpected error code
        global.fetch = jest.fn(() => Promise.resolve({
            ok: false,
            status: 418,
            json: () => Promise.resolve({
                error: 'an unhandled exception was raised'
            })
        }));

        // Confirm error text is not in document
        expect(component.queryByText('An unknown error occurred')).toBeNull();

        // Click generate button, confirm error text appears
        await user.click(component.getByText('Generate'));
        expect(component.getByText('An unknown error occurred')).not.toBeNull();
    });

    it('clears error when modal is closed', async () => {
        // Mock fetch function to return unexpected error code
        global.fetch = jest.fn(() => Promise.resolve({
            ok: false,
            status: 418,
            json: () => Promise.resolve({
                error: 'an unhandled exception was raised'
            })
        }));

        // Click generate button, confirm error text appears
        await user.click(component.getByText('Generate'));
        expect(component.getByText('An unknown error occurred')).not.toBeNull();

        // Close modal, confirm error text no longer in document
        let event = new Event("close");
        document.querySelector('dialog').dispatchEvent(event);
        await waitFor(() => {
            expect(component.queryByText('An unknown error occurred')).toBeNull();
        });
    });
});
