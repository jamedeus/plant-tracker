import createMockContext from 'src/testUtils/createMockContext';
import { PageWrapper } from 'src/index';
import App from '../App';

describe('App', () => {
    it('matches snapshot', () => {
        // Create mock state object
        createMockContext('error', 'You do not have permission to view this');

        // Render App, confirm matches snapshot
        const component = render(
            <PageWrapper>
                <App />
            </PageWrapper>
        );
        expect(component).toMatchSnapshot();
    });
});
