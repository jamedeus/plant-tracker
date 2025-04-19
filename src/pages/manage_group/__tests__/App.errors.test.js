import createMockContext from 'src/testUtils/createMockContext';
import App from '../App';
import { PageWrapper } from 'src/index';
import { mockContext } from './mockContext';

describe('App', () => {
    let app, user;

    beforeAll(() => {
        // Create mock state objects
        createMockContext('group', mockContext.group);
        createMockContext('details', mockContext.details);
        createMockContext('options', mockContext.options);
        createMockContext('user_accounts_enabled', true);
    });

    beforeEach(() => {
        // Clear sessionStorage (cached sortDirection, sortKey)
        sessionStorage.clear();
        // Render app + create userEvent instance to use in tests
        user = userEvent.setup();
        app = render(
            <PageWrapper>
                <App />
            </PageWrapper>
        );
    });

    it('shows error modal if error received while editing details', async() => {
        // Mock fetch function to return arbitrary error
        global.fetch = jest.fn(() => Promise.resolve({
            ok: false,
            json: () => Promise.resolve({
                "error": "failed to edit group details"
            })
        }));

        // Confirm arbitrary error does not appear on page
        expect(app.queryByText(/failed to edit group details/)).toBeNull();

        // Open edit modal
        await user.click(app.getByText("Edit"));

        // Click submit button inside edit modal
        const modal = app.getByText("Edit Details").parentElement;
        await user.click(within(modal).getByText("Edit"));

        // Confirm modal appeared with arbitrary error text
        expect(app.queryByText(/failed to edit group details/)).not.toBeNull();
    });

    it('shows error modal if error received while bulk add events', async() => {
        // Mock fetch function to return arbitrary error
        global.fetch = jest.fn(() => Promise.resolve({
            ok: false,
            json: () => Promise.resolve({
                "error": "failed to bulk add events"
            })
        }));

        // Confirm arbitrary error does not appear on page
        expect(app.queryByText(/failed to bulk add events/)).toBeNull();

        // Click Water All button
        await user.click(app.getByText("Water All"));

        // Confirm modal appeared with arbitrary error text
        expect(app.queryByText(/failed to bulk add events/)).not.toBeNull();
    });

    it('shows error modal if error received while adding plants to group', async() => {
        // Mock fetch function to return arbitrary error
        global.fetch = jest.fn(() => Promise.resolve({
            ok: false,
            json: () => Promise.resolve({
                "error": "failed to add plants to group"
            })
        }));

        // Confirm arbitrary error does not appear on page
        expect(app.queryByText(/failed to add plants to group/)).toBeNull();

        // Open AddPlantsModal modal
        await user.click(app.getByText("Add plants"));

        // Simulate user selecting first plant in modal and clicking add
        const addPlantsModal = app.getByText("Add Plants").parentElement;
        await user.click(addPlantsModal.querySelectorAll('label.cursor-pointer')[0]);
        await user.click(addPlantsModal.querySelector('.btn-success'));

        // Confirm modal appeared with arbitrary error text
        expect(app.queryByText(/failed to add plants to group/)).not.toBeNull();
    });

    it('shows error modal if error received while removing plants from group', async() => {
        // Mock fetch function to return arbitrary error
        global.fetch = jest.fn(() => Promise.resolve({
            ok: false,
            json: () => Promise.resolve({
                "error": "failed to remove plants from group"
            })
        }));

        // Confirm arbitrary error does not appear on page
        expect(app.queryByText(/failed to remove plants from group/)).toBeNull();

        // Open RemovePlantsModal modal
        await user.click(app.getByText("Remove plants"));

        // Simulate user selecting first plant in modal and clicking remove
        const addPlantsModal = app.getByText("Remove Plants").parentElement;
        await user.click(addPlantsModal.querySelectorAll('label.cursor-pointer')[0]);
        await user.click(addPlantsModal.querySelector('.btn-error'));

        // Confirm modal appeared with arbitrary error text
        expect(app.queryByText(/failed to remove plants from group/)).not.toBeNull();
    });
});
