import createMockContext from 'src/testUtils/createMockContext';
import { postHeaders } from 'src/testUtils/headers';
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

    it('sends correct payload when edit modal is submitted', async () => {
        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                "name": "Test group",
                "location": "Middle shelf",
                "description": "",
                "display_name": "Test group"
            })
        }));

        // Click submit button inside edit modal
        const modal = app.getByText("Edit Details").parentElement;
        await user.click(within(modal).getByText("Edit"));

        // Confirm correct data posted to /edit_plant endpoint
        expect(global.fetch).toHaveBeenCalledWith('/edit_group', {
            method: 'POST',
            body: JSON.stringify({
                "name": "Test group",
                "location": "Middle shelf",
                "description": "",
                "group_id": "0640ec3b-1bed-4b15-a078-d6e7ec66be14"
            }),
            headers: postHeaders
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
                    "26a9fc1f-ef04-4b0f-82ca-f14133fa3b16"
                ],
                "failed": []
            })
        }));

        // Click Water All button
        await user.click(app.getByText("Water All"));

        // Confirm correct data posted to /bulk_add_plant_events endpoint
        // Should contain UUIDs of both plants in group
        expect(global.fetch).toHaveBeenCalledWith('/bulk_add_plant_events', {
            method: 'POST',
            body: JSON.stringify({
                "plants": [
                    "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
                    "26a9fc1f-ef04-4b0f-82ca-f14133fa3b16"
                ],
                "event_type": "water",
                "timestamp": "2024-03-01T20:00:00.000Z"
            }),
            headers: postHeaders
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
                    "26a9fc1f-ef04-4b0f-82ca-f14133fa3b16"
                ],
                "failed": []
            })
        }));

        // Click Fertilize All button
        await user.click(app.getByText("Fertilize All"));

        // Confirm correct data posted to /bulk_add_plant_events endpoint
        // Should contain UUIDs of both plants in group
        expect(global.fetch).toHaveBeenCalledWith('/bulk_add_plant_events', {
            method: 'POST',
            body: JSON.stringify({
                "plants": [
                    "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
                    "26a9fc1f-ef04-4b0f-82ca-f14133fa3b16"
                ],
                "event_type": "fertilize",
                "timestamp": "2024-03-01T20:00:00.000Z"
            }),
            headers: postHeaders
        });
    });

    it('shows checkboxes and event buttons when Manage button is clicked', async () => {
        // Get reference to plants column
        const plantsCol = app.getByText("Plants (3)").parentElement;
        // Confirm Water, Fertilize, and Cancel buttons are not visible
        expect(within(plantsCol).queryByText('Water')).toBeNull();
        expect(within(plantsCol).queryByText('Fertilize')).toBeNull();
        expect(within(plantsCol).queryByText('Cancel')).toBeNull();

        // Confirm timestamp input and checkboxes next to plants are not visible
        expect(app.queryByTestId('addEventTimeInput')).toBeNull();
        // Checkboxes are rendered underneath card with position: absolute, so
        // they are not visible until margin-left is added to the card wrapper
        expect(plantsCol.querySelectorAll('.ml-\\[2\\.5rem\\]').length).toBe(0);

        // Click Manage button, confirm buttons, checkboxes, and input appear
        await user.click(app.getByText("Manage"));
        expect(within(plantsCol).getByText('Water').nodeName).toBe('BUTTON');
        expect(within(plantsCol).getByText('Fertilize').nodeName).toBe('BUTTON');
        expect(within(plantsCol).getByText('Cancel').nodeName).toBe('BUTTON');
        expect(plantsCol.querySelectorAll('.ml-\\[2\\.5rem\\]').length).toBe(3);
        expect(app.queryByTestId('addEventTimeInput')).not.toBeNull();

        // Click cancel button, confirm elements disappear
        await user.click(within(plantsCol).getByText("Cancel"));
        expect(within(plantsCol).queryByText('Water')).toBeNull();
        expect(within(plantsCol).queryByText('Fertilize')).toBeNull();
        expect(within(plantsCol).queryByText('Cancel')).toBeNull();
        expect(plantsCol.querySelectorAll('.ml-\\[2\\.5rem\\]').length).toBe(0);
        expect(app.queryByTestId('addEventTimeInput')).toBeNull();
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
        const plantsCol = app.getByText("Plants (3)").parentElement;

        // Click Manage button under plants, select first plant, click water
        await user.click(within(plantsCol).getByText("Manage"));
        await user.click(app.container.querySelectorAll('.radio')[0]);
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
            headers: postHeaders
        });
    });

    it('sends correct payload when only 1 plant is fertilized', async () => {
        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                "action": "fertilize",
                "plants": [
                    "26a9fc1f-ef04-4b0f-82ca-f14133fa3b16"
                ],
                "failed": []
            })
        }));

        // Get reference to plants column
        const plantsCol = app.getByText("Plants (3)").parentElement;

        // Click Manage button under plants, select third plant, click fertilize
        await user.click(within(plantsCol).getByText("Manage"));
        await user.click(app.container.querySelectorAll('.radio')[2]);
        await user.click(within(plantsCol).getByText("Fertilize"));

        // Confirm correct data posted to /bulk_add_plant_events endpoint
        // Should only contain UUID of third plant
        expect(global.fetch).toHaveBeenCalledWith('/bulk_add_plant_events', {
            method: 'POST',
            body: JSON.stringify({
                "plants": [
                    "26a9fc1f-ef04-4b0f-82ca-f14133fa3b16"
                ],
                "event_type": "fertilize",
                "timestamp": "2024-03-01T20:00:00.000Z"
            }),
            headers: postHeaders
        });
    });

    it('sends correct payload when Add Plants modal is submitted', async () => {
        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                "added": [
                    mockContext.options[1]
                ],
                "failed": []
            })
        }));

        // Confirm plant list contains 3 cards
        const plantsCol = app.getByText("Plants (3)").parentElement;
        expect(plantsCol.querySelectorAll('.card-title').length).toBe(3);

        // Click Add plants dropdown option
        await user.click(app.getByText("Add plants"));

        // Get reference to modal, confirm contains 2 plant options
        const addPlantsModal = app.getByText("Add Plants").parentElement;
        expect(addPlantsModal.children[2].children.length).toBe(2);

        // Click the second option twice (unselect, should not be in payload)
        await user.click(addPlantsModal.querySelectorAll('.radio')[1]);
        await user.click(addPlantsModal.querySelectorAll('.radio')[1]);

        // Select the first plant option, click Add button
        await user.click(addPlantsModal.querySelectorAll('.radio')[0]);
        await user.click(addPlantsModal.querySelector('.btn-success'));

        // Confirm correct data posted to /bulk_add_plants_to_group endpoint
        // Should only contain UUID of first plant
        expect(global.fetch).toHaveBeenCalledWith('/bulk_add_plants_to_group', {
            method: 'POST',
            body: JSON.stringify({
                "group_id": "0640ec3b-1bed-4b15-a078-d6e7ec66be14",
                "plants": [
                    "0640ec3b-1bed-4b15-a078-d6e7ec66be16"
                ]
            }),
            headers: postHeaders
        });

        // Confirm 4th card was rendered for newly added plant
        const titles = plantsCol.querySelectorAll('.card-title');
        expect(titles.length).toBe(4);
        expect(titles[3].innerHTML).toBe('Another test plant');
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

        // Confirm plant list contains 3 cards
        const plantsCol = app.getByText("Plants (3)").parentElement;
        expect(plantsCol.querySelectorAll('.card-title').length).toBe(3);

        // Click Remove plants dropdown option
        await user.click(app.getByText("Remove plants"));

        // Get reference to modal, confirm contains 3 plant options
        const addPlantsModal = app.getByText("Remove Plants").parentElement;
        expect(addPlantsModal.children[2].children.length).toBe(3);

        // Select the first plant option, click Remove button
        await user.click(addPlantsModal.querySelectorAll('.radio')[0]);
        await user.click(addPlantsModal.querySelector('.btn-error'));

        // Confirm correct data posted to /bulk_remove_plants_from_group endpoint
        // Should only contain UUID of first plant
        expect(global.fetch).toHaveBeenCalledWith('/bulk_remove_plants_from_group', {
            method: 'POST',
            body: JSON.stringify({
                "group_id": "0640ec3b-1bed-4b15-a078-d6e7ec66be14",
                "plants": [
                    "0640ec3b-1bed-4b15-a078-d6e7ec66be12"
                ]
            }),
            headers: postHeaders
        });

        // Confirm selected plant was removed from plant list
        const titles = plantsCol.querySelectorAll('.card-title');
        expect(titles.length).toBe(2);
        expect(titles[0].innerHTML).toBe('Unnamed Spider Plant');
        expect(titles[1].innerHTML).toBe('Newest plant');
    });

    it('redirects to overview when dropdown option is clicked', async () => {
        // Click overview dropdown option, confirm redirected
        await user.click(app.getByText('Overview'));
        expect(window.location.href).toBe('/');
    });

    it('fetches new state when user navigates to page with back button', async () => {
        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                "group": mockContext.group,
                "details": mockContext.details,
                "options": mockContext.options
            })
        }));

        // Simulate user navigating to page with back button
        const pageshowEvent = new Event('pageshow');
        Object.defineProperty(pageshowEvent, 'persisted', { value: true });
        window.dispatchEvent(pageshowEvent);

        // Confirm fetched correct endpoint
        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                '/get_group_state/0640ec3b-1bed-4b15-a078-d6e7ec66be14'
            );
        });
    });

    it('reloads page if unable to fetch new state when user presses back button', async () => {
        // Mock fetch function to return error response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: false,
            json: () => Promise.resolve({'Error': 'Group not found'})
        }));

        // Simulate user navigating to page with back button
        const pageshowEvent = new Event('pageshow');
        Object.defineProperty(pageshowEvent, 'persisted', { value: true });
        window.dispatchEvent(pageshowEvent);

        // Confirm fetched correct endpoint
        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                '/get_group_state/0640ec3b-1bed-4b15-a078-d6e7ec66be14'
            );
        });

        // Confirm page was reloaded
        expect(window.location.reload).toHaveBeenCalled();
    });

    it('does not fetch new state when other pageshow events are triggered', () => {
        // Simulate pageshow event with persisted == false (ie initial load)
        const pageshowEvent = new Event('pageshow');
        Object.defineProperty(pageshowEvent, 'persisted', { value: false });
        window.dispatchEvent(pageshowEvent);

        // Confirm did not call fetch
        expect(global.fetch).not.toHaveBeenCalled();
    });
});
