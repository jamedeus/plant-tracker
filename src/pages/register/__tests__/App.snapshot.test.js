import createMockContext from 'src/testUtils/createMockContext';
import mockPlantSpeciesOptionsResponse from 'src/testUtils/mockPlantSpeciesOptionsResponse';
import mockCurrentURL from 'src/testUtils/mockCurrentURL';
import App from '../App';
import {
    mockContext,
    mockDividingFrom,
    mockChangingPlantQrCode,
    mockChangingGroupQrCode
} from './mockContext';

describe('App', () => {
    beforeAll(() => {
        // Mock /get_plant_species_options response (requested when page loads)
        mockPlantSpeciesOptionsResponse();

        // Mock window.location (querystring parsed when page loads)
        mockCurrentURL('https://plants.lan/manage/e1393cfd-0133-443a-97b1-06bb5bd3fcca');
    });

    it('matches snapshot', async () => {
        // Render App, wait for species options to be fetched
        createMockContext('user_accounts_enabled', true);
        const { container } = render(<App initialState={mockContext} />);
        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalled();
        });
        // Confirm matches snapshot
        expect(container).toMatchSnapshot();
    });

    it('matches snapshot when group querystring param is present', () => {

        // Mock window.location to add querystring to URL (start on group form)
        mockCurrentURL(
            'https://plants.lan/manage/e1393cfd-0133-443a-97b1-06bb5bd3fcca?type=group'
        );

        // Render App, confirm matches snapshot
        createMockContext('user_accounts_enabled', true);
        const { container } = render(<App initialState={mockContext} />);
        expect(container).toMatchSnapshot();
    });

    it('matches snapshot when plant division in progress', () => {
        // Render App, confirm matches snapshot
        createMockContext('user_accounts_enabled', true);
        const { container } = render(
            <App initialState={{ ...mockContext, dividing_from: mockDividingFrom }} />
        );
        expect(container).toMatchSnapshot();
    });

    it('matches snapshot when changing plant QR code', () => {
        // Render App, confirm matches snapshot
        createMockContext('user_accounts_enabled', true);
        const { container } = render(
            <App initialState={{ ...mockContext, ...mockChangingPlantQrCode }} />
        );
        expect(container).toMatchSnapshot();
    });

    it('matches snapshot when changing group QR code', () => {
        // Render App, confirm matches snapshot
        createMockContext('user_accounts_enabled', true);
        const { container } = render(
            <App initialState={{ ...mockContext, ...mockChangingGroupQrCode }} />
        );
        expect(container).toMatchSnapshot();
    });
});
