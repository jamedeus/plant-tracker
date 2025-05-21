import createMockContext from 'src/testUtils/createMockContext';
import bulkCreateMockContext from 'src/testUtils/bulkCreateMockContext';
import App from '../App';
import { PageWrapper } from 'src/index';
import { mockContext } from './mockContext';

describe('Gallery', () => {
    let app, user;

    beforeAll(() => {
        // Create mock state objects
        bulkCreateMockContext(mockContext);
        createMockContext('user_accounts_enabled', true);
    });

    beforeEach(() => {
        // Allow fast forwarding (must hold delete note button to confirm)
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
        jest.runAllTimers();
        jest.useRealTimers();
    });

    it('opens photo gallery when dropdown option is clicked', async () => {
        // Confirm gallery div does not exist
        expect(document.body.querySelector('.yarl__root')).toBeNull();

        // Click image thumbnail, confirm gallery appears
        await user.click(app.getByRole('button', {name: 'Gallery'}));
        expect(document.body.querySelector('.yarl__root')).not.toBeNull();

        // Click close button, confirm gallery disappears
        await user.click(app.getByRole('button', {name: 'Close'}));
        await jest.advanceTimersByTimeAsync(500);
        expect(document.body.querySelector('.yarl__root')).toBeNull();
    });

    it('opens photo gallery when timeline photo thumbnails are clicked', async () => {
        // Confirm gallery div does not exist
        expect(document.body.querySelector('.yarl__root')).toBeNull();

        // Click first timeline image thumbnail, confirm gallery appears
        const photoThumbnail = document.body.querySelector('img.photo-thumbnail-timeline');
        await user.click(photoThumbnail);
        expect(document.body.querySelector('.yarl__root')).not.toBeNull();
        // Confirm visible slide src is full-res version of clicked thumbnail
        expect(document.querySelector('.yarl__slide_current img').src).toBe(
            photoThumbnail.src
                .replace('/media/thumbnails', '/media/images')
                .replace('_thumb', '')
        );
    });

    it('remembers the current gallery photo and reopens next time gallery is opened', async () => {
        // Open photo gallery, confirm most-recent photo is visible
        await user.click(app.getByRole('button', {name: 'Gallery'}));
        expect(document.querySelector('.yarl__slide_current img').src).toEndWith(
            '/media/images/photo3.jpg'
        );

        // Click next photo button, confirm second most-recent photo is visible
        await user.click(app.getByRole('button', {name: 'Next'}));
        expect(document.querySelector('.yarl__slide_current img').src).toEndWith(
            '/media/images/photo2.jpg'
        );

        // Close gallery, confirm closed
        await user.click(app.getByRole('button', {name: 'Close'}));
        await jest.advanceTimersByTimeAsync(500);
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
        await user.click(app.getByRole('button', {name: 'Play'}));
        expect(document.querySelector('.slideshow_progress_bar')).not.toBeNull();

        // Confirm visible slide changes every 3000ms (had issues in development
        // where if photoGalleryIndexChanged was not called for each slide the
        // progress bar render would cause slideshow to go back to first slide)
        expect(document.querySelector('.yarl__slide_current img').src).toEndWith(
            '/media/images/photo3.jpg'
        );
        await jest.advanceTimersByTimeAsync(3000);
        expect(document.querySelector('.yarl__slide_current img').src).toEndWith(
            '/media/images/photo2.jpg'
        );

        // Confirm progress bar disappears when slideshow stopped
        expect(document.querySelector('.slideshow_progress_bar')).not.toBeNull();
        await user.click(app.getByRole('button', {name: 'Pause'}));
        expect(document.querySelector('.slideshow_progress_bar')).toBeNull();
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
        await jest.advanceTimersByTimeAsync(10000);

        // Click exit fullscreen button, confirm exited
        await user.click(app.getByRole('button', {name: 'Exit Fullscreen'}));
        expect(document.exitFullscreen).toHaveBeenCalled();
    });
});
