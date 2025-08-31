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
        // Simulate SINGLE_USER_MODE disabled on backend
        globalThis.USER_ACCOUNTS_ENABLED = true;
    });

    it('matches snapshot when plants and groups exist (desktop layout)', () => {
        // Set width greater than tailwind md breakpoint
        window.innerWidth = 800;

        // Render App with a single plant and group, confirm matches snapshot
        const plantUUID = Object.keys(mockContext.plants)[0];
        const groupUUID = Object.keys(mockContext.groups)[0];
        const { container } = render(
            <App initialState={{
                ...mockContext,
                plants: { plantUUID: mockContext.plants[plantUUID] },
                groups: { groupUUID: mockContext.groups[groupUUID] },
            }} />
        );
        expect(container).toMatchSnapshot();
    });

    it('matches snapshot when plants and groups exist (mobile layout)', () => {
        // Set width less than tailwind md breakpoint
        window.innerWidth = 600;

        // Render App with a single plant and group, confirm matches snapshot
        const plantUUID = Object.keys(mockContext.plants)[0];
        const groupUUID = Object.keys(mockContext.groups)[0];
        const { container } = render(
            <App initialState={{
                ...mockContext,
                plants: { plantUUID: mockContext.plants[plantUUID] },
                groups: { groupUUID: mockContext.groups[groupUUID] },
            }} />
        );
        expect(container).toMatchSnapshot();
    });

    it('matches snapshot when only plants exist', () => {
        // Render App with a single plant, confirm matches snapshot
        const plantUUID = Object.keys(mockContext.plants)[0];
        const { container } = render(
            <App initialState={{
                ...mockContext,
                plants: { plantUUID: mockContext.plants[plantUUID] },
                groups: {},
            }} />
        );
        expect(container).toMatchSnapshot();
    });

    it('matches snapshot when only groups exist', () => {
        // Render App with a single plant, confirm matches snapshot
        const groupUUID = Object.keys(mockContext.groups)[0];
        const { container } = render(
            <App initialState={{
                ...mockContext,
                plants: {},
                groups: { groupUUID: mockContext.groups[groupUUID] },
            }} />
        );
        expect(container).toMatchSnapshot();
    });

    it('matches snapshot when no models exist (setup)', () => {
        // Render App, confirm matches snapshot
        const { container } = render(
            <App initialState={{
                plants: {},
                groups: {},
                show_archive: false,
                title: "Plant Overview"
            }} />
        );
        expect(container).toMatchSnapshot();
    });
});

describe('App (archived page)', () => {
    beforeAll(() => {
        // Mock page title (set by django template in prod)
        document.title = 'Archived';
        // Simulate SINGLE_USER_MODE disabled on backend
        globalThis.USER_ACCOUNTS_ENABLED = true;
    });

    it('matches snapshot when plants and groups exist', () => {
        // Mock window.location to simulate archived overview
        mockCurrentURL('https://plants.lan/archived');

        // Render App with a single plant and group, confirm matches snapshot
        const plantUUID = Object.keys(mockContext.plants)[0];
        const groupUUID = Object.keys(mockContext.groups)[0];
        const { container } = render(
            <App initialState={{
                ...mockContext,
                plants: { plantUUID: { ...mockContext.plants[plantUUID], archived: true } },
                groups: { groupUUID: { ...mockContext.groups[groupUUID], archived: true } },
                title: "Archived"
            }} />
        );
        expect(container).toMatchSnapshot();
    });
});

