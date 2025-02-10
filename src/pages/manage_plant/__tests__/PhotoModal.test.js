import React, { useRef } from 'react';
import { fireEvent } from '@testing-library/react';
import PhotoModal, { openPhotoModal } from '../PhotoModal';
import { PageWrapper } from 'src/index';

const TestComponent = () => {
    const photoModalRef = useRef(null);

    // Render app
    return (
        <>
            <PhotoModal
                modalRef={photoModalRef}
                plantID={"0640ec3b-1bed-4b15-a078-d6e7ec66be12"}
                photoUrls={[]}
                setPhotoUrls={jest.fn()}
            />
            <button onClick={openPhotoModal}>
                Open photo modal
            </button>
        </>
    );
};

describe('PhotoModal', () => {
    let app, user;

    beforeEach(() => {
        // Render app + create userEvent instance to use in tests
        user = userEvent.setup();
        app = render(
            <PageWrapper>
                <TestComponent />
            </PageWrapper>
        );
    });

    it('sends correct payload when photos are uploaded', async () => {
        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({
                "uploaded": "2 photo(s)",
                "failed": [],
                "urls": [
                    {
                        "created": "2024-03-21T10:52:03+00:00",
                        "url": "/media/images/photo1.jpg"
                    },
                    {
                        "created": "2024-03-22T10:52:03+00:00",
                        "url": "/media/images/photo2.jpg"
                    }
                ]
            })
        }));

        // Create 2 mock files
        const file1 = new File(['file1'], 'file1.jpg', { type: 'image/jpeg' });
        const file2 = new File(['file2'], 'file2.jpg', { type: 'image/jpeg' });

        // Simulate user clicking input and selecting mock files
        const fileInput = app.getByTestId('photo-input');
        fireEvent.change(fileInput, { target: { files: [file1, file2] } });

        // Simulate user clicking upload button
        await user.click(app.getByText('Upload'));

        // Confirm correct data posted to /add_plant_photos endpoint
        expect(fetch).toHaveBeenCalledWith('/add_plant_photos', {
            method: 'POST',
            body: expect.any(FormData),
            headers: {
                'Accept': 'application/json, text/plain, */*',
                'X-CSRFToken': undefined,
            }
        });

        // Confirm FormData contains the correct files
        const formData = fetch.mock.calls[0][1].body;
        expect(formData.get('photo_0')).toEqual(file1);
        expect(formData.get('photo_1')).toEqual(file2);
    });

    it('removes selected files in PhotoModal when X buttons are clicked', async () => {
        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({
                "uploaded": "1 photo(s)",
                "failed": [],
                "urls": [
                    {
                        "created": "2024-03-21T10:52:03",
                        "url": "/media/images/photo1.jpg"
                    }
                ]
            })
        }));

        // Create 2 mock files
        const file1 = new File(['file1'], 'file1.jpg', { type: 'image/jpeg' });
        const file2 = new File(['file2'], 'file2.jpg', { type: 'image/jpeg' });

        // Simulate user clicking input and selecting both mock files
        const fileInput = app.getByTestId('photo-input');
        fireEvent.change(fileInput, { target: { files: [file1, file2] } });

        // Simulate user clicking delete button next to second file in list
        const fileToRemove = app.getByText('file2.jpg');
        const removeButton = fileToRemove.parentNode.parentNode.children[0].children[0];
        await user.click(removeButton);

        // Confirm second file no longer shown on page
        expect(app.queryByText('file2.jpg')).toBeNull();

        // Simulate user clicking upload button
        await user.click(app.getByText('Upload'));

        // Confirm FormData posted to backend only contains first file
        const formData = fetch.mock.calls[0][1].body;
        expect(formData.get('photo_0')).toEqual(file1);
        expect(formData.get('photo_1')).toBeNull();
    });

    it('shows error modal when photo uploads fail', async () => {
        // Mock fetch function to return expected response when photos have
        // unsupported file type
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({
                "uploaded": "0 photo(s)",
                "failed": [
                    "photo1.heic",
                    "photo2.heic"
                ],
                "urls": []
            })
        }));

        // Create 2 mock files
        const file1 = new File(['file1'], 'file1.heic', { type: 'image/heic' });
        const file2 = new File(['file2'], 'file2.heic', { type: 'image/heic' });

        // Simulate user clicking input and selecting mock files
        const fileInput = app.getByTestId('photo-input');
        fireEvent.change(fileInput, { target: { files: [file1, file2] } });

        // Simulate user clicking upload button
        await user.click(app.getByText('Upload'));

        // Confirm modal appeared with failed photo names
        expect(app.queryByText(/Failed to upload 2 photo(s)/)).not.toBeNull();
        expect(app.queryByText(/photo2.heic/)).not.toBeNull();
        expect(app.queryByText(/photo1.heic/)).not.toBeNull();
    });

    it('shows error in modal when API call fails', async () => {
        // Mock fetch function to return arbitrary error message
        global.fetch = jest.fn(() => Promise.resolve({
            ok: false,
            status: 500,
            json: () => Promise.resolve({
                "error": "failed to upload photos"
            })
        }));

        // Confirm arbitrary error does not appear on page
        expect(app.queryByText(/failed to upload photos/)).toBeNull();

        // Simulate user selecting a file and clicking upload
        const file1 = new File(['file1'], 'file1.jpg', { type: 'image/jpeg' });
        const fileInput = app.getByTestId('photo-input');
        fireEvent.change(fileInput, { target: { files: [file1] } });
        await user.click(app.getByText('Upload'));

        // Confirm modal appeared with arbitrary error text
        expect(app.queryByText(/failed to upload photos/)).not.toBeNull();
        // Confirm file input was cleared
        expect(fileInput.files.length).toBe(0);
    });

    it('shows error modal when API response does not contain JSON', async () => {
        // Mock fetch function to return string (django uncaught exception)
        global.fetch = jest.fn(() => Promise.resolve({
            ok: false,
            status: 500,
            text: () => Promise.resolve(
                "this is not JSON"
            )
        }));

        // Confirm arbitrary error does not appear on page
        expect(app.queryByText(/failed to upload photos/)).toBeNull();

        // Simulate user selecting a file and clicking upload
        const file1 = new File(['file1'], 'file1.jpg', { type: 'image/jpeg' });
        const fileInput = app.getByTestId('photo-input');
        fireEvent.change(fileInput, { target: { files: [file1] } });
        await user.click(app.getByText('Upload'));

        // Confirm modal appeared with unexpected response string
        expect(app.queryByText('Unexpected response from backend')).not.toBeNull();
        // Confirm file input was cleared
        expect(fileInput.files.length).toBe(0);
    });

    it('opens modal when openPhotoModal called', async () => {
        // Click button, confirm HTMLDialogElement method was called
        await user.click(app.getByText('Open photo modal'));
        expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalled();
    });
});
