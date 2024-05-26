import React, { useState } from 'react';
import DefaultPhotoModal, { openDefaultPhotoModal } from '../DefaultPhotoModal';
import { mockContext } from './mockContext';
import { ErrorModalProvider } from 'src/context/ErrorModalContext';
import { postHeaders } from 'src/testUtils/headers';

const TestComponent = () => {
    const [photoUrls] = useState(mockContext.photo_urls);

    // Render app
    return (
        <>
            <DefaultPhotoModal
                plantID={"0640ec3b-1bed-4b15-a078-d6e7ec66be12"}
                photoUrls={photoUrls}
            />
            <button onClick={openDefaultPhotoModal}>
                Open photo modal
            </button>
        </>
    );
};

describe('App', () => {
    let app, user;

    beforeEach(() => {
        // Render app + create userEvent instance to use in tests
        user = userEvent.setup();
        app = render(
            <ErrorModalProvider>
                <TestComponent />
            </ErrorModalProvider>
        );
    });

    it('sends correct payload when default photo is selected', async () => {
        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({
                "default_photo": "/media/thumbnails/photo1_thumb.jpg"
            })
        }));

        // Simulate user clicking select button on first photo slide
        await user.click(app.queryAllByText('Select')[0]);

        // Confirm correct data posted to /set_plant_default_photo endpoint
        expect(fetch).toHaveBeenCalledWith('/set_plant_default_photo', {
            method: 'POST',
            body: JSON.stringify({
                plant_id: "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
                photo_key: 1,
            }),
            headers: postHeaders
        });
    });

    it('shows error in modal when API call fails', async () => {
        // Mock fetch function to return expected error message
        global.fetch = jest.fn(() => Promise.resolve({
            ok: false,
            status: 404,
            json: () => Promise.resolve({"error": "unable to find photo"})
        }));

        // Confirm error does not appear on page
        expect(app.queryByText(/unable to find photo/)).toBeNull();

        // Simulate user clicking select button on first photo slide
        await user.click(app.queryAllByText('Select')[0]);

        // Confirm modal appeared with arbitrary error text
        expect(app.queryByText(/unable to find photo/)).not.toBeNull();
    });

    it('opens modal when openPhotoModal called', async () => {
        // Click button, confirm HTMLDialogElement method was called
        await user.click(app.getByText('Open photo modal'));
        expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalled();
    });
});
