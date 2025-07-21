import createMockContext from 'src/testUtils/createMockContext';
import bulkCreateMockContext from 'src/testUtils/bulkCreateMockContext';
import mockCurrentURL from 'src/testUtils/mockCurrentURL';

// Mock consistent UUID (prevent changing each time tests run)
jest.mock('uuid', () => ({
    v4: () => '557910e1-ac81-4c8c-94c3-8fc6309b9d40'
}));

import App from '../App';
import { mockContext } from './mockContext';

describe('App', () => {
    beforeAll(() => {
        // Mock page title (set by django template in prod)
        document.title = 'Plant Overview';
    });

    it('matches snapshot when plants and groups exist (desktop layout)', () => {
        // Create mock state objects with a single plant and group
        const plantUUID = Object.keys(mockContext.plants)[0];
        const groupUUID = Object.keys(mockContext.groups)[0];
        bulkCreateMockContext({ ...mockContext,
            plants: { plantUUID: mockContext.plants[plantUUID] },
            groups: { groupUUID: mockContext.groups[groupUUID] }
        });
        createMockContext('user_accounts_enabled', true);

        // Set width greater than tailwind md breakpoint
        window.innerWidth = 800;

        // Render App, confirm matches snapshot
        const { container } = render(<App />);
        expect(container).toMatchSnapshot();
    });

    it('matches snapshot when plants and groups exist (mobile layout)', () => {
        // Create mock state objects with a single plant and group
        const plantUUID = Object.keys(mockContext.plants)[0];
        const groupUUID = Object.keys(mockContext.groups)[0];
        bulkCreateMockContext({ ...mockContext,
            plants: { plantUUID: mockContext.plants[plantUUID] },
            groups: { groupUUID: mockContext.groups[groupUUID] }
        });
        createMockContext('user_accounts_enabled', true);

        // Set width less than tailwind md breakpoint
        window.innerWidth = 600;

        // Render App, confirm matches snapshot
        const { container } = render(<App />);
        expect(container).toMatchSnapshot();
    });

    it('matches snapshot when only plants exist', () => {
        // Create mock state objects with a single plant and no groups
        const plantUUID = Object.keys(mockContext.plants)[0];
        bulkCreateMockContext({ ...mockContext,
            plants: { plantUUID: mockContext.plants[plantUUID] },
            groups: {},
        });
        createMockContext('user_accounts_enabled', true);

        // Render App, confirm matches snapshot
        const { container } = render(<App />);
        expect(container).toMatchSnapshot();
    });

    it('matches snapshot when only groups exist', () => {
        // Create mock state objects with a single group and no plants
        const groupUUID = Object.keys(mockContext.groups)[0];
        bulkCreateMockContext({ ...mockContext,
            plants: {},
            groups: { groupUUID: mockContext.groups[groupUUID] }
        });
        createMockContext('user_accounts_enabled', true);

        // Render App, confirm matches snapshot
        const { container } = render(<App />);
        expect(container).toMatchSnapshot();
    });

    it('matches snapshot when no models exist (setup)', () => {
        // Create mock state objects with no plants or groups
        bulkCreateMockContext({ ...mockContext,
            plants: {},
            groups: {},
            show_archive: false
        });
        createMockContext('user_accounts_enabled', true);

        // Render App, confirm matches snapshot
        const { container } = render(<App />);
        expect(container).toMatchSnapshot();
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
        const plantUUID = Object.keys(mockContext.plants)[0];
        const groupUUID = Object.keys(mockContext.groups)[0];
        bulkCreateMockContext({ ...mockContext,
            plants: { plantUUID: {
                ...mockContext.plants[plantUUID],
                archived: true
            }},
            groups: { groupUUID: {
                ...mockContext.groups[groupUUID],
                archived: true
            }}
        });
        createMockContext('user_accounts_enabled', true);

        // Mock window.location to simulate archived overview
        mockCurrentURL('https://plants.lan/archived', '/archived');

        // Render App, confirm matches snapshot
        const { container } = render(<App />);
        expect(container).toMatchSnapshot();
    });
});

