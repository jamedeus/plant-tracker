import createMockContext from 'src/testUtils/createMockContext';
import { PageWrapper } from 'src/index';
import App from '../App';

describe('App', () => {
    it('matches snapshot when no models exist (setup)', () => {
        // Create mock state objects
        createMockContext('plants', []);
        createMockContext('groups', []);

        // Render App, confirm matches snapshot
        const component = render(
            <PageWrapper>
                <App />
            </PageWrapper>
        );
        expect(component).toMatchSnapshot();
    });
});
