import createMockContext from 'src/testUtils/createMockContext';
import App from '../App';
import { mockContext } from './mockContext';

describe('App', () => {
    it('matches snapshot', () => {
        // Render App, confirm matches snapshot
        createMockContext('user_accounts_enabled', true);
        const { container } = render(<App initialState={mockContext} />);
        expect(container).toMatchSnapshot();
    });

    it('matches snapshot when no plants', () => {
        // Render App, confirm matches snapshot
        createMockContext('user_accounts_enabled', true);
        const { container } = render(<App initialState={{ ...mockContext, plants: {} }} />);
        expect(container).toMatchSnapshot();
    });
});
