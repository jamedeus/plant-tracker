import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from "@testing-library/user-event";
import { DateTime } from 'src/testUtils/luxonMock';
import createMockContext from 'src/testUtils/createMockContext';
import { postHeaders } from 'src/testUtils/headers';
import App from '../App';
import { ToastProvider } from 'src/ToastContext';
import { mockContext } from './mockContext';

describe('App', () => {
    let app, user;

    beforeEach(() => {
        // Create mock state objects
        createMockContext('plant', mockContext.plant);
        createMockContext('trays', mockContext.trays);
        createMockContext('species_options', mockContext.species_options);

        // Render app + create userEvent instance to use in tests
        app = render(
            <ToastProvider>
                <App />
            </ToastProvider>
        );
        user = userEvent.setup();
    });

    it('sends correct payload when edit modal is submitted', async () => {
        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                "name": "Test Plant",
                "species": "Calathea",
                "pot_size": 4,
                "description": "This is a plant with a long description",
                "display_name": "Test Plant"
            })
        }));

        // Click submit button inside edit modal
        const modal = app.getByText("Edit Details").parentElement;
        await user.click(within(modal).getByText("Edit"));

        // Confirm correct data posted to /edit_plant endpoint
        expect(global.fetch).toHaveBeenCalledWith('/edit_plant', {
            method: 'POST',
            body: JSON.stringify({
                "name": "Test Plant",
                "species": "Calathea",
                "pot_size": "4",
                "description": "This is a plant with a long description",
                "plant_id": "0640ec3b-1bed-4b15-a078-d6e7ec66be12"
            }),
            headers: postHeaders
        });
    });

    it('sends correct payload when plant is watered', async () => {
        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                "action": "water",
                "plant": "0640ec3b-1bed-4b15-a078-d6e7ec66be12"
            })
        }));

        // Click water button
        await user.click(app.getByText("Water"));

        // Confirm correct data posted to /add_plant_event endpoint
        expect(global.fetch).toHaveBeenCalledWith('/add_plant_event', {
            method: 'POST',
            body: JSON.stringify({
                "plant_id": "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
                "event_type": "water",
                "timestamp": "2024-03-01T20:00:00.000Z"
            }),
            headers: postHeaders
        });
    });

    it('sends correct payload when plant is fertilized', async () => {
        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                "action": "fertilize",
                "plant": "0640ec3b-1bed-4b15-a078-d6e7ec66be12"
            })
        }));

        // Click fertilize button
        await user.click(app.getByText("Fertilize"));

        // Confirm correct data posted to /add_plant_event endpoint
        expect(global.fetch).toHaveBeenCalledWith('/add_plant_event', {
            method: 'POST',
            body: JSON.stringify({
                "plant_id": "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
                "event_type": "fertilize",
                "timestamp": "2024-03-01T20:00:00.000Z"
            }),
            headers: postHeaders
        });
    });

    it('shows error toast after failing to create event', async() => {
        // Mock fetch function to return error response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: false,
            status: 409,
            json: () => Promise.resolve({
                "error": "event with same timestamp already exists"
            })
        }));

        // Click water button
        await user.click(app.getByText("Water"));
    });

    it('sends correct payload when "Remove from tray" clicked', async () => {
        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({
                "action": "remove_plant_from_tray",
                "plant": "0640ec3b-1bed-4b15-a078-d6e7ec66be12"
            })
        }));

        // Click "Remove from tray" dropdown option
        await user.click(app.getByText(/Remove from tray/));

        // Confirm correct data posted to /remove_plant_from_tray endpoint
        expect(global.fetch).toHaveBeenCalledWith('/remove_plant_from_tray', {
            method: 'POST',
            body: JSON.stringify({
                "plant_id": "0640ec3b-1bed-4b15-a078-d6e7ec66be12"
            }),
            headers: postHeaders
        });
    });

    it('sends the correct payload when "Add to tray" modal submitted', async () => {
        // Click remove from tray (re-renders with add to tray option)
        await user.click(app.getByText(/Remove from tray/));

        // Click "Add to tray" dropdown option (open modal)
        await user.click(app.getByText(/Add to tray/));

        // Get reference to AddToTrayModal
        const addToTrayModal = app.getByText("Add plant to tray").parentElement;

        // Select tray option, click confirm
        await user.selectOptions(addToTrayModal.children[2], "Test tray");
        await user.click(within(addToTrayModal).getByText("Confirm"));

        // Confirm correct data posted to /add_plant_to_tray endpoint
        expect(global.fetch).toHaveBeenCalledWith('/add_plant_to_tray', {
            method: 'POST',
            body: JSON.stringify({
                "plant_id": "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
                "tray_id": "0640ec3b-1bed-4b15-a078-d6e7ec66be14"
            }),
            headers: postHeaders
        });
    });

    it('enters edit mode when event history edit button clicked', async () => {
        // Get reference to Water History div, open collapse
        const waterHistory = app.getByText("Water History").parentElement;
        await user.click(waterHistory.children[0]);

        // Confirm edit button is rendered, delete and cancel buttons are not
        expect(within(waterHistory).getByText('Edit').nodeName).toBe('BUTTON');
        expect(within(waterHistory).queryByText('Delete')).toBeNull();
        expect(within(waterHistory).queryByText('Cancel')).toBeNull();

        // Click edit button
        await user.click(within(waterHistory).getByText('Edit'));

        // Edit button should disappear, delete and cancel buttons should appear
        expect(within(waterHistory).queryByText('Edit')).toBeNull();
        expect(within(waterHistory).getByText('Delete').nodeName).toBe('BUTTON');
        expect(within(waterHistory).getByText('Cancel').nodeName).toBe('BUTTON');

        // Click cancel button, confirm buttons reset
        await user.click(within(waterHistory).getByText('Cancel'));
        expect(within(waterHistory).getByText('Edit').nodeName).toBe('BUTTON');
        expect(within(waterHistory).queryByText('Delete')).toBeNull();
        expect(within(waterHistory).queryByText('Cancel')).toBeNull();
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
        const waterHistory = app.getByText("Water History").parentElement;
        await user.click(waterHistory.children[0]);

        // Click edit button
        await user.click(within(waterHistory).getByText('Edit'));

        // Click first checkbox to select event
        user.click(app.container.querySelectorAll('.radio')[0]);

        // Click delete buttonm confirm buttons reset
        await user.click(within(waterHistory).getByText('Delete'));
        expect(within(waterHistory).getByText('Edit').nodeName).toBe('BUTTON');
        expect(within(waterHistory).queryByText('Delete')).toBeNull();
        expect(within(waterHistory).queryByText('Cancel')).toBeNull();

        // Confirm correct data posted to /delete_plant_event endpoint
        expect(global.fetch).toHaveBeenCalledWith('/delete_plant_event', {
            method: 'POST',
            body: JSON.stringify({
                "plant_id": "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
                "event_type": "water",
                "timestamp": "2024-03-01T05:45:44+00:00"
            }),
            headers: postHeaders
        });
    });

    it('sends correct payload when RepotModal is submitted', async () => {
        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                "action": "repot",
                "plant": "0640ec3b-1bed-4b15-a078-d6e7ec66be12"
            })
        }));

        // Click "Repot plant" dropdown option (open modal)
        await user.click(app.getAllByText(/Repot plant/)[0]);

        // Get reference to Repot Modal + submit button
        const repotModal = app.getAllByText(/Repot plant/)[1].parentElement;
        const submit = repotModal.querySelector('.btn-success');

        // Click submit button
        await user.click(submit);

        // Confirm correct data posted to /repot_plant endpoint
        expect(global.fetch).toHaveBeenCalledWith('/repot_plant', {
            method: 'POST',
            body: JSON.stringify({
                "plant_id": "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
                "new_pot_size": 6,
                "timestamp": "2024-03-01T12:00"
            }),
            headers: postHeaders
        });
    });

    it('detects when custom pot size is selected in RepotModal', async () => {
        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                "action": "repot",
                "plant": "0640ec3b-1bed-4b15-a078-d6e7ec66be12"
            })
        }));

        // Click "Repot plant" dropdown option (open modal)
        await user.click(app.getAllByText(/Repot plant/)[0]);

        // Get reference to Repot Modal + submit button
        const repotModal = app.getAllByText(/Repot plant/)[1].parentElement;
        const submit = repotModal.querySelector('.btn-success');

        // Click custom pot size option, enter "5"
        const customPotSize = repotModal.querySelector('.pot-size.w-32');
        await user.click(customPotSize);
        await userEvent.type(customPotSize, '5');

        // Click submit button
        await user.click(submit);

        // Confirm payload includes custom pot size
        expect(global.fetch).toHaveBeenCalledWith('/repot_plant', {
            method: 'POST',
            body: JSON.stringify({
                "plant_id": "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
                "new_pot_size": 5,
                "timestamp": "2024-03-01T12:00"
            }),
            headers: postHeaders
        });
    });

    it('redirects to overview when dropdown option is clicked', async () => {
        Object.defineProperty(window, 'location', {
            value: {
                assign: jest.fn(),
            },
        });

        // Click overview dropdown option, confirm redirected
        await user.click(app.getByText('Overview'));
        expect(window.location.href).toBe('/');
        jest.resetAllMocks();
    });
});
