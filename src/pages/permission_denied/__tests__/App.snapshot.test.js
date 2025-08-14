import createMockContext from 'src/testUtils/createMockContext';
import App from '../App';

describe('App', () => {
    it('matches snapshot', () => {
        // Render App, confirm matches snapshot
        createMockContext('user_accounts_enabled', true);
        const error = "You do not have permission to view this";
        const { container } = render(<App errorMessage={error} />);
        expect(container).toMatchSnapshot();
    });
});
