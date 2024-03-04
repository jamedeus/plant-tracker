import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from "@testing-library/user-event";
import { DateTime } from 'src/testUtils/luxonMock';
import createMockContext from 'src/testUtils/createMockContext';
import App from '../App';
import { ToastProvider } from 'src/ToastContext';
import { mockContext } from './mockContext';

describe('App', () => {
    let app, user;

    // Mock long-supported features that jsdom somehow hasn't implemented yet
    beforeAll(() => {
        HTMLDialogElement.prototype.show = jest.fn();
        HTMLDialogElement.prototype.showModal = jest.fn();
        HTMLDialogElement.prototype.close = jest.fn();
    });

    beforeEach(() => {
        // Create mock state objects
        createMockContext('tray', mockContext.tray);
        createMockContext('details', mockContext.details);
        createMockContext('options', mockContext.options);

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
                "name": "Test tray",
                "location": "Middle shelf",
                "description": "",
                "display_name": "Test tray"
            })
        }));

        // Click submit button inside edit modal
        const modal = app.getByText("Edit Details").parentElement;
        await user.click(within(modal).getByText("Edit"));

        // Confirm correct data posted to /edit_plant endpoint
        expect(global.fetch).toHaveBeenCalledWith('/edit_tray', {
            method: 'POST',
            body: JSON.stringify({
                "name": "Test tray",
                "location": "Middle shelf",
                "description": "",
                "tray_id": "0640ec3b-1bed-4b15-a078-d6e7ec66be14"
            }),
            headers: {
                'Accept': 'application/json, text/plain, */*',
                'Content-Type': 'application/json',
                'X-CSRFToken': null,
            }
        });
    });

    it('sends correct payload when Water All button clicked', async () => {
        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                "action": "water",
                "plants": [
                    "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
                    "19f65fa0-1c75-4cba-b590-0c9b5b315fcc"
                ],
                "failed": []
            })
        }));

        // Click Water All button
        await user.click(app.getByText("Water All"));

        // Confirm correct data posted to /bulk_add_plant_events endpoint
        // Should contain UUIDs of both plants in tray
        expect(global.fetch).toHaveBeenCalledWith('/bulk_add_plant_events', {
            method: 'POST',
            body: JSON.stringify({
                "plants": [
                    "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
                    "19f65fa0-1c75-4cba-b590-0c9b5b315fcc"
                ],
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

    it('sends correct payload when Fertilize All button clicked', async () => {
        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                "action": "fertilize",
                "plants": [
                    "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
                    "19f65fa0-1c75-4cba-b590-0c9b5b315fcc"
                ],
                "failed": []
            })
        }));

        // Click Fertilize All button
        await user.click(app.getByText("Fertilize All"));

        // Confirm correct data posted to /bulk_add_plant_events endpoint
        // Should contain UUIDs of both plants in tray
        expect(global.fetch).toHaveBeenCalledWith('/bulk_add_plant_events', {
            method: 'POST',
            body: JSON.stringify({
                "plants": [
                    "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
                    "19f65fa0-1c75-4cba-b590-0c9b5b315fcc"
                ],
                "event_type": "fertilize",
                "timestamp": "2024-03-01T20:00:00.000Z"
            }),
            headers: {
                'Accept': 'application/json, text/plain, */*',
                'Content-Type': 'application/json',
                'X-CSRFToken': null,
            }
        });
    });

    it('sends correct payload when only 1 plant is watered', async () => {
        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                "action": "water",
                "plants": [
                    "0640ec3b-1bed-4b15-a078-d6e7ec66be12"
                ],
                "failed": []
            })
        }));

        // Get reference to plants column
        const plantsCol = app.getByText("Plants (2)").parentElement;

        // Click Manage button under plants, select first plant, click water
        await user.click(within(plantsCol).getByText("Manage"));
        await user.click(plantsCol.children[2].children[1].children[0]);
        await user.click(within(plantsCol).getByText("Water"));

        // Confirm correct data posted to /bulk_add_plant_events endpoint
        // Should only contain UUID of first plant
        expect(global.fetch).toHaveBeenCalledWith('/bulk_add_plant_events', {
            method: 'POST',
            body: JSON.stringify({
                "plants": [
                    "0640ec3b-1bed-4b15-a078-d6e7ec66be12"
                ],
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

    it('sends correct payload when only 1 plant is fertilized', async () => {
        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                "action": "fertilize",
                "plants": [
                    "19f65fa0-1c75-4cba-b590-0c9b5b315fcc"
                ],
                "failed": []
            })
        }));

        // Get reference to plants column
        const plantsCol = app.getByText("Plants (2)").parentElement;

        // Click Manage button under plants, select second plant, click fertilize
        await user.click(within(plantsCol).getByText("Manage"));
        await user.click(plantsCol.children[2].children[2].children[0]);
        await user.click(within(plantsCol).getByText("Fertilize"));

        // Confirm correct data posted to /bulk_add_plant_events endpoint
        // Should only contain UUID of first plant
        expect(global.fetch).toHaveBeenCalledWith('/bulk_add_plant_events', {
            method: 'POST',
            body: JSON.stringify({
                "plants": [
                    "19f65fa0-1c75-4cba-b590-0c9b5b315fcc"
                ],
                "event_type": "fertilize",
                "timestamp": "2024-03-01T20:00:00.000Z"
            }),
            headers: {
                'Accept': 'application/json, text/plain, */*',
                'Content-Type': 'application/json',
                'X-CSRFToken': null,
            }
        });
    });

    it('sends correct payload when Add Plants modal is submitted', async () => {
        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                "added": [
                    "0640ec3b-1bed-4b15-a078-d6e7ec66be16"
                ],
                "failed": []
            })
        }));

        // Click Add plants dropdown option
        await user.click(app.getByText("Add plants"));

        // Get reference to modal, confirm contains 5 items
        // (close button, title, 2 plant options, submit buttons)
        const addPlantsModal = app.getByText("Add Plants").parentElement;
        expect(addPlantsModal.children.length).toBe(5);

        // Select the first plant option, click submit
        await user.click(addPlantsModal.children[2].children[0]);
        await user.click(addPlantsModal.children[4].children[0].children[1]);

        // Confirm correct data posted to /bulk_add_plants_to_tray endpoint
        // Should only contain UUID of first plant
        expect(global.fetch).toHaveBeenCalledWith('/bulk_add_plants_to_tray', {
            method: 'POST',
            body: JSON.stringify({
                "tray_id": "0640ec3b-1bed-4b15-a078-d6e7ec66be14",
                "plants": [
                    "0640ec3b-1bed-4b15-a078-d6e7ec66be16"
                ]
            }),
            headers: {
                'Accept': 'application/json, text/plain, */*',
                'Content-Type': 'application/json',
                'X-CSRFToken': null,
            }
        });
    });

    it('sends correct payload when Remove Plants modal is submitted', async () => {
        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                "removed": [
                    "0640ec3b-1bed-4b15-a078-d6e7ec66be12"
                ],
                "failed": []
            })
        }));

        // Click Remove plants dropdown option
        await user.click(app.getByText("Remove plants"));

        // Get reference to modal, confirm contains 5 items
        // (close button, title, 2 plant options, submit buttons)
        const addPlantsModal = app.getByText("Remove Plants").parentElement;
        expect(addPlantsModal.children.length).toBe(5);

        // Select the first plant option, click submit
        await user.click(addPlantsModal.children[2].children[0]);
        await user.click(addPlantsModal.children[4].children[0].children[1]);

        // Confirm correct data posted to /bulk_remove_plants_from_tray endpoint
        // Should only contain UUID of first plant
        expect(global.fetch).toHaveBeenCalledWith('/bulk_remove_plants_from_tray', {
            method: 'POST',
            body: JSON.stringify({
                "tray_id": "0640ec3b-1bed-4b15-a078-d6e7ec66be14",
                "plants": [
                    "0640ec3b-1bed-4b15-a078-d6e7ec66be12"
                ]
            }),
            headers: {
                'Accept': 'application/json, text/plain, */*',
                'Content-Type': 'application/json',
                'X-CSRFToken': null,
            }
        });
    });
});
