import renderer from 'react-test-renderer';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from "@testing-library/user-event";
import { DateTime } from 'src/luxonMock';
import App from '../App';
import { ToastProvider } from 'src/ToastContext';

// Simulated django context, parsed into state object
const mockContext = {
    "plant": {
        "name": "Test Plant",
        "uuid": "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
        "species": "Calathea",
        "description": "This is a plant with a long description",
        "pot_size": 4,
        "last_watered": "2024-03-01T05:45:44+00:00",
        "last_fertilized": "2024-03-01T05:45:44+00:00",
        "display_name": "Test Plant",
        "events": {
            "water": [
                "2024-03-01T05:45:44+00:00",
                "2024-02-29T10:20:15+00:00",
            ],
            "fertilize": [
                "2024-03-01T05:45:44+00:00",
                "2024-02-26T02:44:12+00:00",
            ]
        },
        "tray": {
            "name": "Test tray",
            "uuid": "0640ec3b-1bed-4b15-a078-d6e7ec66be14"
        }
    },
    "trays": [
        {
            "name": "Test tray",
            "uuid": "0640ec3b-1bed-4b15-a078-d6e7ec66be14"
        },
        {
            "name": "Testing",
            "uuid": "0640ec3b-1bed-4b15-a078-d6e7ec66be61"
        }
    ],
    "species_options": [
        "Parlor Palm",
        "Spider Plant",
        "Calathea"
    ]
}

describe('App', () => {
    // Mock long-supported features that jsdom somehow hasn't implemented yet
    beforeAll(() => {
        HTMLDialogElement.prototype.show = jest.fn();
        HTMLDialogElement.prototype.showModal = jest.fn();
        HTMLDialogElement.prototype.close = jest.fn();
    });

    // Setup: Create mock state objects
    beforeEach(() => {
        const mockPlant = document.createElement('div');
        mockPlant.id = 'plant';
        mockPlant.textContent = JSON.stringify(mockContext.plant);
        document.body.appendChild(mockPlant);

        const mockTrays = document.createElement('div');
        mockTrays.id = 'trays';
        mockTrays.textContent = JSON.stringify(mockContext.trays);
        document.body.appendChild(mockTrays);

        const mockSpeciesOptions = document.createElement('div');
        mockSpeciesOptions.id = 'species_options';
        mockSpeciesOptions.textContent = JSON.stringify(mockContext.species_options);
        document.body.appendChild(mockSpeciesOptions);
    });

    it('matches snapshot', () => {
        // Mock system time so relative times ("1 hour ago") don't change
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2024-03-01T12:00:00Z'));

        const component = renderer.create(
            <ToastProvider>
                <App />
            </ToastProvider>
        );
        let tree = component.toJSON();
        expect(tree).toMatchSnapshot();

        // Reset mock
        jest.useRealTimers();
    });

    it('sends correct payload when edit modal is submitted', async () => {
        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                "name": "Test Plant",
                "species": "Calathea",
                "pot_size": "4",
                "description": "This is a plant with a long description",
                "display_name": "Test Plant"
            })
        }));

        const app = render(
            <ToastProvider>
                <App />
            </ToastProvider>
        );
        const user = userEvent.setup()

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
            headers: {
                'Accept': 'application/json, text/plain, */*',
                'Content-Type': 'application/json',
                'X-CSRFToken': null,
            }
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

        const app = render(
            <ToastProvider>
                <App />
            </ToastProvider>
        );
        const user = userEvent.setup()

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
            headers: {
                'Accept': 'application/json, text/plain, */*',
                'Content-Type': 'application/json',
                'X-CSRFToken': null,
            }
        });
    });

    it('sends correct payload when "Remove from tray" clicked', async () => {
        const app = render(
            <ToastProvider>
                <App />
            </ToastProvider>
        );
        const user = userEvent.setup()

        // Click "Remove from tray" dropdown option
        await user.click(app.getByText(/Remove from tray/));

        // Confirm correct data posted to /remove_plant_from_tray endpoint
        expect(global.fetch).toHaveBeenCalledWith('/remove_plant_from_tray', {
            method: 'POST',
            body: JSON.stringify({
                "plant_id": "0640ec3b-1bed-4b15-a078-d6e7ec66be12"
            }),
            headers: {
                'Accept': 'application/json, text/plain, */*',
                'Content-Type': 'application/json',
                'X-CSRFToken': null,
            }
        });
    });

    it('sends the correct payload when "Add to tray" modal submitted', async () => {
        const app = render(
            <ToastProvider>
                <App />
            </ToastProvider>
        );
        const user = userEvent.setup()

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
            headers: {
                'Accept': 'application/json, text/plain, */*',
                'Content-Type': 'application/json',
                'X-CSRFToken': null,
            }
        });
    });

    it('enters edit mode when event history edit button clicked', async () => {
        const app = render(
            <ToastProvider>
                <App />
            </ToastProvider>
        );
        const user = userEvent.setup()

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

    it('sends correct payload when RepotModal is submitted', async () => {
        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                "action": "repot",
                "plant": "0640ec3b-1bed-4b15-a078-d6e7ec66be12"
            })
        }));

        const app = render(
            <ToastProvider>
                <App />
            </ToastProvider>
        );
        const user = userEvent.setup()

        // Get reference to Repot Modal + submit button
        const repotModal = app.getByText("Repot time").parentElement.parentElement;
        const submit = repotModal.children[4];

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
            headers: {
                'Accept': 'application/json, text/plain, */*',
                'Content-Type': 'application/json',
                'X-CSRFToken': null,
            }
        });
    });
});
