import createMockContext from 'src/testUtils/createMockContext';
import removeMockContext from 'src/testUtils/removeMockContext';
import { PageWrapper } from 'src/index';
import App from '../App';
import { mockContext } from './mockContext';

describe('App', () => {
    beforeAll(() => {
        // Mock page title (set by django template in prod)
        document.title = 'Plant Overview';
    });

    // Delete mock contexts after each test (isolation)
    afterEach(() => {
        removeMockContext('plants');
        removeMockContext('groups');
    });

    it('matches snapshot when plants and groups exist (desktop layout)', () => {
        // Create mock state objects with a single plant and group
        createMockContext('plants', [mockContext.plants[0]]);
        createMockContext('groups', [mockContext.groups[0]]);

        // Set width greater than tailwind md breakpoint
        window.innerWidth = 800;

        // Render App, confirm matches snapshot
        const component = render(
            <PageWrapper>
                <App />
            </PageWrapper>
        );
        expect(component).toMatchSnapshot();
    });

    it('matches snapshot when plants and groups exist (mobile layout)', () => {
        // Create mock state objects with a single plant and group
        createMockContext('plants', [mockContext.plants[0]]);
        createMockContext('groups', [mockContext.groups[0]]);

        // Set width less than tailwind md breakpoint
        window.innerWidth = 600;

        // Render App, confirm matches snapshot
        const component = render(
            <PageWrapper>
                <App />
            </PageWrapper>
        );
        expect(component).toMatchSnapshot();
    });

    it('matches snapshot when only plants exist', () => {
        // Create mock state objects with a single plant
        createMockContext('plants', [mockContext.plants[0]]);
        createMockContext('groups', []);

        // Render App, confirm matches snapshot
        const component = render(
            <PageWrapper>
                <App />
            </PageWrapper>
        );
        expect(component).toMatchSnapshot();
    });

    it('matches snapshot when only groups exist', () => {
        // Create mock state objects with a single group
        createMockContext('plants', []);
        createMockContext('groups', [mockContext.groups[0]]);

        // Render App, confirm matches snapshot
        const component = render(
            <PageWrapper>
                <App />
            </PageWrapper>
        );
        expect(component).toMatchSnapshot();
    });

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

describe('App (archived page)', () => {
    beforeAll(() => {
        // Mock page title (set by django template in prod)
        document.title = 'Archived';
    });

    it('matches snapshot when plants and groups exist', () => {
        // Create mock state objects with a single plant and group (flip
        // archived bools to true)
        createMockContext('plants', [{
            ...mockContext.plants[0],
            archived: true
        }]);
        createMockContext('groups', [{
            ...mockContext.groups[0],
            archived: true
        }]);

        // Mock window.location to simulate archived overview
        Object.defineProperty(window, 'location', {
            configurable: true,
            value: {
                ...window.location,
                href: 'https://plants.lan/',
                pathname: '/archived',
                assign: jest.fn()
            }
        });

        // Render App, confirm matches snapshot
        const component = render(
            <PageWrapper>
                <App />
            </PageWrapper>
        );
        expect(component).toMatchSnapshot();
    });
});

