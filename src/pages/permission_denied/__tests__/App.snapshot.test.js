import createMockContext from 'src/testUtils/createMockContext';
import App from '../App';

describe('App', () => {
    it('matches snapshot', () => {
        // Create mock state object
        createMockContext('error', 'You do not have permission to view this');
        createMockContext('user_accounts_enabled', true);

        // Render App, confirm matches snapshot
        const { container } = render(<App />);
        expect(container).toMatchSnapshot();
    });
});
