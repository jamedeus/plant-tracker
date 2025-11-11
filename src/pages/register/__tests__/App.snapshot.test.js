import mockPlantSpeciesOptionsResponse from 'src/testUtils/mockPlantSpeciesOptionsResponse';
import mockCurrentURL from 'src/testUtils/mockCurrentURL';
import App from '../App';
import { mockContext } from './mockContext';

// Mock useRevalidator to return a mock (no react-router provider in tests)
const mockRevalidate = jest.fn();
jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom'),
    useRevalidator: () => ({ revalidate: mockRevalidate })
}));

describe('App', () => {
    beforeAll(() => {
        // Mock /get_plant_species_options response (requested when page loads)
        mockPlantSpeciesOptionsResponse();

        // Mock window.location (querystring parsed when page loads)
        mockCurrentURL('https://plants.lan/manage/e1393cfd-0133-443a-97b1-06bb5bd3fcca');
    });

    it('matches snapshot', async () => {
        // Render App, wait for species options to be fetched
        globalThis.USER_ACCOUNTS_ENABLED = true;
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
        globalThis.USER_ACCOUNTS_ENABLED = true;
        const { container } = render(<App initialState={mockContext} />);
        expect(container).toMatchSnapshot();
    });
});
