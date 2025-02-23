import createMockContext from 'src/testUtils/createMockContext';
import removeMockContext from 'src/testUtils/removeMockContext';
import App from '../App';
import { PageWrapper } from 'src/index';
import { mockContext } from './mockContext';

describe('App', () => {
    // Delete mock contexts after each test (isolation)
    afterEach(() => {
        removeMockContext('type');
        removeMockContext('instance');
        removeMockContext('new_uuid');
    });

    it('matches snapshot when changing plant QR code', () => {
        // Create mock state objects
        createMockContext('type', 'plant');
        createMockContext('instance', mockContext.plant);
        createMockContext('new_uuid', mockContext.new_uuid);

        // Render App, confirm matches snapshot
        const component = render(
            <PageWrapper>
                <App />
            </PageWrapper>
        );
        expect(component).toMatchSnapshot();
    });

    it('matches snapshot when changing group QR code', () => {
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
