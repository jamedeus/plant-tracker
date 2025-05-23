import createMockContext from 'src/testUtils/createMockContext';
import App from '../App';

describe('App', () => {
    it('matches snapshot', () => {
        // Create mock state object
        createMockContext('user_details', {
            username: "cdanger",
            email: "totally.not.anthony.weiner@gmail.com",
            first_name: "Carlos",
            last_name: "Danger",
            date_joined: "2025-04-06T00:08:53.392806+00:00"
        });
        createMockContext('user_accounts_enabled', true);

        // Render App, confirm matches snapshot
        const component = render(<App />);
        expect(component).toMatchSnapshot();
    });
});
