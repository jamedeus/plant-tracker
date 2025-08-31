import React from 'react';
import { ErrorModal } from 'src/components/ErrorModal';
import ChangeQrModal, { openChangeQrModal } from '../ChangeQrModal';
import { postHeaders } from 'src/testUtils/headers';

/* eslint react/prop-types: 0 */

const TestComponent = ({ mockClose }) => {
    return (
        <>
            <ChangeQrModal
                close={mockClose}
                uuid='0640ec3b-1bed-4b15-a078-d6e7ec66be12'
            />
            <button onClick={openChangeQrModal}>
                Open Change QR Modal
            </button>
        </>
    );
};

describe('ChangeQrModal', () => {
    let app, user;
    const mockClose = jest.fn();

    beforeEach(async () => {
        // Render app + create userEvent instance to use in tests
        user = userEvent.setup();
        app = render(
            <>
                <TestComponent mockClose={mockClose} />
                <ErrorModal />
            </>
        );

        // Open modal
        await user.click(app.getByText("Open Change QR Modal"));
    });

    it('sends correct payload when OK button is clicked', async () => {
        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({
                success: "scan new QR code within 15 minutes to confirm"
            })
        }));

        // Click OK button
        await user.click(app.getByRole('button', {name: 'OK'}));

        // Confirm correct payload posted to /change_qr_code endpoint
        expect(fetch).toHaveBeenCalledWith('/change_qr_code', {
            method: 'POST',
            body: JSON.stringify({
                uuid: '0640ec3b-1bed-4b15-a078-d6e7ec66be12'
            }),
            headers: postHeaders
        });

        // Confirm modal was closed
        expect(mockClose).toHaveBeenCalled();
    });

    it('shows error in modal when API call fails', async () => {
        // Mock fetch function to return arbitrary error message
        global.fetch = jest.fn(() => Promise.resolve({
            ok: false,
            status: 500,
            json: () => Promise.resolve({
                error: "failed to cache UUID"
            })
        }));

        // Confirm arbitrary error does not appear on page
        expect(app.queryByTestId('error-modal-body')).toBeNull();
        expect(app.queryByText(/failed to cache UUID/)).toBeNull();

        // Click OK button
        await user.click(app.getByRole('button', {name: 'OK'}));

        // Confirm error modal appeared with arbitrary error text
        expect(app.getByTestId('error-modal-body')).toBeInTheDocument();
        expect(app.getByTestId('error-modal-body')).toHaveTextContent(
            'failed to cache UUID'
        );

        // Confirm did not close ChangeQrModal
        expect(mockClose).not.toHaveBeenCalled();
    });
});
