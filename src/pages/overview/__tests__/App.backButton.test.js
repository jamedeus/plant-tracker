import createMockContext from 'src/testUtils/createMockContext';
import bulkCreateMockContext from 'src/testUtils/bulkCreateMockContext';
import { PageWrapper } from 'src/index';
import App from '../App';
import { mockContext } from './mockContext';

jest.mock('print-js');

describe('App', () => {
    it('does not stack pageshow listeners each time back button pressed', async () => {
        // Create mock state objects
        bulkCreateMockContext(mockContext);
        createMockContext('user_accounts_enabled', true);

        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                "plants": mockContext.plants,
                "groups": mockContext.groups
            })
        }));

        // Render app, confirm /get_overview_state was not called
        const { unmount } = render(
            <PageWrapper>
                <App />
            </PageWrapper>
        );
        expect(global.fetch.mock.calls.filter(
            call => call[0] === '/get_overview_state'
        )).toHaveLength(0);

        // Simulate user navigating to page with back button
        const pageshowEvent = new Event('pageshow');
        Object.defineProperty(pageshowEvent, 'persisted', { value: true });
        window.dispatchEvent(pageshowEvent);

        // Confirm /get_overview_state was called once
        expect(global.fetch.mock.calls.filter(
            call => call[0] === '/get_overview_state'
        )).toHaveLength(1);
        jest.clearAllMocks();

        // Unmount and re-render the app
        unmount();
        render(
            <PageWrapper>
                <App />
            </PageWrapper>
        );

        // Confirm /get_overview_state was not called when app re-mounted
        expect(global.fetch.mock.calls.filter(
            call => call[0] === '/get_overview_state'
        )).toHaveLength(0);

        // Simulate back button again, confirm /get_overview_state state was
        // called once (would call twice before fix due to stacked listener)
        window.dispatchEvent(pageshowEvent);
        expect(global.fetch.mock.calls.filter(
            call => call[0] === '/get_overview_state'
        )).toHaveLength(1);
    });
});
