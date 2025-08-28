import App from '../App';
import { mockContext } from './mockContext';

describe('App', () => {
    it('matches snapshot', () => {
        // Render App, confirm matches snapshot
        globalThis.USER_ACCOUNTS_ENABLED = true;
        const { container } = render(<App initialState={mockContext} />);
        expect(container).toMatchSnapshot();
    });

    it('matches snapshot when no plants', () => {
        // Render App, confirm matches snapshot
        globalThis.USER_ACCOUNTS_ENABLED = true;
        const { container } = render(<App initialState={{ ...mockContext, plants: {} }} />);
        expect(container).toMatchSnapshot();
    });
});
