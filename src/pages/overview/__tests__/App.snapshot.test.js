import createMockContext from 'src/testUtils/createMockContext';
import { PageWrapper } from 'src/index';
import App from '../App';
import { mockContext, archivedMockContext } from './mockContext';

describe('App', () => {
    it('matches snapshot when plants and groups exist', () => {
        // Create mock state objects
        createMockContext('plants', mockContext.plants);
        createMockContext('groups', mockContext.groups);

        // Render App, confirm matches snapshot
        const component = render(
            <PageWrapper>
                <App />
            </PageWrapper>
        );
        expect(component).toMatchSnapshot();
    });
});

describe('App (archived page)', () => {
    it('matches snapshot when plants and groups exist', () => {
        // Create mock state objects
        createMockContext('plants', archivedMockContext.plants);
        createMockContext('groups', archivedMockContext.groups);

        // Mock window.location to simulate archived overview
        delete window.location;
        window.location = new URL('https://plants.lan/archived');

        // Render App, confirm matches snapshot
        const component = render(
            <PageWrapper>
                <App />
            </PageWrapper>
        );
        expect(component).toMatchSnapshot();
    });
});

