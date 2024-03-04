import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from "@testing-library/user-event";
import { DateTime } from 'src/testUtils/luxonMock';
import createMockContext from 'src/testUtils/createMockContext';
import { postHeaders } from 'src/testUtils/headers';
import App from '../App';
import { mockContext } from './mockContext';
import print from 'print-js';
jest.mock('print-js');

describe('App', () => {
    let app, user;

    // Mock long-supported features that jsdom somehow hasn't implemented yet
    beforeAll(() => {
        HTMLDialogElement.prototype.show = jest.fn();
        HTMLDialogElement.prototype.showModal = jest.fn();
        HTMLDialogElement.prototype.close = jest.fn();

        // Mock Blob and URL.createObjectURL (used to print QR codes)
        global.Blob = jest.fn();
        URL.createObjectURL = jest.fn(() => 'url');
    });

    beforeEach(() => {
        // Create mock state objects
        createMockContext('plants', mockContext.plants);
        createMockContext('trays', mockContext.trays);

        // Render app + create userEvent instance to use in tests
        app = render(
            <App />
        );
        user = userEvent.setup();

        // Reset all mocks to isolate tests
        jest.resetAllMocks();
    });

    it('makes request and opens print dialog when Print QR Codes clicked', async () => {
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

        // Click Print QR Codes dropdown option
        await user.click(app.getByText("Print QR Codes"));

        // Confirm GET request made to get_qr_codes endpoint
        expect(global.fetch).toHaveBeenCalledWith('/get_qr_codes');

        // Confirm Blob was created and print dialog was opened
        expect(global.Blob).toHaveBeenCalled();
        expect(print).toHaveBeenCalled();
    });

    it('aborts printing QR codes if loading modal is closed during request', async () => {
        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                "qr_codes": "base64data"
            })
        }));

        // Mock modal open property to false to abort request
        Object.defineProperty(HTMLDialogElement.prototype, 'open', {
            get: jest.fn(() => false)
        });

        // Click Print QR Codes dropdown option
        await user.click(app.getByText("Print QR Codes"));

        // Confirm no Blob was created, print dialog was not opened
        expect(global.Blob).not.toHaveBeenCalled();
        expect(print).not.toHaveBeenCalled();
    });

    it('opens error modal if get_qr_codes endpoint returns error', async () => {
        // Mock fetch function to return bad response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: false
        }));

        // Mock modal open property to true so request doesn't abort
        Object.defineProperty(HTMLDialogElement.prototype, 'open', {
            get: jest.fn(() => true)
        });

        // Click Print QR Codes dropdown option
        await user.click(app.getByText("Print QR Codes"));

        // Confirm loading modal was closed, error modal was opened
        expect(HTMLDialogElement.prototype.close).toHaveBeenCalled();
        expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalled();

        // Confirm no Blob was created, print dialog was not opened
        expect(global.Blob).not.toHaveBeenCalled();
        expect(print).not.toHaveBeenCalled();
    });

    it('shows checkboxes and delete button when edit option clicked', async () => {
        // Confirm delete button and checkboxes are not visible
        expect(app.queryByText('Delete')).toBeNull();
        expect(app.container.querySelectorAll('.radio').length).toBe(0);

        // Click Edit option, confirm buttons and checkboxes appear
        await user.click(app.getByText("Edit"));
        expect(app.getByText('Delete').nodeName).toBe('BUTTON');
        expect(app.container.querySelectorAll('.radio').length).not.toBe(0);

        // Click cancel button, confirm buttons and checkboxes disappear
        const buttonDiv = app.container.querySelector('.sticky.bottom-4');
        await user.click(within(buttonDiv).getByText('Cancel'));
        expect(app.queryByText('Delete')).toBeNull();
        expect(app.container.querySelectorAll('.radio').length).toBe(0);
    });

    it('sends correct payload when plants are deleted', async () => {
        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                "deleted": "uuid"
            })
        }));

        // Click edit option, click first checkbox (plant)
        await user.click(app.getByText("Edit"));
        await user.click(app.container.querySelectorAll('.radio')[0]);

        // Click delete button in floating div
        await user.click(app.getByText('Delete'));

        // Confirm correct data posted to /delete_plant endpoint
        expect(global.fetch).toHaveBeenCalledWith('/delete_plant', {
            method: 'POST',
            body: JSON.stringify({
                "plant_id": "0640ec3b-1bed-4b15-a078-d6e7ec66be12"
            }),
            headers: postHeaders
        });
    });

    it('sends correct payload when trays are deleted', async () => {
        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                "deleted": "uuid"
            })
        }));

        // Click edit option, click second checkbox (tray)
        await user.click(app.getByText("Edit"));
        await user.click(app.container.querySelectorAll('.radio')[1]);

        // Click delete button in floating div
        await user.click(app.getByText('Delete'));

        // Confirm correct data posted to /delete_tray endpoint
        expect(global.fetch).toHaveBeenCalledWith('/delete_tray', {
            method: 'POST',
            body: JSON.stringify({
                "tray_id": "0640ec3b-1bed-4b15-a078-d6e7ec66be14"
            }),
            headers: postHeaders
        });
    });
});
