import createMockContext from 'src/testUtils/createMockContext';
import { ThemeProvider } from 'src/context/ThemeContext';
import { ErrorModalProvider } from 'src/context/ErrorModalContext';
import App from '../App';
import { mockContext } from './mockContext';

jest.mock('print-js');

describe('App', () => {
    it('does not stack pageshow listeners each time back button pressed', async () => {
        // Create mock state objects
        createMockContext('plants', mockContext.plants);
        createMockContext('groups', mockContext.groups);

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
            <ThemeProvider>
                <ErrorModalProvider>
                    <App />
                </ErrorModalProvider>
            </ThemeProvider>
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
            <ThemeProvider>
                <ErrorModalProvider>
                    <App />
                </ErrorModalProvider>
            </ThemeProvider>
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
