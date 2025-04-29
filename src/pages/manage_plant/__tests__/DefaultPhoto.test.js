import createMockContext from 'src/testUtils/createMockContext';
import bulkCreateMockContext from 'src/testUtils/bulkCreateMockContext';
import { fireEvent } from '@testing-library/react';
import App from '../App';
import { ReduxProvider } from '../store';
import { PageWrapper } from 'src/index';
import { mockContext } from './mockContext';

const TestComponent = () => {
    // Render app
    return (
        <PageWrapper>
            <ReduxProvider>
                <App />
            </ReduxProvider>
        </PageWrapper>
    );
};

describe('Plant with no photos (no default photo set)', () => {
    let app, user;

    beforeAll(() => {
        // Create mock state objects (override photos and default_photo to
        // simulate plant with no photos)
        bulkCreateMockContext({ ...mockContext,
            photos: [],
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
        // Render app + create userEvent instance to use in tests
        user = userEvent.setup();
        app = render(<TestComponent />);
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
                "uploaded": "2 photo(s)",
                "failed": [],
                "urls": [
                    {
                        "timestamp": "2024-03-21T10:52:03+00:00",
                        "image": "/media/images/photo1.jpg",
                        "thumbnail": "/media/images/photo1_thumb.jpg",
                        "key": 1774
                    },
                    {
                        "timestamp": "2024-03-22T10:52:03+00:00",
                        "image": "/media/images/photo2.jpg",
                        "thumbnail": "/media/images/photo2_thumb.jpg",
                        "key": 1775
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
            'http://localhost/media/images/photo2_thumb.jpg'
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
        // Render app + create userEvent instance to use in tests
        user = userEvent.setup();
        app = render(<TestComponent />);
    });

    it('renders default photo thumbnail with most-recent photo', async () => {
        // Confirm default photo thumbnail used url of most-recent photo
        expect(app.getByTestId('defaultPhotoThumbnail').src).toBe(
            `http://localhost${mockContext.photos[2].thumbnail}`
        );
    });

    it('uses newest photo for default photo thumbnail after photos uploaded', async () => {
        // Confirm default photo thumbnail used url of most-recent photo
        expect(app.getByTestId('defaultPhotoThumbnail').src).toBe(
            `http://localhost${mockContext.photos[2].thumbnail}`
        );

        // Mock fetch to return expected response when a new photo is uploaded
        // Timestamp is more recent than any existing photos
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({
                "uploaded": "1 photo(s)",
                "failed": [],
                "urls": [
                    {
                        "timestamp": "2025-03-21T10:52:03+00:00",
                        "image": "/media/images/photo_new.jpg",
                        "thumbnail": "/media/images/photo_new_thumb.jpg",
                        "key": 1774
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
            'http://localhost/media/images/photo_new_thumb.jpg'
        );
    });

    it('uses newest remaining photo for default photo thumbnail after photos deleted', async () => {
        // Confirm default photo thumbnail used url of most-recent photo
        expect(app.getByTestId('defaultPhotoThumbnail').src).toBe(
            `http://localhost${mockContext.photos[2].thumbnail}`
        );

        // Mock fetch to return expected response when 2 newest photos are deleted
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({
                "deleted": [2, 3],
                "failed": []
            })
        }));

        // Simulate user opening DeletePhotosModal, selecting first 2 photos
        await user.click(app.getByText('Delete photos'));
        const modal = app.getByText('Delete Photos').closest('.modal-box');
        await user.click(within(modal).getAllByText(/Select/)[0]);
        await user.click(within(modal).getAllByText(/Select/)[1]);
        // Simulate user clicking delete button, confirm delete button
        await user.click(within(modal).getAllByRole("button", {name: "Delete"})[0]);
        await user.click(app.getByTestId('confirm_delete_photos'));

        // Confirm default photo thumbnail changed to most-recent remaining photo
        expect(app.getByTestId('defaultPhotoThumbnail').src).toBe(
            `http://localhost${mockContext.photos[0].thumbnail}`
        );
    });

    it('removes default photo thumbnail after deleting last photo', async () => {
        // Confirm default photo thumbnail used url of most-recent photo
        expect(app.getByTestId('defaultPhotoThumbnail').src).toBe(
            `http://localhost${mockContext.photos[2].thumbnail}`
        );

        // Mock fetch to return expected response when all 3 photos are deleted
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({
                "deleted": [1, 2, 3],
                "failed": []
            })
        }));

        // Simulate user opening DeletePhotosModal, selecting all 3 photos
        await user.click(app.getByText('Delete photos'));
        const modal = app.getByText('Delete Photos').closest('.modal-box');
        await user.click(within(modal).getAllByText(/Select/)[0]);
        await user.click(within(modal).getAllByText(/Select/)[1]);
        await user.click(within(modal).getAllByText(/Select/)[2]);
        // Simulate user clicking delete button, confirm delete button
        await user.click(within(modal).getAllByRole("button", {name: "Delete"})[0]);
        await user.click(app.getByTestId('confirm_delete_photos'));

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
        // Render app + create userEvent instance to use in tests
        user = userEvent.setup();
        app = render(<TestComponent />);
    });

    it('renders default photo thumbnail with configured default photo', async () => {
        // Confirm default photo thumbnail used url of configured default photo
        expect(app.getByTestId('defaultPhotoThumbnail').src).toBe(
            `http://localhost${mockContext.plant_details.thumbnail}`
        );
    });

    it('shows configured default photo thumbnail even if a newer photo is uploaded', async () => {
        // Confirm default photo thumbnail used url of configured default photo
        expect(app.getByTestId('defaultPhotoThumbnail').src).toBe(
            `http://localhost${mockContext.plant_details.thumbnail}`
        );

        // Mock fetch to return expected response when a new photo is uploaded
        // Timestamp is more recent than any existing photos
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({
                "uploaded": "1 photo(s)",
                "failed": [],
                "urls": [
                    {
                        "timestamp": "2025-03-21T10:52:03+00:00",
                        "image": "/media/images/photo_new.jpg",
                        "thumbnail": "/media/images/photo_new_thumb.jpg",
                        "key": 1774
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
            `http://localhost${mockContext.plant_details.thumbnail}`
        );
    });

    it('switches default photo thumbnail to most-recent photo after default photo deleted', async () => {
        // Confirm default photo thumbnail used url of configured default photo
        expect(app.getByTestId('defaultPhotoThumbnail').src).toBe(
            `http://localhost${mockContext.plant_details.thumbnail}`
        );

        // Mock fetch to return expected response when default photo is deleted
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({
                "deleted": [3],
                "failed": []
            })
        }));

        // Simulate user opening DeletePhotosModal, selecting default photo
        await user.click(app.getByText('Delete photos'));
        const modal = app.getByText('Delete Photos').closest('.modal-box');
        await user.click(within(modal).getAllByText(/Select/)[2]);
        // Simulate user clicking delete button, confirm delete button
        await user.click(within(modal).getAllByRole("button", {name: "Delete"})[0]);
        await user.click(app.getByTestId('confirm_delete_photos'));

        // Confirm default photo thumbnail changed to most-recent remailing photo
        expect(app.getByTestId('defaultPhotoThumbnail').src).toBe(
            `http://localhost${mockContext.photos[1].thumbnail}`
        );
    });
});
