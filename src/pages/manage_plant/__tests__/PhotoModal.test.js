import React from 'react';
import mockCurrentURL from 'src/testUtils/mockCurrentURL';
import { fireEvent } from '@testing-library/react';
import PhotoModal, { openPhotoModal } from '../PhotoModal';
import { ReduxProvider } from '../store';
import PageWrapper from 'src/PageWrapper';
import { mockContext } from './mockContext';

// Mock router.navigate to check login page redirect (without rendering whole SPA)
jest.mock('src/routes', () => {
    return {
        __esModule: true,
        default: { navigate: jest.fn().mockResolvedValue(true) },
    };
});
import routerMock from 'src/routes';

const TestComponent = () => {
    // Render app
    return (
        <ReduxProvider initialState={mockContext}>
            <PhotoModal />
            <button onClick={openPhotoModal}>
                Open photo modal
            </button>
        </ReduxProvider>
    );
};

describe('PhotoModal', () => {
    let app, user;

    beforeEach(async () => {
        // Mock window.location (querystring parsed when page loads)
        mockCurrentURL('https://plants.lan/manage/e1393cfd-0133-443a-97b1-06bb5bd3fcca');

        // Render app + create userEvent instance to use in tests
        user = userEvent.setup();
        app = render(
            <PageWrapper>
                <TestComponent />
            </PageWrapper>
        );

        // Open modal
        await user.click(app.getByText('Open photo modal'));
    });

    it('sends correct payload when photos are uploaded', async () => {
        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({
                uploaded: "2 photo(s)",
                failed: [],
                urls: [
                    {
                        timestamp: "2024-03-21T10:52:03+00:00",
                        image: "/media/images/photo1.jpg",
                        thumbnail: "/media/images/photo1_thumb.webp",
                        preview: "/media/images/photo1_preview.webp",
                        key: 12
                    },
                    {
                        timestamp: "2024-03-22T10:52:03+00:00",
                        image: "/media/images/photo2.jpg",
                        thumbnail: "/media/images/photo2_thumb.webp",
                        preview: "/media/images/photo2_preview.webp",
                        key: 13
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
                uploaded: "1 photo(s)",
                failed: [],
                urls: [
                    {
                        timestamp: "2024-03-21T10:52:03",
                        image: "/media/images/photo1.jpg",
                        thumbnail: "/media/images/photo1_thumb.webp",
                        preview: "/media/images/photo1_preview.webp",
                        key: 12
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
        await user.click(app.getByTitle('Unselect file2.jpg'));

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
                uploaded: "0 photo(s)",
                failed: [
                    "photo1.heic",
                    "photo2.heic"
                ],
                urls: []
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

    it('shows error modal when payload exceeds proxy client_max_body_size', async () => {
        // Mock fetch function to return expected response when nginx reverse
        // proxy rejects a request that exceeds client_max_body_size
        global.fetch = jest.fn(() => Promise.resolve({
            ok: false,
            status: 413,
            text: () => Promise.resolve(
`<html>
<head><title>413 Request Entity Too Large</title></head>
<body>
<center><h1>413 Request Entity Too Large</h1></center>
<hr><center>nginx/1.27.3</center>
</body>
</html>`
            )
        }));

        // Confirm error message does not appear on page
        expect(app.queryByText(/Your upload was too big to process./)).toBeNull();

        // Simulate user selecting a file and clicking upload
        const file1 = new File(['file1'], 'file1.jpg', { type: 'image/jpeg' });
        const fileInput = app.getByTestId('photo-input');
        fireEvent.change(fileInput, { target: { files: [file1] } });
        await user.click(app.getByText('Upload'));

        // Confirm modal appeared with error message
        expect(app.queryByText(/Your upload was too big to process./)).not.toBeNull();
        // Confirm file input was cleared
        expect(fileInput.files.length).toBe(0);
    });

    it('shows error in modal when API call fails', async () => {
        // Mock fetch function to return arbitrary error message
        global.fetch = jest.fn(() => Promise.resolve({
            ok: false,
            status: 500,
            json: () => Promise.resolve({
                error: "failed to upload photos"
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

    // Note: this response can only be received if SINGLE_USER_MODE is disabled
    it('redirects to login page if user is not signed in', async () => {
        // Mock fetch function to simulate user with an expired session
        global.fetch = jest.fn(() => Promise.resolve({
            ok: false,
            status: 401,
            json: () => Promise.resolve({
                error: "authentication required"
            })
        }));

        // Simulate user selecting a file and clicking upload
        const file1 = new File(['file1'], 'file1.jpg', { type: 'image/jpeg' });
        const fileInput = app.getByTestId('photo-input');
        fireEvent.change(fileInput, { target: { files: [file1] } });
        await user.click(app.getByText('Upload'));

        // Confirm redirected
        expect(routerMock.navigate).toHaveBeenCalledWith('/accounts/login/');
    });
});
