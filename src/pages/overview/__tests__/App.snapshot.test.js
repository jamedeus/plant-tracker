import createMockContext from 'src/testUtils/createMockContext';
import bulkCreateMockContext from 'src/testUtils/bulkCreateMockContext';
import App from '../App';
import { mockContext } from './mockContext';

describe('App', () => {
    beforeAll(() => {
        // Mock page title (set by django template in prod)
        document.title = 'Plant Overview';
    });

    it('matches snapshot when plants and groups exist (desktop layout)', () => {
        // Create mock state objects with a single plant and group
        bulkCreateMockContext({ ...mockContext,
            plants: [mockContext.plants[0]],
            groups: [mockContext.groups[0]],
        });
        createMockContext('user_accounts_enabled', true);

        // Set width greater than tailwind md breakpoint
        window.innerWidth = 800;

        // Render App, confirm matches snapshot
        const component = render(<App />);
        expect(component).toMatchSnapshot();
    });

    it('matches snapshot when plants and groups exist (mobile layout)', () => {
        // Create mock state objects with a single plant and group
        bulkCreateMockContext({ ...mockContext,
            plants: [mockContext.plants[0]],
            groups: [mockContext.groups[0]],
        });
        createMockContext('user_accounts_enabled', true);

        // Set width less than tailwind md breakpoint
        window.innerWidth = 600;

        // Render App, confirm matches snapshot
        const component = render(<App />);
        expect(component).toMatchSnapshot();
    });

    it('matches snapshot when only plants exist', () => {
        // Create mock state objects with a single plant and no groups
        bulkCreateMockContext({ ...mockContext,
            plants: [mockContext.plants[0]],
            groups: [],
        });
        createMockContext('user_accounts_enabled', true);

        // Render App, confirm matches snapshot
        const component = render(<App />);
        expect(component).toMatchSnapshot();
    });

    it('matches snapshot when only groups exist', () => {
        // Create mock state objects with a single group and no plants
        bulkCreateMockContext({ ...mockContext,
            plants: [],
            groups: [mockContext.groups[0]],
        });
        createMockContext('user_accounts_enabled', true);

        // Render App, confirm matches snapshot
        const component = render(<App />);
        expect(component).toMatchSnapshot();
    });

    it('matches snapshot when no models exist (setup)', () => {
        // Create mock state objects with no plants or groups
        bulkCreateMockContext({ ...mockContext,
            plants: [],
            groups: [],
            show_archive: false
        });
        createMockContext('user_accounts_enabled', true);

        // Render App, confirm matches snapshot
        const component = render(<App />);
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
        bulkCreateMockContext({ ...mockContext,
            plants: [{
                ...mockContext.plants[0],
                archived: true
            }],
            groups: [{
                ...mockContext.groups[0],
                archived: true
            }],
        });
        createMockContext('user_accounts_enabled', true);

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
        const component = render(<App />);
        expect(component).toMatchSnapshot();
    });
});

