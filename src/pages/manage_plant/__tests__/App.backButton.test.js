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
                plant_details: mockContext.plant_details,
                events: mockContext.events,
                notes: mockContext.notes,
                // Deep copy so subsequent calls don't fail (gets mutated when
                // buildTimelineDays sorts - not an issue in production since
                // it's a different response each time but in mock it's reused)
                photos: JSON.parse(JSON.stringify(mockContext.photos)),
                default_photo: mockContext.default_photo,
                division_events: {},
                divided_from: false
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
        await act(() => window.dispatchEvent(pageshowEvent));

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
        await act(() => window.dispatchEvent(pageshowEvent));
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
        const photoThumbnail = document.body.querySelector('.photo-thumbnail-timeline > img');
        await user.click(photoThumbnail);
        await waitFor(() =>
            expect(document.querySelector('.yarl__slide_current img').src).toBe(
                photoThumbnail.src
                    .replace('/media/thumbnails', '/media/images')
                    .replace('_thumb.webp', '.jpg')
            )
        );

        // Simulate user navigating to page with back button
        const pageshowEvent = new Event('pageshow');
        Object.defineProperty(pageshowEvent, 'persisted', { value: true });
        await act(() => window.dispatchEvent(pageshowEvent));
        // Confirm /get_plant_state was called
        expect(global.fetch).toHaveBeenCalledWith(
            '/get_plant_state/0640ec3b-1bed-4b15-a078-d6e7ec66be12'
        );

        // Click first timeline image thumbnail again, confirm still opens
        // correct photo (not oldest photo)
        await user.click(photoThumbnail);
        await waitFor(() =>
            expect(document.querySelector('.yarl__slide_current img').src).toBe(
                photoThumbnail.src
                    .replace('/media/thumbnails', '/media/images')
                    .replace('_thumb.webp', '.jpg')
            )
        );
    });

    // Issue: Timeline.DivisionEventMarker inadvertently mutated the redux
    // divisionEvents state by sorting the child plants by name. This was not
    // detected in normal usage (divisionEvents is set once and does not change)
    // but if the user navigated back to page with back button (overwrites
    // divisionEvents with response from backend) the mutation was detected and
    // an error was thrown (sometimes causing a hard crash).
    it('does not crash when user navigates back to a plant with children', async () => {
        // Add division events to mock context
        createMockContext('division_events', {
            "2024-02-11T04:19:23+00:00": [
                {
                    name: "Child plant 1",
                    uuid: "cc3fcb4f-120a-4577-ac87-ac6b5bea8968"
                },
                {
                    name: "Child plant 2",
                    uuid: "dfafcb4d-220e-2543-f187-fb6b5be589ba"
                },
            ]
        });

        // Mock fetch function to return expected /get_plant_state response with
        // same division events as above
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                plant_details: mockContext.plant_details,
                events: mockContext.events,
                notes: mockContext.notes,
                photos: JSON.parse(JSON.stringify(mockContext.photos)),
                default_photo: mockContext.default_photo,
                division_events: {
                    "2024-02-11T04:19:23+00:00": [
                        {
                            name: "Child plant 1",
                            uuid: "cc3fcb4f-120a-4577-ac87-ac6b5bea8968"
                        },
                        {
                            name: "Child plant 2",
                            uuid: "dfafcb4d-220e-2543-f187-fb6b5be589ba"
                        },
                    ]
                },
                divided_from: false
            })
        }));

        // Render app
        render(
            <PageWrapper>
                <App />
            </PageWrapper>
        );

        // Simulate user navigating to page with back button, confirm no error
        const pageshowEvent = new Event('pageshow');
        Object.defineProperty(pageshowEvent, 'persisted', { value: true });
        // TypeError causes test to fail here if state was mutated
        await act(() => window.dispatchEvent(pageshowEvent));
    });
});
