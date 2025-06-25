import createMockContext from 'src/testUtils/createMockContext';
import bulkCreateMockContext from 'src/testUtils/bulkCreateMockContext';
import App from '../App';
import { PageWrapper } from 'src/index';
import { mockContext, mockGroupOptions } from './mockContext';

describe('App', () => {
    let app, user;

    beforeAll(() => {
        // Create mock state objects
        bulkCreateMockContext(mockContext);
        createMockContext('user_accounts_enabled', true);
    });

    beforeEach(() => {
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
                error: "failed to edit plant details"
            })
        }));

        // Confirm arbitrary error does not appear on page
        expect(app.queryByText(/failed to edit plant details/)).toBeNull();

        // Open edit modal
        await user.click(app.getByText("Edit"));

        // Click submit button inside edit modal
        const modal = app.getByText("Edit Details").closest(".modal-box");
        await user.click(within(modal).getByText("Edit"));

        // Confirm modal appeared with arbitrary error text
        expect(app.queryByText(/failed to edit plant details/)).not.toBeNull();
    });

    it('shows error modal if error received while creating event', async() => {
        // Mock fetch function to return arbitrary error
        global.fetch = jest.fn(() => Promise.resolve({
            ok: false,
            json: () => Promise.resolve({
                error: "failed to create event"
            })
        }));

        // Confirm arbitrary error does not appear on page
        expect(app.queryByText(/failed to create event/)).toBeNull();

        // Click water button
        await user.click(app.getByRole("button", {name: "Water"}));

        // Confirm modal appeared with arbitrary error text
        expect(app.queryByText(/failed to create event/)).not.toBeNull();
    });

    it('shows error modal if error received while removing from group', async() => {
        // Mock fetch function to return arbitrary error
        global.fetch = jest.fn(() => Promise.resolve({
            ok: false,
            json: () => Promise.resolve({
                error: "failed to remove plant from group"
            })
        }));

        // Confirm arbitrary error does not appear on page
        expect(app.queryByText(/failed to remove plant from group/)).toBeNull();

        // Click "Remove from group" button in details dropdown
        await user.click(app.getByTitle(/Remove plant from group/));

        // Confirm modal appeared with arbitrary error text
        expect(app.queryByText(/failed to remove plant from group/)).not.toBeNull();
    });

    it('shows error modal if error received while repotting plant', async() => {
        // Mock fetch function to return arbitrary error
        global.fetch = jest.fn(() => Promise.resolve({
            ok: false,
            json: () => Promise.resolve({
                error: "failed to repot plant"
            })
        }));

        // Confirm arbitrary error does not appear on page
        expect(app.queryByText(/failed to repot plant/)).toBeNull();

        // Simulate user submitting repot modal
        await user.click(app.getAllByText('Repot plant')[0]);
        await user.click(app.getByRole('button', {name: 'Repot'}));

        // Confirm modal appeared with arbitrary error text
        expect(app.queryByText(/failed to repot plant/)).not.toBeNull();
    });

    it('shows error modal if error received while dividing plant', async() => {
        // Mock fetch function to return arbitrary error
        global.fetch = jest.fn(() => Promise.resolve({
            ok: false,
            json: () => Promise.resolve({
                error: "Event with same timestamp already exists"
            })
        }));

        // Confirm arbitrary error does not appear on page
        expect(app.queryByText(/same timestamp already exists/)).toBeNull();

        // Simulate user submitting division modal
        await user.click(app.getByText(/Divide plant/));
        await user.click(app.getByRole('button', {name: 'OK'}));

        // Confirm modal appeared with arbitrary error text
        expect(app.queryByText(/same timestamp already exists/)).not.toBeNull();
    });

    it('shows error modal if error received while adding to group', async() => {
        // Mock "Remove from group" response (must remove before add button appears)
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({
                action: "remove_plant_from_group",
                plant: "0640ec3b-1bed-4b15-a078-d6e7ec66be12"
            })
        }));

        // Click "Remove from group" button in details dropdown
        await user.click(app.getByTitle(/Remove plant from group/));
        // Confirm "Add to group" button appeared in details dropdown
        const addButton = app.getByTitle("Add plant to group");
        expect(addButton).not.toBeNull();

        // Confirm arbitrary error does not appear on page
        expect(app.queryByText(/failed to add plant to group/)).toBeNull();

        // Mock fetch to return group options (requested when modal opened)
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ options: mockGroupOptions })
        }));

        // Open AddToGroupModal
        await user.click(addButton);

        // Mock fetch function to return arbitrary error
        global.fetch = jest.fn(() => Promise.resolve({
            ok: false,
            json: () => Promise.resolve({
                error: "failed to add plant to group"
            })
        }));

        // Simulate user clicking group option (nextSibling targets transparent
        // absolute-positioned div with click listener that covers group card)
        await user.click(app.getByLabelText('Go to Test group page').nextSibling);

        // Confirm modal appeared with arbitrary error text
        expect(app.queryByText(/failed to add plant to group/)).not.toBeNull();
    });
});
