import createMockContext from 'src/testUtils/createMockContext';
import bulkCreateMockContext from 'src/testUtils/bulkCreateMockContext';
import { PageWrapper } from 'src/index';
import App from '../App';
import { mockContext } from './mockContext';

describe('App', () => {
    it('matches snapshot', () => {
        // Create mock state objects
        bulkCreateMockContext(mockContext);
        createMockContext('user_accounts_enabled', true);

        // Render App, confirm matches snapshot
        const component = render(
            <PageWrapper>
                <App />
            </PageWrapper>
        );
        expect(component).toMatchSnapshot();
    });
});
