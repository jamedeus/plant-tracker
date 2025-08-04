import createMockContext from 'src/testUtils/createMockContext';
import mockCurrentURL from 'src/testUtils/mockCurrentURL';
import bulkCreateMockContext from 'src/testUtils/bulkCreateMockContext';
import { fireEvent } from '@testing-library/react';
import App from '../App';
import { ReduxProvider } from '../store';
import { mockContext } from './mockContext';
import { act } from '@testing-library/react';

const TestComponent = () => {
    // Render app
    return (
        <ReduxProvider>
            <App />
        </ReduxProvider>
    );
};

describe('Plant with no photos (no default photo set)', () => {
    let app, user;

    beforeAll(() => {
        // Create mock state objects (override photos and default_photo to
        // simulate plant with no photos)
        bulkCreateMockContext({ ...mockContext,
            photos: {},
            default_photo: { ...mockContext.default_photo,
                set: false,
                timestamp: null,
                image: null,
                thumbnail: null,
                key: null
            }
        });
        createMockContext('user_accounts_enabled', true);
    });

    beforeEach(() => {
        // Allow fast forwarding (must hold delete button to confirm)
        jest.useFakeTimers({ doNotFake: ['Date'] });

        // Mock window.location (querystring parsed when page loads)
        mockCurrentURL('https://plants.lan/manage/e1393cfd-0133-443a-97b1-06bb5bd3fcca');

        // Render app + create userEvent instance to use in tests
        user = userEvent.setup({ advanceTimers: jest.advanceTimersByTimeAsync });
        app = render(<TestComponent />);
    });

    // Clean up pending timers after each test
    afterEach(() => {
        act(() => jest.runAllTimers());
        jest.useRealTimers();
    });

    it('does not render default photo thumbnail if no photos exist', async () => {
        // Confirm default photo thumbnail was not rendered
        expect(app.queryByTestId('defaultPhotoThumbnail')).toBeNull();
    });

    it('renders default photo thumbnail when first photo added', async () => {
        // Confirm default photo thumbnail was not rendered
        expect(app.queryByTestId('defaultPhotoThumbnail')).toBeNull();

        // Mock fetch to return expected response when 2 photos are uploaded
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
                        key: 1774
                    },
                    {
                        timestamp: "2024-03-22T10:52:03+00:00",
                        image: "/media/images/photo2.jpg",
                        thumbnail: "/media/images/photo2_thumb.webp",
                        preview: "/media/images/photo2_preview.webp",
                        key: 1775
                    }
                ]
            })
        }));

        // Simulate user uploading 2 photos with PhotoModal
        await user.click(app.getByText('Add photos'));
        const fileInput = app.getByTestId('photo-input');
        fireEvent.change(fileInput, { target: { files: [
            new File(['file1'], 'file1.jpg', { type: 'image/jpeg' }),
            new File(['file2'], 'file2.jpg', { type: 'image/jpeg' })
        ] } });
        await user.click(app.getByText('Upload'));

        // Confirm default photo thumbnail rendered with most-recent photo
        expect(app.getByTestId('defaultPhotoThumbnail').src).toBe(
            'http://localhost/media/images/photo2_preview.webp'
        );
    });
});

describe('Plant with photos but no configured default photo', () => {
    let app, user;

    beforeAll(() => {
        // Create mock state objects to simulate plant with photos but no
        // default photo set (uses most-recent photo as default photo)
        bulkCreateMockContext({ ...mockContext,
            default_photo: { ...mockContext.default_photo,
                set: false
            }
        });
        createMockContext('user_accounts_enabled', true);
    });

    beforeEach(() => {
        // Allow fast forwarding (must hold delete button to confirm)
        jest.useFakeTimers({ doNotFake: ['Date'] });

        // Render app + create userEvent instance to use in tests
        user = userEvent.setup({ advanceTimers: jest.advanceTimersByTimeAsync });
        app = render(<TestComponent />);
    });

    // Clean up pending timers after each test
    afterEach(() => {
        act(() => jest.runAllTimers());
        jest.useRealTimers();
    });

    it('renders default photo thumbnail with most-recent photo', async () => {
        // Confirm default photo thumbnail used url of most-recent photo
        expect(app.getByTestId('defaultPhotoThumbnail').src).toBe(
            `http://localhost${mockContext.photos[3].preview}`
        );
    });

    it('uses newest photo for default photo thumbnail after photos uploaded', async () => {
        // Confirm default photo thumbnail used url of most-recent photo
        expect(app.getByTestId('defaultPhotoThumbnail').src).toBe(
            `http://localhost${mockContext.photos[3].preview}`
        );

        // Mock fetch to return expected response when a new photo is uploaded
        // Timestamp is more recent than any existing photos
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({
                uploaded: "1 photo(s)",
                failed: [],
                urls: [
                    {
                        timestamp: "2025-03-21T10:52:03+00:00",
                        image: "/media/images/photo_new.jpg",
                        thumbnail: "/media/images/photo_new_thumb.webp",
                        preview: "/media/images/photo_new_preview.webp",
                        key: 1774
                    }
                ]
            })
        }));

        // Simulate user uploading newer photo with PhotoModal
        await user.click(app.getByText('Add photos'));
        const fileInput = app.getByTestId('photo-input');
        fireEvent.change(fileInput, { target: { files: [
            new File(['file1'], 'file1.jpg', { type: 'image/jpeg' })
        ] } });
        await user.click(app.getByText('Upload'));

        // Confirm default photo thumbnail changed to newer photo
        expect(app.getByTestId('defaultPhotoThumbnail').src).toBe(
            'http://localhost/media/images/photo_new_preview.webp'
        );
    });

    it('uses newest remaining photo for default photo thumbnail after photos deleted', async () => {
        // Confirm default photo thumbnail used url of most-recent photo
        expect(app.getByTestId('defaultPhotoThumbnail').src).toBe(
            `http://localhost${mockContext.photos[3].preview}`
        );

        // Mock fetch to return expected response when 2 newest photos are deleted
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({
                deleted: [2, 3],
                failed: []
            })
        }));

        // Simulate user entering delete mode, selecting first 2 photos
        await user.click(app.getByText('Delete mode'));
        await user.click(app.getByTitle('02:52 AM - March 23, 2024'));
        await user.click(app.getByTitle('02:52 AM - March 22, 2024'));
        // Simulate user holding delete button for 1.5 seconds
        const button = app.getByRole("button", {name: "Delete"});
        fireEvent.mouseDown(button);
        await act(async () => await jest.advanceTimersByTimeAsync(1500));
        fireEvent.mouseUp(button);

        // Confirm default photo thumbnail changed to most-recent remaining photo
        expect(app.getByTestId('defaultPhotoThumbnail').src).toBe(
            `http://localhost${mockContext.photos[1].preview}`
        );
    });

    it('removes default photo thumbnail after deleting last photo', async () => {
        // Confirm default photo thumbnail used url of most-recent photo
        expect(app.getByTestId('defaultPhotoThumbnail').src).toBe(
            `http://localhost${mockContext.photos[3].preview}`
        );

        // Mock fetch to return expected response when all 3 photos are deleted
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({
                deleted: [1, 2, 3],
                failed: []
            })
        }));

        // Simulate user entering delete mode, selecting all 3 photos
        await user.click(app.getByText('Delete mode'));
        await user.click(app.getByTitle('02:52 AM - March 23, 2024'));
        await user.click(app.getByTitle('02:52 AM - March 22, 2024'));
        await user.click(app.getByTitle('02:52 AM - March 21, 2024'));
        // Simulate user holding delete button for 1.5 seconds
        const button = app.getByRole("button", {name: "Delete"});
        fireEvent.mouseDown(button);
        await act(async () => await jest.advanceTimersByTimeAsync(1500));
        fireEvent.mouseUp(button);

        // Confirm default photo thumbnail unrendered
        expect(app.queryByTestId('defaultPhotoThumbnail')).toBeNull();
    });
});

