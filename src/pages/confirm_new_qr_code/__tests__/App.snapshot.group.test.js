import createMockContext from 'src/testUtils/createMockContext';
import App from '../App';
import { PageWrapper } from 'src/index';
import { mockContext } from './mockContext';

describe('App', () => {
    it('matches snapshot', () => {
        // Create mock state objects
        createMockContext('type', 'group');
        createMockContext('instance', mockContext.group);
        createMockContext('new_uuid', mockContext.new_uuid);

        // Render App, confirm matches snapshot
        const component = render(
            <PageWrapper>
                <App />
            </PageWrapper>
        );
        expect(component).toMatchSnapshot();
    });
});
