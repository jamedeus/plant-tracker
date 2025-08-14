import createMockContext from 'src/testUtils/createMockContext';
import mockPlantSpeciesOptionsResponse from 'src/testUtils/mockPlantSpeciesOptionsResponse';
import mockCurrentURL from 'src/testUtils/mockCurrentURL';
import { PageWrapper } from 'src/index';
import App from '../App';
import { mockContext } from './mockContext';

describe('App', () => {
    it('does not stack pageshow listeners each time back button pressed', async () => {
        // Create mock state object
        createMockContext('user_accounts_enabled', true);

        // Mock /get_plant_species_options response (requested when page loads)
        mockPlantSpeciesOptionsResponse();

        // Mock window.location (querystring parsed when page loads)
        mockCurrentURL('https://plants.lan/manage/e1393cfd-0133-443a-97b1-06bb5bd3fcca');

        // Render app, confirm reload was not called
        const { unmount } = render(
            <PageWrapper>
                <App initialState={mockContext} />
            </PageWrapper>
        );
        expect(window.location.reload).not.toHaveBeenCalled();

        // Simulate user navigating to register page with back button
        const pageshowEvent = new Event('pageshow');
        Object.defineProperty(pageshowEvent, 'persisted', { value: true });
        window.dispatchEvent(pageshowEvent);

        // Confirm page was reloaded
        expect(window.location.reload).toHaveBeenCalledTimes(1);
        jest.clearAllMocks();

        // Unmount and re-render the app
        unmount();
        await act(async () => {
            render(
                <PageWrapper>
                    <App initialState={mockContext} />
                </PageWrapper>
            );
        });

        // Confirm reload was not called
        expect(window.location.reload).not.toHaveBeenCalled();

        // Simulate back button again, confirm reload was called once (would
        // call twice before fix due to stacked listener)
        window.dispatchEvent(pageshowEvent);
        expect(window.location.reload).toHaveBeenCalledTimes(1);
    });
});
