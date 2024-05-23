import createMockContext from 'src/testUtils/createMockContext';
import App from '../App';
import { ToastProvider } from 'src/context/ToastContext';
import { ThemeProvider } from 'src/context/ThemeContext';
import { ErrorModalProvider } from 'src/context/ErrorModalContext';
import { mockContext } from './mockContext';

describe('App', () => {
    let app, user;

    beforeAll(() => {
        // Create mock state objects
        createMockContext('plant', mockContext.plant);
        createMockContext('notes', mockContext.notes);
        createMockContext('groups', mockContext.groups);
        createMockContext('species_options', mockContext.species_options);
        createMockContext('photo_urls', mockContext.photo_urls);
    });

    beforeEach(() => {
        // Render app + create userEvent instance to use in tests
        app = render(
            <ThemeProvider>
                <ToastProvider>
                    <ErrorModalProvider>
                        <App />
                    </ErrorModalProvider>
                </ToastProvider>
            </ThemeProvider>
        );
        user = userEvent.setup();
    });

    it('shows error modal if error received while editing details', async() => {
        // Mock fetch function to return arbitrary error
        global.fetch = jest.fn(() => Promise.resolve({
            ok: false,
            json: () => Promise.resolve({
                "error": "failed to edit plant details"
            })
        }));

        // Confirm arbitrary error does not appear on page
        expect(app.queryByText(/failed to edit plant details/)).toBeNull();

        // Click submit button inside edit modal
        const modal = app.getByText("Edit Details").parentElement;
        await user.click(within(modal).getByText("Edit"));

        // Confirm modal appeared with arbitrary error text
        expect(app.queryByText(/failed to edit plant details/)).not.toBeNull();
    });

    it('shows error modal if error received while creating event', async() => {
        // Mock fetch function to return arbitrary error
        global.fetch = jest.fn(() => Promise.resolve({
            ok: false,
            json: () => Promise.resolve({
                "error": "failed to create event"
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
                "error": "failed to remove plant from group"
            })
        }));

        // Confirm arbitrary error does not appear on page
        expect(app.queryByText(/failed to remove plant from group/)).toBeNull();

        // Click "Remove from group" dropdown option
        await user.click(app.getByText(/Remove from group/));

        // Confirm modal appeared with arbitrary error text
        expect(app.queryByText(/failed to remove plant from group/)).not.toBeNull();
    });

    it('shows error modal if error received while repotting plant', async() => {
        // Mock fetch function to return arbitrary error
        global.fetch = jest.fn(() => Promise.resolve({
            ok: false,
            json: () => Promise.resolve({
                "error": "failed to repot plant"
            })
        }));

        // Confirm arbitrary error does not appear on page
        expect(app.queryByText(/failed to repot plant/)).toBeNull();

        // Simulate user submitting repot modal
        const repotModal = app.getAllByText(/Repot plant/)[1].parentElement;
        const submit = repotModal.querySelector('.btn-success');
        await user.click(submit);

        // Confirm modal appeared with arbitrary error text
        expect(app.queryByText(/failed to repot plant/)).not.toBeNull();
    });

    it('shows error modal if error received while adding to group', async() => {
        // Mock fetch function to return arbitrary error
        global.fetch = jest.fn(() => Promise.resolve({
            ok: false,
            json: () => Promise.resolve({
                "error": "failed to add plant to group"
            })
        }));

        // Confirm arbitrary error does not appear on page
        expect(app.queryByText(/failed to add plant to group/)).toBeNull();

        // Simulate user selecting group
        const addToGroupModal = app.getByText("Add plant to group").parentElement;
        await user.click(within(addToGroupModal).getByText("Test group"));

        // Confirm modal appeared with arbitrary error text
        expect(app.queryByText(/failed to add plant to group/)).not.toBeNull();
    });
});
