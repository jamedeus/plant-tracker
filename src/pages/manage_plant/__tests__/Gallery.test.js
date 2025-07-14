import createMockContext from 'src/testUtils/createMockContext';
import bulkCreateMockContext from 'src/testUtils/bulkCreateMockContext';
import App from '../App';
import { PageWrapper } from 'src/index';
import { mockContext } from './mockContext';
import { waitFor } from '@testing-library/react';
import { postHeaders } from 'src/testUtils/headers';

describe('Gallery', () => {
    let app, user;

    beforeAll(() => {
        // Create mock state objects
        bulkCreateMockContext(mockContext);
        createMockContext('user_accounts_enabled', true);

        // Mock viewport height (simulate thumbnails inside/outside viewport)
        Object.defineProperty(window, 'innerHeight', {
            writable: true,
            configurable: true,
            value: 800,
        });
    });

    beforeEach(() => {
        // Allow fast forwarding
        jest.useFakeTimers({ doNotFake: ['Date'] });

        // Render app + create userEvent instance to use in tests
        user = userEvent.setup({ advanceTimers: jest.advanceTimersByTimeAsync });
        app = render(
            <PageWrapper>
                <App />
            </PageWrapper>
        );
    });

    // Clean up pending timers after each test
    afterEach(() => {
        act(() => jest.runAllTimers());
        jest.useRealTimers();
    });

    const advanceTimers = async (delay) => {
        await act(async () => {
            await jest.advanceTimersByTimeAsync(delay);
        });
    };

    it('opens photo gallery when dropdown option is clicked', async () => {
        // Confirm gallery div does not exist
        expect(document.body.querySelector('.yarl__root')).toBeNull();

        // Click gallery dropdown option, confirm gallery appears
        await user.click(app.getByRole('button', {name: 'Gallery'}));
        await waitFor(() =>
            expect(document.body.querySelector('.yarl__root')).not.toBeNull()
        );

        // Click close button, confirm gallery disappears
        await user.click(app.getByRole('button', {name: 'Close photo gallery'}));
        await advanceTimers(500);
        expect(document.body.querySelector('.yarl__root')).toBeNull();
    });

    it('opens photo gallery when timeline photo thumbnails are clicked', async () => {
        // Confirm gallery div does not exist
        expect(document.body.querySelector('.yarl__root')).toBeNull();

        // Click first timeline image thumbnail, confirm gallery appears
        const photoThumbnail = document.body.querySelector('.photo-thumbnail-timeline > img');
        await user.click(photoThumbnail);
        expect(document.body.querySelector('.yarl__root')).not.toBeNull();
        // Confirm visible slide src is full-res version of clicked thumbnail
        expect(document.querySelector('.yarl__slide_current img').src).toBe(
            photoThumbnail.src
                .replace('/media/thumbnails', '/media/images')
                .replace('_thumb.webp', '.jpg')
        );
    });

    it('remembers the current gallery photo and reopens next time gallery is opened', async () => {
        // Open photo gallery, confirm most-recent photo is visible
        await user.click(app.getByRole('button', {name: 'Gallery'}));
        expect(document.querySelector('.yarl__slide_current img').src).toEndWith(
            '/media/images/photo3.jpg'
        );

        // Click Next photo button, confirm second most-recent photo is visible
        await user.click(app.getByRole('button', {name: 'Next photo'}));
        expect(document.querySelector('.yarl__slide_current img').src).toEndWith(
            '/media/images/photo2.jpg'
        );

        // Close gallery, confirm closed
        await user.click(app.getByRole('button', {name: 'Close photo gallery'}));
        await advanceTimers(500);
        expect(document.body.querySelector('.yarl__root')).toBeNull();

        // Reopen gallery, confirm last-viewed photo is visible (not default)
        await user.click(app.getByRole('button', {name: 'Gallery'}));
        expect(document.querySelector('.yarl__slide_current img').src).toEndWith(
            '/media/images/photo2.jpg'
        );
    });

    it('shows progress bar while gallery slideshow is playing', async () => {
        // Open photo gallery, confirm progress bar is not rendered
        await user.click(app.getByRole('button', {name: 'Gallery'}));
        expect(document.querySelector('.slideshow_progress_bar')).toBeNull();

        // Start slideshow, confirm progress bar appeared
        await user.click(app.getByRole('button', {name: 'Play photo slideshow'}));
        expect(document.querySelector('.slideshow_progress_bar')).not.toBeNull();

        // Confirm visible slide changes every 3000ms (had issues in development
        // where if photoGalleryIndexChanged was not called for each slide the
        // progress bar render would cause slideshow to go back to first slide)
        expect(document.querySelector('.yarl__slide_current img').src).toEndWith(
            '/media/images/photo3.jpg'
        );
        await advanceTimers(3000);
        expect(document.querySelector('.yarl__slide_current img').src).toEndWith(
            '/media/images/photo2.jpg'
        );

        // Confirm progress bar disappears when slideshow stopped
        expect(document.querySelector('.slideshow_progress_bar')).not.toBeNull();
        await user.click(app.getByRole('button', {name: 'Pause photo slideshow'}));
        expect(document.querySelector('.slideshow_progress_bar')).toBeNull();
    });

    it('reverses slideshow direction when toggle button is clicked', async () => {
        // Open photo gallery, confirm progress bar is not rendered
        await user.click(app.getByRole('button', {name: 'Gallery'}));
        expect(document.querySelector('.slideshow_progress_bar')).toBeNull();

        // Start slideshow, confirm progress bar appeared + moving forward
        await user.click(app.getByRole('button', {name: 'Play photo slideshow'}));
        expect(document.querySelector('.slideshow_progress_bar')).not.toBeNull();
        expect(document.querySelector('.slideshow_progress_bar.reverse')).toBeNull();

        // Confirm toggleButton icon is not flipped
        const toggleButton = app.getByRole('button', {name: 'Toggle direction'});
        const toggleButtonIcon = toggleButton.querySelector('svg');
        expect(toggleButtonIcon.classList).toContain('rotate-0');
        expect(toggleButtonIcon.classList).not.toContain('rotate-180');

        // Click toggle button, confirm progress bar reversed (moving backward)
        await user.click(toggleButton);
        expect(document.querySelector('.slideshow_progress_bar.reverse')).not.toBeNull();
        // Confirm toggle button icon flipped
        expect(toggleButtonIcon.classList).not.toContain('rotate-0');
        expect(toggleButtonIcon.classList).toContain('rotate-180');

        // Confirm visible slide changes in opposite direction after 3000ms
        expect(document.querySelector('.yarl__slide_current img').src).toEndWith(
            '/media/images/photo3.jpg'
        );
        await advanceTimers(3000);
        expect(document.querySelector('.yarl__slide_current img').src).toEndWith(
            '/media/images/photo1.jpg'
        );
    });

    it('enters fullscreen when fullscreen button clicked', async () => {
        // Open gallery, confirm have not entered or exited fullscreen
        await user.click(app.getByRole('button', {name: 'Gallery'}));
        expect(Element.prototype.requestFullscreen).not.toHaveBeenCalled();
        expect(document.exitFullscreen).not.toHaveBeenCalled();

        // Click fullscreen button, confirm entered fullscreen
        await user.click(app.getByRole('button', {name: 'Enter Fullscreen'}));
        expect(Element.prototype.requestFullscreen).toHaveBeenCalled();
        expect(document.exitFullscreen).not.toHaveBeenCalled();
        await advanceTimers(10000);

        // Click exit fullscreen button, confirm exited
        await user.click(app.getByRole('button', {name: 'Exit Fullscreen'}));
        expect(document.exitFullscreen).toHaveBeenCalled();
    });

    it('scrolls timeline to last-viewed photo when gallery is closed', async () => {
        // Mock getBoundingClientRect to simulate timeline photo thumbnail
        // being outside viewport (only scrolls if photo not already visible)
        jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
            { top: 900, bottom: 950 }
        );

        // Open gallery, confirm scrollIntoView has not been called yet
        await user.click(app.getByRole('button', {name: 'Gallery'}));
        expect(window.HTMLElement.prototype.scrollIntoView).not.toHaveBeenCalled();

        // Change slide, close gallery, confirm scrollIntoView was called
        await user.click(app.getByRole('button', {name: 'Next photo'}));
        await user.click(app.getByRole('button', {name: 'Close photo gallery'}));
        await advanceTimers(500);
        expect(window.HTMLElement.prototype.scrollIntoView).toHaveBeenCalled();
    });

    it('does not scroll timeline when closed if user did not change slides', async () => {
        // Open gallery, confirm scrollIntoView has not been called yet
        await user.click(app.getByRole('button', {name: 'Gallery'}));
        expect(window.HTMLElement.prototype.scrollIntoView).not.toHaveBeenCalled();

        // Close gallery without changing slides, confirm scrollIntoView was NOT called
        await user.click(app.getByRole('button', {name: 'Close photo gallery'}));
        await advanceTimers(500);
        expect(window.HTMLElement.prototype.scrollIntoView).not.toHaveBeenCalled();
    });

    it('does not scroll timeline when closed if thumbnail is already visible', async () => {
        // Mock getBoundingClientRect to simulate timeline photo thumbnail
        // already inside viewport (should not scroll page)
        jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
            { top: 200, bottom: 350 }
        );

        // Open gallery, confirm scrollIntoView has not been called yet
        await user.click(app.getByRole('button', {name: 'Gallery'}));
        expect(window.HTMLElement.prototype.scrollIntoView).not.toHaveBeenCalled();

        // Change slide, close gallery
        await user.click(app.getByRole('button', {name: 'Next photo'}));
        await user.click(app.getByRole('button', {name: 'Close photo gallery'}));
        await advanceTimers(500);
        // Confirm scrollIntoView was NOT called (photo already visible)
        expect(window.HTMLElement.prototype.scrollIntoView).not.toHaveBeenCalled();
    });

    it('sends correct payload when set default photo dropdown option clicked', async () => {
        // Click gallery dropdown option, confirm gallery appears
        await user.click(app.getByRole('button', {name: 'Gallery'}));
        await waitFor(() =>
            expect(document.body.querySelector('.yarl__root')).not.toBeNull()
        );

        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({
                default_photo: {
                    set: true,
                    timestamp: '2024-03-23T10:52:03+00:00',
                    image: '/media/images/photo3.jpg',
                    thumbnail: '/media/thumbnails/photo3_thumb.webp',
                    preview: '/media/previews/photo3_preview.webp',
                    key: 3
                }
            })
        }));

        // Simulate user opening dropdown and clicking "Set default photo"
        await user.click(app.getByLabelText('Gallery options'));
        await user.click(app.getByText('Set default photo'));

        // Confirm correct data posted to /set_plant_default_photo endpoint
        expect(fetch).toHaveBeenCalledWith('/set_plant_default_photo', {
            method: 'POST',
            body: JSON.stringify({
                plant_id: "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
                photo_key: 3,
            }),
            headers: postHeaders
        });

        // Confirm toast message appeared
        expect(app.queryByText("Default photo set!")).not.toBeNull();
    });

    it('shows error toast if API call fails when set default photo dropdown option clicked', async () => {
        // Click gallery dropdown option, confirm gallery appears
        await user.click(app.getByRole('button', {name: 'Gallery'}));
        await waitFor(() =>
            expect(document.body.querySelector('.yarl__root')).not.toBeNull()
        );

        // Mock fetch function to return expected error message
        global.fetch = jest.fn(() => Promise.resolve({
            ok: false,
            status: 404,
            json: () => Promise.resolve({error: "unable to find photo"})
        }));

        // Confirm error toast is not visible
        expect(app.queryByText("Failed to set default photo")).toBeNull();

        // Simulate user opening dropdown and clicking "Set default photo"
        await user.click(app.getByLabelText('Gallery options'));
        await user.click(app.getByText('Set default photo'));

        // Confirm error toast appeared
        expect(app.queryByText("Failed to set default photo")).not.toBeNull();
    });

    it('saves photo to disk on desktop when download photo option clicked', async () => {
        // Simulate desktop user (navigator.share undefined)
        navigator.share = undefined;

        // Click gallery dropdown option, confirm gallery appears
        await user.click(app.getByRole('button', {name: 'Gallery'}));
        await waitFor(() =>
            expect(document.body.querySelector('.yarl__root')).not.toBeNull()
        );

        // Mock document.createElement to create an element with a mocked click
        // method (need to confirm clicked automatically)
        const mockLink = {
            href: '',
            download: '',
            click: jest.fn()
        };
        const originalCreateElement = document.createElement;
        document.createElement = jest.fn((tagName) => {
            if (tagName === 'a') {
                return mockLink;
            }
            return originalCreateElement.call(document, tagName);
        });

        // Simulate user opening dropdown and clicking "Download photo"
        await user.click(app.getByLabelText('Gallery options'));
        await user.click(app.getByText('Download photo'));

        // Confirm createElement was called to create an <a> element
        expect(document.createElement).toHaveBeenCalledWith('a');
        // Confirm correct properties, confirm clicked automatically
        expect(mockLink.href).toBe('/media/images/photo3.jpg');
        expect(mockLink.download).toBe('Test Plant_photo_March 23, 2024.jpg');
        expect(mockLink.click).toHaveBeenCalled();

        // Restore original createElement
        document.createElement = originalCreateElement;
    });

    it('opens native share sheet on mobile when download photo option clicked', async () => {
        // Simulate mobile user (mock navigator.share and navigator.canShare)
        const mockShare = jest.fn(() => Promise.resolve());
        const mockCanShare = jest.fn(() => true);
        navigator.share = mockShare;
        navigator.canShare = mockCanShare;

        // Mock fetch function to return a blob
        const mockBlob = new Blob(['fake image data'], { type: 'image/jpeg' });
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            blob: () => Promise.resolve(mockBlob)
        }));

        // Click gallery dropdown option, confirm gallery appears
        await user.click(app.getByRole('button', {name: 'Gallery'}));
        await waitFor(() =>
            expect(document.body.querySelector('.yarl__root')).not.toBeNull()
        );

        // Simulate user opening dropdown and clicking "Download photo"
        await user.click(app.getByLabelText('Gallery options'));
        await user.click(app.getByText('Download photo'));

        // Confirm image blob was fetched
        expect(fetch).toHaveBeenCalledWith('/media/images/photo3.jpg');

        // Confirm checked if can share as file
        expect(mockCanShare).toHaveBeenCalledWith({
            files: expect.arrayContaining([
                expect.any(File)
            ])
        });

        // Confirm navigator.share was called with details (opens share sheet)
        expect(mockShare).toHaveBeenCalledWith({
            files: expect.arrayContaining([
                expect.any(File)
            ]),
            title: 'Test Plant_photo_March 23, 2024.jpg',
            text: 'This is a photo of my plant Test Plant on March 23, 2024'
        });
    });

    it('opens share sheet with URL on mobile if browser does not support sharing files', async () => {
        // Simulate mobile user on outdated browser that can't share files
        const mockShare = jest.fn(() => Promise.resolve());
        navigator.share = mockShare;
        navigator.canShare = jest.fn(() => false);

        // Click gallery dropdown option, confirm gallery appears
        await user.click(app.getByRole('button', {name: 'Gallery'}));
        await waitFor(() =>
            expect(document.body.querySelector('.yarl__root')).not.toBeNull()
        );

        // Simulate user opening dropdown and clicking "Download photo"
        await user.click(app.getByLabelText('Gallery options'));
        await user.click(app.getByText('Download photo'));

        // Confirm navigator.share was called with URL instead of file
        expect(mockShare).toHaveBeenCalledWith({
            title: 'Test Plant_photo_March 23, 2024.jpg',
            text: 'This is a photo of my plant Test Plant on March 23, 2024',
            url: '/media/images/photo3.jpg'
        });
    });

    it('shows error toast when download photo option clicked if request fails', async () => {
        // Simulate mobile user (mock navigator.share and navigator.canShare)
        navigator.share = jest.fn(() => Promise.resolve());
        navigator.canShare = jest.fn(() => true);

        // Mock fetch function to return error when photo downloaded
        global.fetch = jest.fn(() => Promise.resolve({
            ok: false,
            status: 404
        }));

        // Click gallery dropdown option, confirm gallery appears
        await user.click(app.getByRole('button', {name: 'Gallery'}));
        await waitFor(() =>
            expect(document.body.querySelector('.yarl__root')).not.toBeNull()
        );

        // Simulate user opening dropdown and clicking "Download photo"
        await user.click(app.getByLabelText('Gallery options'));
        await user.click(app.getByText('Download photo'));

        // Confirm error toast appeared
        expect(app.queryByText('Failed to download photo')).not.toBeNull();
    });

    it('shows delete confirmation when delete photo option clicked', async () => {
        // Click gallery dropdown option, confirm gallery appears
        await user.click(app.getByRole('button', {name: 'Gallery'}));
        await waitFor(() =>
            expect(document.body.querySelector('.yarl__root')).not.toBeNull()
        );

        // Confirm delete confirmation dialog not visible
        expect(app.queryByText('Delete Photo')).toBeNull();
        expect(app.queryByText('Are you sure? This cannot be undone.')).toBeNull();

        // Simulate user opening dropdown and clicking "Delete photo"
        await user.click(app.getByLabelText('Gallery options'));
        await user.click(app.getByText('Delete photo'));

        // Confirm delete confirmation dialog appeared
        expect(app.queryByText('Delete Photo')).not.toBeNull();
        expect(app.queryByText('Are you sure? This cannot be undone.')).not.toBeNull();

        // Confirm fetch was NOT called
        expect(fetch).not.toHaveBeenCalled();
    });

    it('deletes photo when user clicks delete on confirmation overlay', async () => {
        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({
                deleted: [3],
                failed: []
            })
        }));

        // Click gallery dropdown option, confirm gallery appears
        await user.click(app.getByRole('button', {name: 'Gallery'}));
        await waitFor(() =>
            expect(document.body.querySelector('.yarl__root')).not.toBeNull()
        );

        // Simulate user opening dropdown and clicking "Delete photo"
        await user.click(app.getByLabelText('Gallery options'));
        await user.click(app.getByText('Delete photo'));

        // Click delete button in confirmation dialog
        await user.click(app.getByRole('button', {name: 'Delete'}));

        // Confirm correct data posted to /delete_plant_photos endpoint
        expect(fetch).toHaveBeenCalledWith('/delete_plant_photos', {
            method: 'POST',
            body: JSON.stringify({
                plant_id: "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
                delete_photos: [3]
            }),
            headers: postHeaders
        });
    });

    it('cancels delete when user clicks cancel on confirmation overlay', async () => {
        // Click gallery dropdown option, confirm gallery appears
        await user.click(app.getByRole('button', {name: 'Gallery'}));
        await waitFor(() =>
            expect(document.body.querySelector('.yarl__root')).not.toBeNull()
        );

        // Simulate user opening dropdown and clicking "Delete photo"
        await user.click(app.getByLabelText('Gallery options'));
        await user.click(app.getByText('Delete photo'));

        // Click cancel button in confirmation dialog
        await user.click(app.getByRole('button', {name: 'Cancel'}));

        // Confirm confirmation dialog disappeared
        expect(app.queryByText('Delete Photo')).toBeNull();
        expect(app.queryByText('Are you sure? This cannot be undone.')).toBeNull();

        // Confirm fetch was NOT called
        expect(fetch).not.toHaveBeenCalled();
    });

    it('shows error toast when delete photo clicked if request fails', async () => {
        // Mock fetch function to return error response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: false,
            status: 404,
            json: () => Promise.resolve({
                error: "failed to delete photo"
            })
        }));

        // Click gallery dropdown option, confirm gallery appears
        await user.click(app.getByRole('button', {name: 'Gallery'}));
        await waitFor(() =>
            expect(document.body.querySelector('.yarl__root')).not.toBeNull()
        );

        // Simulate user opening dropdown and clicking "Delete photo"
        await user.click(app.getByLabelText('Gallery options'));
        await user.click(app.getByText('Delete photo'));

        // Click delete button in confirmation overlay
        await user.click(app.getByRole('button', {name: 'Delete'}));

        // Confirm error toast appeared, overlay disappeared
        expect(app.queryByText('Failed to delete photo')).not.toBeNull();
        expect(app.queryByText('Are you sure? This cannot be undone.')).toBeNull();
    });
});