describe('Plant with default photo configured', () => {
    let app, user;

    beforeAll(() => {
        // Create mock state objects (has default photo set)
        bulkCreateMockContext(mockContext);
        createMockContext('user_accounts_enabled', true);
    });

    beforeEach(() => {
        // Allow fast forwarding (must hold delete button to confirm)
        jest.useFakeTimers({ doNotFake: ['Date'] });

        // Render app + create userEvent instance to use in tests
        user = userEvent.setup({ advanceTimers: jest.advanceTimersByTimeAsync });
        app = render(<TestComponent />);
    });

    // Clean up pending timers after each test
    afterEach(() => {
        act(() => jest.runAllTimers());
        jest.useRealTimers();
    });

    it('renders default photo thumbnail with configured default photo', async () => {
        // Confirm default photo thumbnail used url of configured default photo
        expect(app.getByTestId('defaultPhotoThumbnail').src).toBe(
            `http://localhost${mockContext.default_photo.preview}`
        );
    });

    it('shows configured default photo thumbnail even if a newer photo is uploaded', async () => {
        // Confirm default photo thumbnail used url of configured default photo
        expect(app.getByTestId('defaultPhotoThumbnail').src).toBe(
            `http://localhost${mockContext.default_photo.preview}`
        );

        // Mock fetch to return expected response when a new photo is uploaded
        // Timestamp is more recent than any existing photos
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({
                uploaded: "1 photo(s)",
                failed: [],
                urls: [
                    {
                        timestamp: "2025-03-21T10:52:03+00:00",
                        image: "/media/images/photo_new.jpg",
                        thumbnail: "/media/images/photo_new_thumb.webp",
                        preview: "/media/images/photo_new_preview.webp",
                        key: 1774
                    }
                ]
            })
        }));

        // Simulate user uploading newer photo with PhotoModal
        await user.click(app.getByText('Add photos'));
        const fileInput = app.getByTestId('photo-input');
        fireEvent.change(fileInput, { target: { files: [
            new File(['file1'], 'file1.jpg', { type: 'image/jpeg' })
        ] } });
        await user.click(app.getByText('Upload'));

        // Confirm default photo thumbnail url did not change
        expect(app.getByTestId('defaultPhotoThumbnail').src).toBe(
            `http://localhost${mockContext.default_photo.preview}`
        );
    });

    it('switches default photo thumbnail to most-recent photo after default photo deleted', async () => {
        // Confirm default photo thumbnail used url of configured default photo
        expect(app.getByTestId('defaultPhotoThumbnail').src).toBe(
            `http://localhost${mockContext.default_photo.preview}`
        );

        // Mock fetch to return expected response when default photo is deleted
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({
                deleted: [3],
                failed: []
            })
        }));

        // Simulate user entering delete mode, selecting default photo
        await user.click(app.getByText('Delete mode'));
        await user.click(app.getByTitle('02:52 AM - March 23, 2024'));
        // Simulate user holding delete button for 1.5 seconds
        const button = app.getByRole("button", {name: "Delete"});
        fireEvent.mouseDown(button);
        await act(async () => await jest.advanceTimersByTimeAsync(1500));
        fireEvent.mouseUp(button);

        // Confirm default photo thumbnail changed to most-recent remaining photo
        expect(app.getByTestId('defaultPhotoThumbnail').src).toBe(
            `http://localhost${mockContext.photos[2].preview}`
        );
    });
});
