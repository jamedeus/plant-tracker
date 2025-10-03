import { postHeaders } from 'src/testUtils/headers';
import App from '../App';
import { Toast } from 'src/components/Toast';
import { ErrorModal } from 'src/components/ErrorModal';
import { mockContext, mockPlantOptions } from './mockContext';

// Mock the global navigate function used by sendPostRequest
jest.mock('src/navigate', () => ({
    navigate: jest.fn(),
    setNavigate: jest.fn(),
}));
import { navigate as globalMockNavigate } from 'src/navigate';
import { waitFor } from '@testing-library/react';

describe('App', () => {
    let app, user;

    beforeAll(() => {
        // Simulate SINGLE_USER_MODE disabled on backend
        globalThis.USER_ACCOUNTS_ENABLED = true;
    });

    beforeEach(() => {
        jest.useFakeTimers({ doNotFake: ['Date'] });

        // Clear sessionStorage (cached sortDirection, sortKey)
        sessionStorage.clear();
        // Render app + create userEvent instance to use in tests
        user = userEvent.setup({ advanceTimers: jest.advanceTimersByTimeAsync });
        app = render(
            <>
                <App initialState={mockContext} />
                <Toast />
                <ErrorModal />
            </>
        );
    });

    // Clean up pending timers after each test
    afterEach(() => {
        act(() => jest.runAllTimers());
        jest.useRealTimers();
    });

    it('opens TitleDrawer with group details when title is clicked', async () => {
        // Confirm title drawer is closed by default
        const titleDrawer = app.getByTestId('title-drawer');
        expect(titleDrawer.classList).not.toContain('title-drawer-open');

        // Click title, confirm drawer opens
        await user.click(app.getByText('Test group'));
        expect(titleDrawer.classList).toContain('title-drawer-open');

        // Click title again, confirm drawer closes
        await user.click(app.getByText('Test group'));
        expect(titleDrawer.classList).not.toContain('title-drawer-open');

        // Open again
        await user.click(app.getByText('Test group'));
        expect(titleDrawer.classList).toContain('title-drawer-open');

        // Click page outside of drawer, confirm drawer closes
        await user.click(app.getByText("Plants (3)"));
        expect(titleDrawer.classList).not.toContain('title-drawer-open');
    });

    it('sends correct payload when edit modal is submitted', async () => {
        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                name: "Test group",
                location: "Middle shelf",
                description: "",
                display_name: "Test group"
            })
        }));

        // Open edit modal
        await user.click(app.getByRole('button', {name: 'Edit Details'}));
        await act(async () => await jest.advanceTimersByTimeAsync(100));

        // Click submit button inside edit modal
        const modal = document.body.querySelector(".modal-box");
        await user.click(within(modal).getByText("Edit"));

        // Confirm correct data posted to /edit_group_details endpoint
        expect(global.fetch).toHaveBeenCalledWith('/edit_group_details', {
            method: 'POST',
            body: JSON.stringify({
                group_id: "0640ec3b-1bed-4b15-a078-d6e7ec66be14",
                name: "Test group",
                location: "Middle shelf",
                description: "",
            }),
            headers: postHeaders
        });
    });

    it('disables edit modal submit button when fields are too long', async () => {
        // Open edit modal
        await user.click(app.getByRole('button', {name: 'Edit Details'}));
        await act(async () => await jest.advanceTimersByTimeAsync(100));

        // Get fields with length limits + edit button
        const modal = document.body.querySelector(".modal-box");
        const editButton = within(modal).getByRole("button", {name: "Edit"});
        const nameField = within(modal).getByRole('textbox', {name: 'Group name'});
        const locationField = within(modal).getByRole('textbox', {name: 'Group location'});
        const descriptionField = within(modal).getByRole('textbox', {name: 'Description'});

        // Confirm edit button is enabled
        expect(editButton).not.toBeDisabled();

        // Type >50 characters in Plant name field, confirm edit button is disabled
        await user.type(nameField, '.'.repeat(51));
        expect(editButton).toBeDisabled();
        await user.clear(nameField);

        // Type >50 characters in location field, confirm edit button is disabled
        await user.type(locationField, '.'.repeat(51));
        expect(editButton).toBeDisabled();
        await user.clear(locationField);

        // Type >500 characters in description field, confirm edit button is disabled
        await user.type(descriptionField, '.'.repeat(501));
        expect(editButton).toBeDisabled();
    });

    it('sends correct payload when all plants are watered', async () => {
        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                action: "water",
                timestamp: "2024-03-01T20:00:00.000+00:00",
                plants: [
                    "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
                    "26a9fc1f-ef04-4b0f-82ca-f14133fa3b16"
                ],
                failed: []
            })
        }));

        // Ensure "All plants" tab is active, click Water button
        await user.click(app.getByRole("tab", {name: "All plants"}));
        await user.click(app.getByRole("button", {name: "Water"}));

        // Confirm correct data posted to /bulk_add_plant_events endpoint
        // Should contain UUIDs of both plants in group
        expect(global.fetch).toHaveBeenCalledWith('/bulk_add_plant_events', {
            method: 'POST',
            body: JSON.stringify({
                plants: [
                    "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
                    "26a9fc1f-ef04-4b0f-82ca-f14133fa3b16"
                ],
                event_type: "water",
                timestamp: "2024-03-01T20:00:00.000Z"
            }),
            headers: postHeaders
        });
    });

    it('sends correct payload when Fertilize All button clicked', async () => {
        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                action: "fertilize",
                timestamp: "2024-03-01T20:00:00.000+00:00",
                plants: [
                    "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
                    "26a9fc1f-ef04-4b0f-82ca-f14133fa3b16"
                ],
                failed: []
            })
        }));

        // Ensure "All plants" tab is active, click Fertilize button
        await user.click(app.getByRole("tab", {name: "All plants"}));
        await user.click(app.getByRole("button", {name: "Fertilize"}));

        // Confirm correct data posted to /bulk_add_plant_events endpoint
        // Should contain UUIDs of both plants in group
        expect(global.fetch).toHaveBeenCalledWith('/bulk_add_plant_events', {
            method: 'POST',
            body: JSON.stringify({
                plants: [
                    "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
                    "26a9fc1f-ef04-4b0f-82ca-f14133fa3b16"
                ],
                event_type: "fertilize",
                timestamp: "2024-03-01T20:00:00.000Z"
            }),
            headers: postHeaders
        });
    });

    // Note: this response can only be received if SINGLE_USER_MODE is disabled
    it('redirects to login page if events added while user not signed in', async () => {
        // Mock fetch function to simulate user with an expired session
        global.fetch = jest.fn(() => Promise.resolve({
            ok: false,
            status: 401,
            json: () => Promise.resolve({
                error: "authentication required"
            })
        }));

        // Click Water button
        await user.click(app.getByRole("button", {name: "Water"}));

        // Confirm redirected
        expect(globalMockNavigate).toHaveBeenCalledWith('/accounts/login/');
    });

    it('shows checkboxes when Select plants tab is clicked', async () => {
        // Get reference to plants column
        const plantsCol = app.getByText("Plants (3)").closest('.section');
        // Checkboxes are rendered underneath card with position: absolute, so
        // they are not visible until margin-left is added to the card wrapper
        expect(plantsCol.querySelectorAll('.ml-\\[2\\.5rem\\]').length).toBe(0);

        // Click Select plants tab, confirm checkboxes appear
        await user.click(app.getByRole("tab", {name: "Select plants"}));
        expect(plantsCol.querySelectorAll('.ml-\\[2\\.5rem\\]').length).toBe(3);

        // Click All plants tab, confirm checkboxes disappear
        await user.click(app.getByRole("tab", {name: "All plants"}));
        expect(plantsCol.querySelectorAll('.ml-\\[2\\.5rem\\]').length).toBe(0);
    });

    it('sends correct payload when only 1 plant is watered', async () => {
        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                action: "water",
                timestamp: "2024-03-01T20:00:00.000+00:00",
                plants: [
                    "0640ec3b-1bed-4b15-a078-d6e7ec66be12"
                ],
                failed: []
            })
        }));

        // Click Select plants tab, select first plant, click water
        await user.click(app.getByRole("tab", {name: "Select plants"}));
        await user.click(app.getByLabelText('Select Test Plant'));
        await user.click(app.getByTestId("water-button"));

        // Confirm correct data posted to /bulk_add_plant_events endpoint
        // Should only contain UUID of first plant
        expect(global.fetch).toHaveBeenCalledWith('/bulk_add_plant_events', {
            method: 'POST',
            body: JSON.stringify({
                plants: [
                    "0640ec3b-1bed-4b15-a078-d6e7ec66be12"
                ],
                event_type: "water",
                timestamp: "2024-03-01T20:00:00.000Z"
            }),
            headers: postHeaders
        });
    });

    it('sends correct payload when only 1 plant is fertilized', async () => {
        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                action: "fertilize",
                timestamp: "2024-03-01T20:00:00.000+00:00",
                plants: [
                    "26a9fc1f-ef04-4b0f-82ca-f14133fa3b16"
                ],
                failed: []
            })
        }));

        // Click Select plants tab, select third plant, click fertilize
        await user.click(app.getByRole("tab", {name: "Select plants"}));
        await user.click(app.getByLabelText('Select Newest plant'));
        await user.click(app.getByTestId("fertilize-button"));

        // Confirm correct data posted to /bulk_add_plant_events endpoint
        // Should only contain UUID of third plant
        expect(global.fetch).toHaveBeenCalledWith('/bulk_add_plant_events', {
            method: 'POST',
            body: JSON.stringify({
                plants: [
                    "26a9fc1f-ef04-4b0f-82ca-f14133fa3b16"
                ],
                event_type: "fertilize",
                timestamp: "2024-03-01T20:00:00.000Z"
            }),
            headers: postHeaders
        });
    });

    it('sends correct payload when only 1 plant is pruned', async () => {
        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                action: "prune",
                timestamp: "2024-03-01T20:00:00.000+00:00",
                plants: [
                    "26a9fc1f-ef04-4b0f-82ca-f14133fa3b16"
                ],
                failed: []
            })
        }));

        // Click Select plants tab, select third plant, click prune
        await user.click(app.getByRole("tab", {name: "Select plants"}));
        await user.click(app.getByLabelText('Select Newest plant'));
        await user.click(app.getByTestId("prune-button"));

        // Confirm correct data posted to /bulk_add_plant_events endpoint
        // Should only contain UUID of third plant
        expect(global.fetch).toHaveBeenCalledWith('/bulk_add_plant_events', {
            method: 'POST',
            body: JSON.stringify({
                plants: [
                    "26a9fc1f-ef04-4b0f-82ca-f14133fa3b16"
                ],
                event_type: "prune",
                timestamp: "2024-03-01T20:00:00.000Z"
            }),
            headers: postHeaders
        });
    });

    it('sends correct payload when Add Plants modal is submitted', async () => {
        // Confirm plant list contains 3 cards
        const plantsCol = app.getByText("Plants (3)").closest('.section');
        expect(plantsCol.querySelectorAll('.card-title').length).toBe(3);

        // Mock fetch to return options (requested when modal opened)
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ options: mockPlantOptions })
        }));

        // Click Add plants dropdown option, wait until rendered
        await user.click(app.getByTestId("add_plants_option"));
        await act(async () => await jest.advanceTimersByTimeAsync(100));

        // Mock fetch function to return expected response when submitted
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                added: [
                    mockPlantOptions[Object.keys(mockPlantOptions)[0]]
                ],
                failed: []
            })
        }));

        // Get reference to modal, confirm contains 2 plant options
        const modal = app.getByText("Add Plants").closest(".modal-box");
        const plantOptions = modal.querySelector('form:not([method="dialog"])');
        expect(plantOptions.children.length).toBe(2);

        // Click the second option twice (unselect, should not be in payload)
        await user.click(app.getByLabelText('Select Third test plant'));
        await user.click(app.getByLabelText('Select Third test plant'));

        // Select the first plant option, click Add button
        await user.click(app.getByLabelText('Select Another test plant'));
        await user.click(app.getByRole('button', {name: 'Add'}));

        // Confirm correct data posted to /bulk_add_plants_to_group endpoint
        // Should only contain UUID of first plant
        expect(global.fetch).toHaveBeenCalledWith('/bulk_add_plants_to_group', {
            method: 'POST',
            body: JSON.stringify({
                group_id: "0640ec3b-1bed-4b15-a078-d6e7ec66be14",
                plants: [
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

    it('sends correct payload when plants are removed from group', async () => {
        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                removed: [
                    {
                        name: "Test Plant",
                        display_name: "Test Plant",
                        uuid: "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
                        created: "2023-12-26T01:25:12+00:00",
                        species: "Calathea",
                        description: "This is a plant with a long description with",
                        pot_size: 4,
                        last_watered: "2024-02-29T12:45:44+00:00",
                        last_fertilized: "2024-03-01T05:45:44+00:00",
                        thumbnail: null,
                        archived: false,
                        group: null
                    }
                ],
                failed: []
            })
        }));

        // Confirm plant list contains 3 cards, floating footer not visible
        const plantsCol = app.getByText("Plants (3)").closest('.section');
        expect(plantsCol.querySelectorAll('.card-title').length).toBe(3);
        const floatingFooter = app.getByTestId('remove-plants-footer');
        expect(floatingFooter.classList).toContain('floating-footer-hidden');

        // Click Remove plants dropdown option, confirm floating footer appeared
        await user.click(app.getByTestId("remove_plants_option"));
        expect(floatingFooter.classList).toContain('floating-footer-visible');

        // Select the first plant option, click Remove button
        await user.click(app.getByLabelText('Select Test Plant'));
        await user.click(app.getByRole('button', {name: 'Remove'}));

        // Confirm correct data posted to /bulk_remove_plants_from_group endpoint
        // Should only contain UUID of first plant
        expect(global.fetch).toHaveBeenCalledWith('/bulk_remove_plants_from_group', {
            method: 'POST',
            body: JSON.stringify({
                group_id: "0640ec3b-1bed-4b15-a078-d6e7ec66be14",
                plants: [
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

        // Confirm floating footer disappeared
        expect(floatingFooter.classList).toContain('floating-footer-hidden');
    });

    it('does not show AddEventsFooter and RemovePlantsFooter at the same time', async () => {
        // Confirm both footers are hidden
        const RemovePlantsFooter = app.getByTestId('remove-plants-footer');
        expect(RemovePlantsFooter.classList).toContain('floating-footer-hidden');
        const AddEventsFooter = app.getByTestId('add-events-footer');
        expect(AddEventsFooter.classList).toContain('floating-footer-hidden');

        // Click select plants option, confirm AddEventsFooter appears, RemovePlantsFooter disappears
        await user.click(app.getByRole("tab", {name: "Select plants"}));
        expect(RemovePlantsFooter.classList).toContain('floating-footer-hidden');
        expect(AddEventsFooter.classList).toContain('floating-footer-visible');

        // Click remove plants option, confirm RemovePlantsFooter appears, AddEventsFooter disappears
        await user.click(app.getByTestId('remove_plants_option'));
        expect(RemovePlantsFooter.classList).toContain('floating-footer-visible');
        expect(AddEventsFooter.classList).toContain('floating-footer-hidden');
    });
});
