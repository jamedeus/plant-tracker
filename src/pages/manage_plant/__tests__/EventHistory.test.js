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

    it('enters edit mode when event history edit button clicked', async () => {
        // Get reference to Water History div, open collapse
        const eventHistory = app.getByText("Event History").parentElement;
        await user.click(eventHistory.children[0]);

        // Confirm edit button is rendered, delete and cancel buttons are not
        expect(within(eventHistory).getByText('Edit').nodeName).toBe('BUTTON');
        expect(within(eventHistory).queryByText('Delete')).toBeNull();
        expect(within(eventHistory).queryByText('Cancel')).toBeNull();

        // Click edit button
        await user.click(within(eventHistory).getByText('Edit'));

        // Edit button should disappear, delete and cancel buttons should appear
        expect(within(eventHistory).queryByText('Edit')).toBeNull();
        expect(within(eventHistory).getByText('Delete').nodeName).toBe('BUTTON');
        expect(within(eventHistory).getByText('Cancel').nodeName).toBe('BUTTON');

        // Click cancel button, confirm buttons reset
        await user.click(within(eventHistory).getByText('Cancel'));
        expect(within(eventHistory).getByText('Edit').nodeName).toBe('BUTTON');
        expect(within(eventHistory).queryByText('Delete')).toBeNull();
        expect(within(eventHistory).queryByText('Cancel')).toBeNull();
    });

    it('sends correct payload when water event is deleted', async () => {
        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                "deleted": "water",
                "plant": "0640ec3b-1bed-4b15-a078-d6e7ec66be12"
            })
        }));

        // Get reference to Water History div, open collapse
        const eventHistory = app.getByText("Event History").parentElement;
        await user.click(eventHistory.children[0]);

        // Click edit button
        await user.click(within(eventHistory).getByText('Edit'));

        // Click first checkbox to select event
        user.click(app.container.querySelectorAll('.radio')[0]);

        // Click delete button, confirm buttons reset
        await user.click(within(eventHistory).getByText('Delete'));
        expect(within(eventHistory).getByText('Edit').nodeName).toBe('BUTTON');
        expect(within(eventHistory).queryByText('Delete')).toBeNull();
        expect(within(eventHistory).queryByText('Cancel')).toBeNull();

        // Confirm correct data posted to /delete_plant_event endpoint
        expect(global.fetch).toHaveBeenCalledWith('/delete_plant_event', {
            method: 'POST',
            body: JSON.stringify({
                "plant_id": "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
                "event_type": "water",
                "timestamp": "2024-03-01T15:45:44+00:00"
            }),
            headers: postHeaders
        });
    });

    it('shows the correct history column when event type selected', async () => {
        // Confirm water event date is visible, fertilize event date is not
        expect(app.queryByText(/February 29/)).not.toBeNull();
        expect(app.queryByText(/February 26/)).toBeNull();

        // Click fertilize button
        await user.click(app.getByRole("tab", {name: "Fertilize"}));

        // Confirm fertilize event date is visible, water event date is not
        expect(app.queryByText(/February 26/)).not.toBeNull();
        expect(app.queryByText(/February 29/)).toBeNull();

        // Click prune button
        await user.click(app.getByRole("tab", {name: "Prune"}));

        // Confirm neither date is visible (no prune events in mock context)
        expect(app.queryByText(/February 26/)).toBeNull();
        expect(app.queryByText(/February 29/)).toBeNull();
    });
});
