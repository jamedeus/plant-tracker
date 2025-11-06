import React from 'react';
import mockCurrentURL from 'src/testUtils/mockCurrentURL';
import mockFetchResponse from 'src/testUtils/mockFetchResponse';
import { postHeaders } from 'src/testUtils/headers';
import { fireEvent } from '@testing-library/react';
import PhotoModal from '../PhotoModal';
import { ReduxProvider } from '../store';
import { Toast } from 'src/components/Toast';
import { ErrorModal } from 'src/components/ErrorModal';
import { mockContext } from './mockContext';

// Mock useNavigate to return a mock (confirm redirected to correct page)
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => {
    const actual = jest.requireActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => mockNavigate,
    };
});

describe('PhotoModal', () => {
    let app;

    beforeEach(async () => {
        // Allow fast forwarding
        jest.useFakeTimers({ doNotFake: ['Date'] });

        // Mock window.location (querystring parsed when page loads)
        mockCurrentURL('https://plants.lan/manage/e1393cfd-0133-443a-97b1-06bb5bd3fcca');
        mockNavigate.mockReset();

        // Render modal
        app = render(
            <>
                <ReduxProvider initialState={mockContext}>
                    <PhotoModal />
                </ReduxProvider>
                <Toast />
                <ErrorModal />
            </>
        );
    });

    // Clean up pending timers after each test
    afterEach(() => {
        jest.clearAllTimers();
        jest.useRealTimers();
    });

    it('sends correct payload when photos are uploaded', async () => {
        // Mock fetch function to return expected response
        mockFetchResponse({
            uploaded: "2 photo(s)",
            failed: [],
            urls: [
                {
                    timestamp: "2024-03-21T10:52:03+00:00",
                    image: "/media/images/photo1.jpg",
                    thumbnail: null,
                    preview: null,
                    key: 12,
                    pending: true
                },
                {
                    timestamp: "2024-03-22T10:52:03+00:00",
                    image: "/media/images/photo2.jpg",
                    thumbnail: null,
                    preview: null,
                    key: 13,
                    pending: true
                }
            ]
        }, 202);

        // Create 2 mock files
        const file1 = new File(['file1'], 'file1.jpg', { type: 'image/jpeg' });
        const file2 = new File(['file2'], 'file2.jpg', { type: 'image/jpeg' });

        // Simulate user clicking input and selecting mock files
        const fileInput = app.getByTestId('photo-input');
        fireEvent.change(fileInput, { target: { files: [file1, file2] } });

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

    it('polls pending photo status until resolved after uploading', async () => {
        // Mock fetch function to return expected response
        mockFetchResponse({
            uploaded: "1 photo(s)",
            failed: [],
            urls: [
                {
                    timestamp: "2024-03-21T10:52:03+00:00",
                    image: "/media/images/photo1.jpg",
                    thumbnail: null,
                    preview: null,
                    key: 12,
                    pending: true
                },
            ]
        }, 202);

        // Confirm modal does not show number of pending photos
        expect(app.queryByText('Uploading 1 photo...')).toBeNull();

        // Simulate user clicking input and selecting mock file
        const file1 = new File(['file1'], 'file1.jpg', { type: 'image/jpeg' });
        const fileInput = app.getByTestId('photo-input');
        fireEvent.change(fileInput, { target: { files: [file1] } });
        expect(fetch).toHaveBeenCalledTimes(1);

        // Confirm number of pending photos is shown in modal
        expect(app.getByText('Uploading 1 photo...')).toBeInTheDocument();

        // Mock /get_photo_upload_status response when photo still processing
        mockFetchResponse({ photos: [{
            status: 'processing',
            photo_id: 12,
            plant_id: mockContext.plant_details.uuid,
        }]});

        // Fast forward to next polling interval, confirm polled status
        await act(async () => await jest.advanceTimersByTimeAsync(2000));
        expect(fetch).toHaveBeenCalledWith('/get_photo_upload_status', {
            method: 'POST',
            body: JSON.stringify({
                plant_id: "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
                photo_ids: [12]
            }),
            headers: postHeaders
        });

        // Confirm number of pending photos is shown in modal
        expect(app.getByText('Uploading 1 photo...')).toBeInTheDocument();

        // Mock /get_photo_upload_status response when photo resolved
        mockFetchResponse({ photos: [{
            status: 'complete',
            photo_id: 12,
            plant_id: mockContext.plant_details.uuid,
            photo_details: {
                timestamp: "2024-03-21T10:52:03+00:00",
                image: "/media/images/photo1.jpg",
                thumbnail: "/media/images/photo1_thumb.webp",
                preview: "/media/images/photo1_preview.webp",
                key: 12,
                pending: false
            },
        }]});
        await act(async () => await jest.advanceTimersByTimeAsync(2000));
        expect(global.fetch).toHaveBeenCalledWith('/get_photo_upload_status', {
            method: 'POST',
            body: JSON.stringify({
                plant_id: "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
                photo_ids: [12]
            }),
            headers: postHeaders
        });
        expect(global.fetch).toHaveBeenCalledTimes(1);

        // Confirm number of pending photos disappeared
        expect(app.queryByText('Uploading 1 photo...')).toBeNull();

        // Fast forward to next polling interval, confirm did NOT poll status
        await act(async () => await jest.advanceTimersByTimeAsync(2000));
        expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('shows error modal when photo uploads fail', async () => {
        // Mock fetch function to return expected response when photos have
        // unsupported file type
        mockFetchResponse({
            uploaded: "0 photo(s)",
            failed: [
                "photo1.heic",
                "photo2.heic"
            ],
            urls: []
        });

        // Confirm error modal is not rendered
        expect(app.queryByTestId('error-modal-body')).toBeNull();

        // Create 2 mock files
        const file1 = new File(['file1'], 'file1.heic', { type: 'image/heic' });
        const file2 = new File(['file2'], 'file2.heic', { type: 'image/heic' });

        // Simulate user clicking input and selecting mock files
        const fileInput = app.getByTestId('photo-input');
        fireEvent.change(fileInput, { target: { files: [file1, file2] } });

        // Confirm error modal appeared with failed photo names
        await act(async () => await jest.advanceTimersByTimeAsync(100));
        expect(app.getByTestId('error-modal-body')).toBeInTheDocument();
        expect(app.queryByText(/Failed to upload 2 photo(s)/)).not.toBeNull();
        expect(app.queryByText(/photo2.heic/)).not.toBeNull();
        expect(app.queryByText(/photo1.heic/)).not.toBeNull();

        // Confirm number of pending photos disappeared
        expect(app.queryByText('Uploading 2 photos...')).toBeNull();
    });

    it('shows error modal when pending photo upload fails to resolve', async () => {
        // Mock fetch function to return expected response
        mockFetchResponse({
            uploaded: "1 photo(s)",
            failed: [],
            urls: [
                {
                    timestamp: "2024-03-21T10:52:03+00:00",
                    image: "/media/images/photo1.jpg",
                    thumbnail: null,
                    preview: null,
                    key: 12,
                    pending: true
                },
            ]
        }, 202);

        // Simulate user clicking input and selecting mock file
        const file1 = new File(['file1'], 'file1.jpg', { type: 'image/jpeg' });
        const fileInput = app.getByTestId('photo-input');
        fireEvent.change(fileInput, { target: { files: [file1] } });
        expect(fetch).toHaveBeenCalledTimes(1);

        // Confirm number of pending photos is shown in modal
        expect(app.getByText('Uploading 1 photo...')).toBeInTheDocument();

        // Confirm error modal is not rendered
        expect(app.queryByTestId('error-modal-body')).toBeNull();

        // Mock /get_photo_upload_status response when photo processing failed
        mockFetchResponse({ photos: [{
            status: 'failed',
            photo_id: 12,
            plant_id: mockContext.plant_details.uuid,
        }]});

        // Fast forward to next polling interval, confirm polled status
        await act(async () => await jest.advanceTimersByTimeAsync(2000));
        expect(fetch).toHaveBeenCalledWith('/get_photo_upload_status', {
            method: 'POST',
            body: JSON.stringify({
                plant_id: "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
                photo_ids: [12]
            }),
            headers: postHeaders
        });

        // Confirm error modal appeared with number of failed photos
        await act(async () => await jest.advanceTimersByTimeAsync(100));
        expect(app.getByTestId('error-modal-body')).toBeInTheDocument();
        expect(app.queryByText(/Failed to upload 1 photo/)).not.toBeNull();

        // Confirm number of pending photos disappeared
        expect(app.queryByText('Uploading 1 photo...')).toBeNull();

        // Fast forward to next polling interval, confirm did NOT poll status
        await act(async () => await jest.advanceTimersByTimeAsync(2000));
        expect(fetch).toHaveBeenCalledTimes(1);
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

        // Confirm error modal is not rendered
        expect(app.queryByTestId('error-modal-body')).toBeNull();

        // Simulate user selecting a file
        const file1 = new File(['file1'], 'file1.jpg', { type: 'image/jpeg' });
        const fileInput = app.getByTestId('photo-input');
        fireEvent.change(fileInput, { target: { files: [file1] } });

        // Confirm modal appeared with error message
        await act(async () => await jest.advanceTimersByTimeAsync(100));
        expect(app.getByTestId('error-modal-body')).toBeInTheDocument();
        expect(app.getByTestId('error-modal-body')).toHaveTextContent(
            'Your upload was too big to process.'
        );

        // Confirm number of pending photos disappeared
        expect(app.queryByText('Uploading 1 photo...')).toBeNull();
    });

    it('shows error in modal when API call fails', async () => {
        // Mock fetch function to return arbitrary error message
        mockFetchResponse({error: "failed to upload photos"}, 500);

        // Confirm error modal is not rendered
        expect(app.queryByTestId('error-modal-body')).toBeNull();

        // Simulate user selecting a file
        const file1 = new File(['file1'], 'file1.jpg', { type: 'image/jpeg' });
        const fileInput = app.getByTestId('photo-input');
        fireEvent.change(fileInput, { target: { files: [file1] } });

        // Confirm modal appeared with arbitrary error text
        await act(async () => await jest.advanceTimersByTimeAsync(100));
        expect(app.getByTestId('error-modal-body')).toBeInTheDocument();
        expect(app.getByTestId('error-modal-body')).toHaveTextContent(
            'failed to upload photos'
        );
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

        // Confirm error modal is not rendered
        expect(app.queryByTestId('error-modal-body')).toBeNull();

        // Simulate user selecting a file
        const file1 = new File(['file1'], 'file1.jpg', { type: 'image/jpeg' });
        const fileInput = app.getByTestId('photo-input');
        fireEvent.change(fileInput, { target: { files: [file1] } });

        // Confirm modal appeared with unexpected response string
        await act(async () => await jest.advanceTimersByTimeAsync(100));
        expect(app.getByTestId('error-modal-body')).toBeInTheDocument();
        expect(app.getByTestId('error-modal-body')).toHaveTextContent(
            'Unexpected response from backend'
        );
    });

    // Note: this response can only be received if SINGLE_USER_MODE is disabled
    it('redirects to login page if user is not signed in', async () => {
        // Mock fetch function to simulate user with an expired session
        mockFetchResponse({error: "authentication required"}, 401);

        // Simulate user selecting a file
        const file1 = new File(['file1'], 'file1.jpg', { type: 'image/jpeg' });
        const fileInput = app.getByTestId('photo-input');
        fireEvent.change(fileInput, { target: { files: [file1] } });
        await act(async () => await jest.advanceTimersByTimeAsync(100));

        // Confirm redirected
        expect(mockNavigate).toHaveBeenCalledWith('/accounts/login/');
    });
});
