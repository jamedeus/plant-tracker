import createMockContext from 'src/testUtils/createMockContext';
import mockCurrentURL from 'src/testUtils/mockCurrentURL';
import bulkCreateMockContext from 'src/testUtils/bulkCreateMockContext';
import App from '../App';
import { mockContext } from './mockContext';

describe('App', () => {
    beforeEach(() => {
        // Create mock state objects
        bulkCreateMockContext(mockContext);
        createMockContext('user_accounts_enabled', true);
        // Mock window.location (querystring parsed when page loads)
        mockCurrentURL('https://plants.lan/manage/e1393cfd-0133-443a-97b1-06bb5bd3fcca');
    });

    it('matches snapshot', () => {
        // Render App, confirm matches snapshot
        const { container } = render(<App />);
        expect(container).toMatchSnapshot();
    });

    it('matches snapshot when plant is archived', () => {
        // Override plant_details state to simulate archived plant
        createMockContext('plant_details', {
            ...mockContext.plant_details, archived: true
        });

        // Render App, confirm matches snapshot
        const { container } = render(<App />);
        expect(container).toMatchSnapshot();
    });
});
