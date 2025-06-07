import createMockContext from 'src/testUtils/createMockContext';
import bulkCreateMockContext from 'src/testUtils/bulkCreateMockContext';
import App from '../App';
import { PageWrapper } from 'src/index';
import { mockContext } from './mockContext';

describe('App', () => {
    beforeAll(() => {
        // Create mock state objects
        bulkCreateMockContext(mockContext);
        createMockContext('user_accounts_enabled', true);
    });

    beforeEach(() => {
        // Mock fetch function to return expected /get_plant_state response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                "plant_details": mockContext.plant_details,
                "events": mockContext.events,
                "notes": mockContext.notes,
                "group_options": mockContext.group_options,
                "species_options": mockContext.species_options,
                // Deep copy so subsequent calls don't fail (gets mutated when
                // buildTimelineDays sorts - not an issue in production since
                // it's a different response each time but in mock it's reused)
                "photos": JSON.parse(JSON.stringify(mockContext.photos))
            })
        }));
    });

    it('does not stack pageshow listeners each time back button pressed', async () => {
        // Render app, confirm /get_plant_state was not called
        const { unmount } = render(
            <PageWrapper>
                <App />
            </PageWrapper>
        );
        expect(global.fetch.mock.calls.filter(
            call => call[0] === '/get_plant_state/0640ec3b-1bed-4b15-a078-d6e7ec66be12'
        )).toHaveLength(0);

        // Simulate user navigating to page with back button
        const pageshowEvent = new Event('pageshow');
        Object.defineProperty(pageshowEvent, 'persisted', { value: true });
        window.dispatchEvent(pageshowEvent);

        // Confirm /get_plant_state was called once
        expect(global.fetch.mock.calls.filter(
            call => call[0] === '/get_plant_state/0640ec3b-1bed-4b15-a078-d6e7ec66be12'
        )).toHaveLength(1);
        jest.clearAllMocks();

        // Unmount and re-render the app
        unmount();
        render(
            <PageWrapper>
                <App />
            </PageWrapper>
        );

        // Confirm /get_plant_state was not called when app re-mounted
        expect(global.fetch.mock.calls.filter(
            call => call[0] === '/get_plant_state/0640ec3b-1bed-4b15-a078-d6e7ec66be12'
        )).toHaveLength(0);

        // Simulate back button again, confirm /get_plant_state state was
        // called once (would call twice before fix due to stacked listener)
        window.dispatchEvent(pageshowEvent);
        expect(global.fetch.mock.calls.filter(
            call => call[0] === '/get_plant_state/0640ec3b-1bed-4b15-a078-d6e7ec66be12'
        )).toHaveLength(1);
    });

    // Issue: The backButtonPressed action handler used new photos array to
    // update timelineDays state but did not update the photos state itself.
    // This broke the photos index lookup used to open clicked photo thumbnail
    // in gallery. The thumbnail photo object is from timelineDays (updated) but
    // the gallery uses photos (not updated), so looking up the thumbnail object
    // index in photos state returned -1 (not found) no matter what (resulting
    // in the oldest photo being opened no matter what was clicked).
    it('still opens clicked timeline photo in gallery after navigating with back button', async () => {
        // Render app
        const user = userEvent.setup();
        render(
            <PageWrapper>
                <App />
            </PageWrapper>
        );

        // Click first timeline image thumbnail, confirm visible slide is the
        // full-res version of clicked thumbnail
        const photoThumbnail = document.body.querySelector('img.photo-thumbnail-timeline');
        await user.click(photoThumbnail);
        expect(document.querySelector('.yarl__slide_current img').src).toBe(
            photoThumbnail.src
                .replace('/media/thumbnails', '/media/images')
                .replace('_thumb.webp', '.jpg')
        );

        // Simulate user navigating to page with back button
        const pageshowEvent = new Event('pageshow');
        Object.defineProperty(pageshowEvent, 'persisted', { value: true });
        window.dispatchEvent(pageshowEvent);
        // Confirm /get_plant_state was called
        expect(global.fetch).toHaveBeenCalledWith(
            '/get_plant_state/0640ec3b-1bed-4b15-a078-d6e7ec66be12'
        );

        // Click first timeline image thumbnail again, confirm still opens
        // correct photo (not oldest photo)
        await user.click(photoThumbnail);
        expect(document.querySelector('.yarl__slide_current img').src).toBe(
            photoThumbnail.src
                .replace('/media/thumbnails', '/media/images')
                .replace('_thumb.webp', '.jpg')
        );
    });
});
