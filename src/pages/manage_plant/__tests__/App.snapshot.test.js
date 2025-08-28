
import mockCurrentURL from 'src/testUtils/mockCurrentURL';
import App from '../App';
import { mockContext } from './mockContext';

describe('App', () => {
    beforeEach(() => {
        // Simulate SINGLE_USER_MODE disabled on backend
        globalThis.USER_ACCOUNTS_ENABLED = true;
        // Mock window.location (querystring parsed when page loads)
        mockCurrentURL('https://plants.lan/manage/e1393cfd-0133-443a-97b1-06bb5bd3fcca');
    });

    it('matches snapshot', () => {
        // Render App, confirm matches snapshot
        const { container } = render(<App initialState={mockContext} />);
        expect(container).toMatchSnapshot();
    });

    it('matches snapshot when plant is archived', () => {
        // Render App, confirm matches snapshot
        const { container } = render(<App initialState={{
            ...mockContext, plant_details: {
                ...mockContext.plant_details, archived: true
            }
        }} />);
        expect(container).toMatchSnapshot();
    });
});
