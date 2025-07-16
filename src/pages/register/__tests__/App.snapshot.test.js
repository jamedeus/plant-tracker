import createMockContext from 'src/testUtils/createMockContext';
import bulkCreateMockContext from 'src/testUtils/bulkCreateMockContext';
import mockPlantSpeciesOptionsResponse from 'src/testUtils/mockPlantSpeciesOptionsResponse';
import App from '../App';
import {
    mockContext,
    mockDividingFrom,
    mockChangingPlantQrCode,
    mockChangingGroupQrCode
} from './mockContext';

describe('App', () => {
    // Mock /get_plant_species_options response (requested when page loads)
    beforeAll(() => mockPlantSpeciesOptionsResponse());

    it('matches snapshot', async () => {
        // Create mock state objects (no dividing_from)
        bulkCreateMockContext(mockContext);
        createMockContext('user_accounts_enabled', true);

        // Render App, wait for species options to be fetched
        const { container } = render(<App />);
        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalled();
        });
        // Confirm matches snapshot
        expect(container).toMatchSnapshot();
    });

    it('matches snapshot when plant division in progress', () => {
        // Create mock state objects (including dividing_from)
        bulkCreateMockContext(mockContext);
        createMockContext('user_accounts_enabled', true);
        createMockContext('dividing_from', mockDividingFrom);

        // Render App, confirm matches snapshot
        const { container } = render(<App />);
        expect(container).toMatchSnapshot();
    });

    it('matches snapshot when changing plant QR code', () => {
        // Create mock state objects (including changing_qr_code)
        bulkCreateMockContext(mockContext);
        bulkCreateMockContext(mockChangingPlantQrCode);
        createMockContext('user_accounts_enabled', true);

        // Render App, confirm matches snapshot
        const { container } = render(<App />);
        expect(container).toMatchSnapshot();
    });

    it('matches snapshot when changing group QR code', () => {
        // Create mock state objects (including changing_qr_code)
        bulkCreateMockContext(mockContext);
        bulkCreateMockContext(mockChangingGroupQrCode);
        createMockContext('user_accounts_enabled', true);

        // Render App, confirm matches snapshot
        const { container } = render(<App />);
        expect(container).toMatchSnapshot();
    });
});
