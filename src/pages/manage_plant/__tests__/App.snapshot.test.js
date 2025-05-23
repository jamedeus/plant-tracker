import createMockContext from 'src/testUtils/createMockContext';
import bulkCreateMockContext from 'src/testUtils/bulkCreateMockContext';
import App from '../App';
import { mockContext } from './mockContext';

describe('App', () => {
    beforeEach(() => {
        // Create mock state objects
        bulkCreateMockContext(mockContext);
        createMockContext('user_accounts_enabled', true);
    });

    it('matches snapshot', () => {
        // Render App, confirm matches snapshot
        const component = render(<App />);
        expect(component).toMatchSnapshot();
    });

    it('matches snapshot when plant is archived', () => {
        // Override plant_details state to simulate archived plant
        createMockContext('plant_details', {
            ...mockContext.plant_details, archived: true
        });

        // Render App, confirm matches snapshot
        const component = render(<App />);
        expect(component).toMatchSnapshot();
    });
});
