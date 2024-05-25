import React from 'react';
import ChangeQrModal, { openChangeQrModal } from '../ChangeQrModal';
import { ErrorModalProvider } from 'src/context/ErrorModalContext';
import { postHeaders } from 'src/testUtils/headers';

const TestComponent = () => {
    return (
        <>
            <ChangeQrModal
                plantID={"0640ec3b-1bed-4b15-a078-d6e7ec66be12"}
            />
            <button onClick={openChangeQrModal}>
                Open Change QR Modal
            </button>
        </>
    );
};

describe('App', () => {
    let app, user;

    beforeEach(() => {
        // Render app + create userEvent instance to use in tests
        app = render(
            <ErrorModalProvider>
                <TestComponent />
            </ErrorModalProvider>
        );
        user = userEvent.setup();
    });

    it('sends correct payload when OK button is clicked', async () => {
        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({
                "success": "scan new QR code within 15 minutes to confirm"
            })
        }));

        // Click OK button
        await user.click(app.container.querySelector('.btn-success'));

        // Confirm correct payload posted to /change_qr_code endpoint
        expect(fetch).toHaveBeenCalledWith('/change_qr_code', {
            method: 'POST',
            body: JSON.stringify({
                plant_id: '0640ec3b-1bed-4b15-a078-d6e7ec66be12'
            }),
            headers: postHeaders
        });

        // Confirm modal was closed
        expect(HTMLDialogElement.prototype.close).toHaveBeenCalled();
    });

    it('shows error in modal when API call fails', async () => {
        // Mock fetch function to return arbitrary error message
        global.fetch = jest.fn(() => Promise.resolve({
            ok: false,
            status: 500,
            json: () => Promise.resolve({
                "error": "failed to cache UUID"
            })
        }));

        // Confirm arbitrary error does not appear on page
        expect(app.queryByText(/failed to cache UUID/)).toBeNull();

        // Click OK button
        await user.click(app.container.querySelector('.btn-success'));

        // Confirm modal appeared with arbitrary error text
        expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalled();
        expect(app.queryByText(/failed to cache UUID/)).not.toBeNull();
    });

    it('opens modal when openChangeQrModal called', async () => {
        // Click button, confirm HTMLDialogElement method was called
        await user.click(app.getByText('Open Change QR Modal'));
        expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalled();
    });
});
