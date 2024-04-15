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
        createMockContext('tray', mockContext.tray);
        createMockContext('details', mockContext.details);
        createMockContext('options', mockContext.options);

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
                "error": "failed to edit tray details"
            })
        }));

        // Confirm arbitrary error does not appear on page
        expect(app.queryByText(/failed to edit tray details/)).toBeNull();

        // Click submit button inside edit modal
        const modal = app.getByText("Edit Details").parentElement;
        await user.click(within(modal).getByText("Edit"));

        // Confirm modal appeared with arbitrary error text
        expect(app.queryByText(/failed to edit tray details/)).not.toBeNull();
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

    it('shows error modal if error received while adding plants to tray', async() => {
        // Mock fetch function to return arbitrary error
        global.fetch = jest.fn(() => Promise.resolve({
            ok: false,
            json: () => Promise.resolve({
                "error": "failed to add plants to tray"
            })
        }));

        // Confirm arbitrary error does not appear on page
        expect(app.queryByText(/failed to add plants to tray/)).toBeNull();

        // Simulate user selecting first plant in modal and clicking add
        const addPlantsModal = app.getByText("Add Plants").parentElement;
        await user.click(addPlantsModal.querySelectorAll('.radio')[0]);
        await user.click(addPlantsModal.querySelector('.btn-success'));

        // Confirm modal appeared with arbitrary error text
        expect(app.queryByText(/failed to add plants to tray/)).not.toBeNull();
    });

    it('shows error modal if error received while removing plants from tray', async() => {
        // Mock fetch function to return arbitrary error
        global.fetch = jest.fn(() => Promise.resolve({
            ok: false,
            json: () => Promise.resolve({
                "error": "failed to remove plants from tray"
            })
        }));

        // Confirm arbitrary error does not appear on page
        expect(app.queryByText(/failed to remove plants from tray/)).toBeNull();

        // Simulate user selecting first plant in modal and clicking remove
        const addPlantsModal = app.getByText("Remove Plants").parentElement;
        await user.click(addPlantsModal.querySelectorAll('.radio')[0]);
        await user.click(addPlantsModal.querySelector('.btn-error'));

        // Confirm modal appeared with arbitrary error text
        expect(app.queryByText(/failed to remove plants from tray/)).not.toBeNull();
    });
});
