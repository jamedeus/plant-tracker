import React, { useRef } from 'react';
import { render, within } from '@testing-library/react';
import userEvent from "@testing-library/user-event";
import createMockContext from 'src/testUtils/createMockContext';
import { postHeaders } from 'src/testUtils/headers';
import { ThemeProvider } from 'src/context/ThemeContext';
import PrintModal from '../PrintModal';
import print from 'print-js';

jest.mock('print-js');

const TestComponent = () => {
    const printModalRef = useRef(null);
    return <PrintModal printModalRef={printModalRef} />;
};

describe('App', () => {
    let component, user;

    // Mock Blob and URL.createObjectURL (used to print QR codes)
    beforeAll(() => {
        global.Blob = jest.fn();
        URL.createObjectURL = jest.fn(() => 'url');
    });

    beforeEach(() => {
        // Render component + create userEvent instance to use in tests
        component = render(
            <TestComponent />
        );
        user = userEvent.setup();

        // Reset all mocks to isolate tests
        jest.resetAllMocks();
    });

    it('makes request and opens print dialog when small QR codes requested', async () => {
        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                "qr_codes": "base64data"
            })
        }));

        // Mock modal open property to true so request doesn't abort
        Object.defineProperty(HTMLDialogElement.prototype, 'open', {
            get: jest.fn(() => true)
        });

        // Click generate button with default size selected (small, 8 codes per row)
        await user.click(component.getByText("Generate"));

        // Confirm correct data posted to get_qr_codes endpoint
        expect(global.fetch).toHaveBeenCalledWith('/get_qr_codes', {
            method: 'POST',
            body: JSON.stringify({
                "qr_per_row": 8
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
                "qr_codes": "base64data"
            })
        }));

        // Mock modal open property to true so request doesn't abort
        Object.defineProperty(HTMLDialogElement.prototype, 'open', {
            get: jest.fn(() => true)
        });

        // Select medium size option, click generate button
        await user.click(component.getByText("medium"));
        await user.click(component.getByText("Generate"));

        // Confirm correct data posted to get_qr_codes endpoint
        expect(global.fetch).toHaveBeenCalledWith('/get_qr_codes', {
            method: 'POST',
            body: JSON.stringify({
                "qr_per_row": 6
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
                "qr_codes": "base64data"
            })
        }));

        // Mock modal open property to true so request doesn't abort
        Object.defineProperty(HTMLDialogElement.prototype, 'open', {
            get: jest.fn(() => true)
        });

        // Select large size option, click generate button
        await user.click(component.getByText("large"));
        await user.click(component.getByText("Generate"));

        // Confirm correct data posted to get_qr_codes endpoint
        expect(global.fetch).toHaveBeenCalledWith('/get_qr_codes', {
            method: 'POST',
            body: JSON.stringify({
                "qr_per_row": 4
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
        await new Promise((resolve) => setTimeout(resolve, 0));

        // Confirm no Blob was created, print dialog was not opened
        expect(global.Blob).not.toHaveBeenCalled();
        expect(print).not.toHaveBeenCalled();
    });
});
