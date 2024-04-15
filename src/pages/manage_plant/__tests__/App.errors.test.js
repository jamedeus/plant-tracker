import { render, within } from '@testing-library/react';
import userEvent from "@testing-library/user-event";
import createMockContext from 'src/testUtils/createMockContext';
import { postHeaders } from 'src/testUtils/headers';
import App from '../App';
import { ToastProvider } from 'src/context/ToastContext';
import { ThemeProvider } from 'src/context/ThemeContext';
import { ErrorModalProvider } from 'src/context/ErrorModalContext';
import { mockContext } from './mockContext';

describe('App', () => {
    let app, user;

    beforeEach(() => {
        // Create mock state objects
        createMockContext('plant', mockContext.plant);
        createMockContext('trays', mockContext.trays);
        createMockContext('species_options', mockContext.species_options);
        createMockContext('photo_urls', mockContext.photo_urls);

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

    it('shows error modal if error received while deleting event', async() => {
        // Mock fetch function to return arbitrary error
        global.fetch = jest.fn(() => Promise.resolve({
            ok: false,
            json: () => Promise.resolve({
                "error": "failed to delete event"
            })
        }));

        // Confirm arbitrary error does not appear on page
        expect(app.queryByText(/failed to delete event/)).toBeNull();

        // Simulate user deleting first event in water history
        const eventHistory = app.getByText("Event History").parentElement;
        await user.click(eventHistory.children[0]);
        await user.click(within(eventHistory).getByText('Edit'));
        user.click(app.container.querySelectorAll('.radio')[0]);
        await user.click(within(eventHistory).getByText('Delete'));

        // Confirm modal appeared with arbitrary error text
        expect(app.queryByText(/failed to delete event/)).not.toBeNull();
    });

    it('shows error modal if error received while removing from tray', async() => {
        // Mock fetch function to return arbitrary error
        global.fetch = jest.fn(() => Promise.resolve({
            ok: false,
            json: () => Promise.resolve({
                "error": "failed to remove plant from tray"
            })
        }));

        // Confirm arbitrary error does not appear on page
        expect(app.queryByText(/failed to remove plant from tray/)).toBeNull();

        // Click "Remove from tray" dropdown option
        await user.click(app.getByText(/Remove from tray/));

        // Confirm modal appeared with arbitrary error text
        expect(app.queryByText(/failed to remove plant from tray/)).not.toBeNull();
    });

    it('shows error modal if error received while deleting photos', async() => {
        // Mock fetch function to return arbitrary error
        global.fetch = jest.fn(() => Promise.resolve({
            ok: false,
            json: () => Promise.resolve({
                "error": "failed to delete photos"
            })
        }));

        // Confirm arbitrary error does not appear on page
        expect(app.queryByText(/failed to delete photos/)).toBeNull();

        // Simulate user deleting first photo in history
        const photoHistory = app.getByText("Photos").parentElement;
        await user.click(photoHistory.children[0]);
        await user.click(within(photoHistory).getByText('Edit'));
        user.click(app.container.querySelectorAll('.radio')[0]);
        await user.click(within(photoHistory).getByText('Delete'));

        // Confirm modal appeared with arbitrary error text
        expect(app.queryByText(/failed to delete photos/)).not.toBeNull();
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

    it('shows error modal if error received while adding to tray', async() => {
        // Mock fetch function to return arbitrary error
        global.fetch = jest.fn(() => Promise.resolve({
            ok: false,
            json: () => Promise.resolve({
                "error": "failed to add plant to tray"
            })
        }));

        // Confirm arbitrary error does not appear on page
        expect(app.queryByText(/failed to add plant to tray/)).toBeNull();

        // Simulate user selecting tray and clicking submit
        const addToTrayModal = app.getByText("Add plant to tray").parentElement;
        await user.selectOptions(addToTrayModal.children[2], "Test tray");
        await user.click(within(addToTrayModal).getByText("Confirm"));

        // Confirm modal appeared with arbitrary error text
        expect(app.queryByText(/failed to add plant to tray/)).not.toBeNull();
    });
});
