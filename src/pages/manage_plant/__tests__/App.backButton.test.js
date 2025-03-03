import createMockContext from 'src/testUtils/createMockContext';
import App from '../App';
import { PageWrapper } from 'src/index';
import { mockContext } from './mockContext';

describe('App', () => {
    it('does not stack pageshow listeners each time back button pressed', async () => {
        // Create mock state objects
        createMockContext('plant_details', mockContext.plant_details);
        createMockContext('events', mockContext.events);
        createMockContext('notes', mockContext.notes);
        createMockContext('group_options', mockContext.group_options);
        createMockContext('species_options', mockContext.species_options);
        createMockContext('photo_urls', mockContext.photo_urls);

        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                "plant_details": mockContext.plant_details,
                "events": mockContext.events,
                "notes": mockContext.notes,
                "group_options": mockContext.group_options,
                "species_options": mockContext.species_options,
                "photo_urls": mockContext.photo_urls
            })
        }));

        // Render app, confirm /get_plant_state was not called
        const { unmount }  = render(
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
});
