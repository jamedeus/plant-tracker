import createMockContext from 'src/testUtils/createMockContext';
import App from '../App';
import { PageWrapper } from 'src/index';
import { mockContext } from './mockContext';

describe('App', () => {
    it('does not stack pageshow listeners each time back button pressed', async () => {
        // Create mock state objects
        createMockContext('type', 'plant');
        createMockContext('instance', mockContext.plant);
        createMockContext('new_uuid', mockContext.new_uuid);
        createMockContext('user_accounts_enabled', true);
        createMockContext('preview', mockContext.preview);

        // Render app, confirm reload was not called
        const { unmount } = render(
            <PageWrapper>
                <App />
            </PageWrapper>
        );
        expect(window.location.reload).not.toHaveBeenCalled();

        // Simulate user navigating to confirm_new_qr_code page with back button
        const pageshowEvent = new Event('pageshow');
        Object.defineProperty(pageshowEvent, 'persisted', { value: true });
        window.dispatchEvent(pageshowEvent);

        // Confirm page was reloaded
        expect(window.location.reload).toHaveBeenCalledTimes(1);
        jest.clearAllMocks();

        // Unmount and re-render the app
        unmount();
        render(
            <PageWrapper>
                <App />
            </PageWrapper>
        );

        // Confirm reload was not called
        expect(window.location.reload).not.toHaveBeenCalled();

        // Simulate back button again, confirm reload was called once (would
        // call twice before fix due to stacked listener)
        window.dispatchEvent(pageshowEvent);
        expect(window.location.reload).toHaveBeenCalledTimes(1);
    });
});
