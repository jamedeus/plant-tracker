import { fireEvent, within } from '@testing-library/react';
import { mockContext, mockPlantOptions } from './mockContext';
import { postHeaders } from 'src/testUtils/headers';
import App from '../App';
import { Toast } from 'src/components/Toast';
import { ErrorModal } from 'src/components/ErrorModal';

describe('App', () => {
    let app, user;

    beforeAll(() => {
        // Simulate SINGLE_USER_MODE disabled on backend
        globalThis.USER_ACCOUNTS_ENABLED = true;
    });

    beforeEach(() => {
        // Clear sessionStorage (cached sortDirection, sortKey)
        sessionStorage.clear();
        // Render app + create userEvent instance to use in tests
        user = userEvent.setup();
        app = render(
            <>
                <App initialState={mockContext} />
                <Toast />
                <ErrorModal />
            </>
        );
    });

    // Original bug: The updatePlantTimestamps function overwrote last_watered
    // with the new timestamp without checking if the new timestamp was more
    // recent than the existing timestamp. Now only overwrites if more recent.
    it('only updates last_watered if new timestamp is more recent', async () => {
        // Get reference to plants column
        const plantsCol = app.getByText("Plants (3)").closest('.section');

        // Confirm last_watered timestamps of first 2 plants say "Yesterday"
        expect(within(plantsCol).queryAllByText('Yesterday').length).toBe(2);
        // Confirm last_watered timestamp of last plant says "Never watered"
        expect(within(plantsCol).queryAllByText('Never watered').length).toBe(1);

        // Simulate user selecting 2 days ago in datetime input, click Water
        const dateTimeInput = app.container.querySelector('input');
        fireEvent.input(
            dateTimeInput,
            {target: {value: '2024-02-28T04:45:00'}}
        );
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                action: "water",
                timestamp: "2024-02-28T12:45:00.000+00:00",
                plants: [
                    "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
                    "19f65fa0-1c75-4cba-b590-0c9b5b315fcc",
                    "26a9fc1f-ef04-4b0f-82ca-f14133fa3b16"
                ],
                failed: []
            })
        }));
        await user.click(app.getByRole("button", {name: "Water"}));

        // Confirm last_watered for first 2 plants didn't change (new timestamp
        // older than existing), confirm last plant now says "2 days ago"
        expect(within(plantsCol).queryAllByText('Yesterday').length).toBe(2);
        expect(within(plantsCol).queryAllByText('2 days ago').length).toBe(1);

        // Simulate user selecting 15 min ago in datetime input, click Water
        fireEvent.input(
            dateTimeInput,
            {target: {value: '2024-03-01T11:45:00'}}
        );
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                action: "water",
                timestamp: "2024-03-01T19:45:00.000+00:00",
                plants: [
                    "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
                    "19f65fa0-1c75-4cba-b590-0c9b5b315fcc",
                    "26a9fc1f-ef04-4b0f-82ca-f14133fa3b16"
                ],
                failed: []
            })
        }));
        await user.click(app.getByRole("button", {name: "Water"}));

        // Confirm all last_watered changed (new timestamp newer than existing)
        expect(within(plantsCol).queryAllByText('Yesterday').length).toBe(0);
        expect(within(plantsCol).queryAllByText('Today').length).toBe(3);
    });

    // Original bug: Plant filter input included results where the UUID,
    // last_watered timestamp, or thumbnail URL matched the user's query.
    it('does not match match UUIDs, timestamps, or URLs when filtering', async () => {
        const plantColumn = app.getByText('Plants (3)').closest('.section');
        const filterInput = within(plantColumn).getByRole('textbox');

        // Type part of UUID in input, should remove all cards
        await user.type(filterInput, '0640');
        await waitFor(() => {
            expect(plantColumn.querySelectorAll('.card').length).toBe(0);
        });

        // Type part of timsetamp in input, should remove all cards
        await user.clear(filterInput);
        await user.type(filterInput, '2024-03-01');
        await waitFor(() => {
            expect(plantColumn.querySelectorAll('.card').length).toBe(0);
        });

        // Type part of thumbnail URL in input, should remove all cards
        await user.clear(filterInput);
        await user.type(filterInput, 'photo_thumb');
        await waitFor(() => {
            expect(plantColumn.querySelectorAll('.card').length).toBe(0);
        });
    });

    // Original bug: It was possible to create water/fertilize events for
    // archived plants by selecting them with the FilterColumn radio buttons
    it('does not create water or fertilize events for archived plants', async () => {
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

        // Click Select plants tab, select all plants, click water
        await user.click(app.getByRole("tab", {name: "Select plants"}));
        await user.click(app.getByLabelText('Select Test Plant'));
        await user.click(app.getByLabelText('Select node'));
        await user.click(app.getByLabelText('Select Newest plant'));
        await user.click(app.getByTestId("water-button"));

        // Confirm payload only contains UUIDs of the first and third plants
        // (the second plant is archived and can not be watered)
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

    // Original bug: The AddPlantsModal selected ref was not cleared after
    // adding plants. If plant1 was added, then the modal was opened again and
    // plant2 was added a duplicate card for plant1 would also be added.
    it('does not add duplicates when AddPlantsModal used twice', async () => {
        // Mock fetch to return options (requested when modal opened)
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ options: mockPlantOptions })
        }));

        // Click Add plants dropdown option
        await user.click(app.getByTestId("add_plants_option"));

        // Mock fetch function to return expected response when first option added
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                added: [
                    mockPlantOptions[Object.keys(mockPlantOptions)[0]]
                ],
                failed: []
            })
        }));

        // Select first plant option in modal, click add button
        await user.click(app.getByLabelText('Select Another test plant'));
        await user.click(app.getByRole('button', {name: 'Add'}));

        // Confirm payload contains UUID of first plant
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

        // Mock fetch to return options remaining option (remove uuid that was
        // already added, simulate options returned by backend)
        const remainingOption = Object.keys(mockPlantOptions)[1];
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ options: {
                [remainingOption]: mockPlantOptions[remainingOption]
            } })
        }));

        // Open modal again, click add button again
        await user.click(app.getByTestId("add_plants_option"));

        // Mock fetch function to return expected response when no UUIDs received
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                added: [],
                failed: []
            })
        }));

        // Click add button without selecting anything
        await user.click(app.getByRole('button', {name: 'Add'}));

        // Confirm payload contains no UUIDs (selected ref cleared)
        expect(global.fetch).toHaveBeenCalledWith('/bulk_add_plants_to_group', {
            method: 'POST',
            body: JSON.stringify({
                group_id: "0640ec3b-1bed-4b15-a078-d6e7ec66be14",
                plants: []
            }),
            headers: postHeaders
        });
    });

    // Original bug: The RemovePlantsModal selected ref was not cleared after
    // removing plants. If plant1 was removed, then the modal was opened again
    // and plant2 was removed the second payload would still include plant1
    it('does not remove plant twice when RemovePlantsModal used twice', async () => {
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

        // Click Remove plants dropdown option (replaced RemovePlantsModal
        // since test written, plants now selected from main PlantsCol)
        await user.click(app.getByTestId("remove_plants_option"));

        // Select first plant option, click Remove button
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

        // Click remove dropdown option again, click Remove button again
        await user.click(app.getByTestId("remove_plants_option"));
        await user.click(app.getByRole('button', {name: 'Remove'}));

        // Confirm payload contains no UUIDs (selected ref cleared)
        expect(global.fetch).toHaveBeenCalledWith('/bulk_remove_plants_from_group', {
            method: 'POST',
            body: JSON.stringify({
                group_id: "0640ec3b-1bed-4b15-a078-d6e7ec66be14",
                plants: []
            }),
            headers: postHeaders
        });
    });

    // Original bug: If user clicked select plants, selected a plant, then opened
    // RemovePlantsModal and removed the selected plant from group it's UUID
    // would still be in the selectedPlants ref (tracks FilterColumn selection)
    it('removes plant uuid from create events array if plant is removed from the group', async () => {
        // Click Select plants tab to show checkboxes, water button
        await user.click(app.getByRole("tab", {name: "Select plants"}));
        // Select the first and third plants (not archived)
        await user.click(app.getByLabelText('Select Test Plant'));
        await user.click(app.getByLabelText('Select Newest plant'));

        // Click Remove plants dropdown option, select first plant card
        // (RemovePlantsModal was removed, now selected from PlantsCol)
        await user.click(app.getByTestId("remove_plants_option"));
        await user.click(app.getByLabelText('Select Test Plant'));

        // Mock fetch function to return expected response, click Remove button
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
                        archived: false
                    }
                ],
                failed: []
            })
        }));
        await user.click(app.getByRole('button', {name: 'Remove'}));

        // Mock fetch function to return expected response when third plant is
        // watered (first and third were selected but then first was removed)
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                action: "water",
                plants: [
                    "26a9fc1f-ef04-4b0f-82ca-f14133fa3b16"
                ],
                failed: []
            })
        }));

        // Click water button, confirm payload only includes the third plant
        // uuid (first plant was removed from group after selecting)
        await user.click(app.getByTestId("water-button"));
        expect(global.fetch).toHaveBeenCalledWith('/bulk_add_plant_events', {
            method: 'POST',
            body: JSON.stringify({
                plants: [
                    "26a9fc1f-ef04-4b0f-82ca-f14133fa3b16"
                ],
                event_type: "water",
                timestamp: "2024-03-01T20:00:00.000Z"
            }),
            headers: postHeaders
        });
    });

    // Original bug: removePlants function added removed plants back to options
    // state, but addPlants function did not remove added plants from options.
    // This usually wasn't a problem since addPlantsModalOptions memo filters
    // out plants that are in the group, but if the plant was added and removed
    // in the same session a duplicate option would be added (existing option
    // on load, not removed on add, added again on remove).
    it('does not add duplicate options to AddPlantsModal if plant added and removed', async () => {
        // Mock fetch to return options (requested when modal opened)
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ options: mockPlantOptions })
        }));

        // Open AddPlantsModal, confirm "Another test plant" option exists
        await user.click(app.getByTestId("add_plants_option"));
        const modal = app.getByText("Add Plants").closest(".modal-box");
        expect(within(modal).getAllByText("Another test plant").length).toBe(1);

        // Mock fetch function to return expected response when "Another test
        // plant" added to group
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                added: [
                    mockPlantOptions[Object.keys(mockPlantOptions)[0]]
                ],
                failed: []
            })
        }));

        // Select "Another test plant" option, click Add button
        await user.click(app.getByLabelText('Select Another test plant'));
        await user.click(app.getByRole('button', {name: 'Add'}));

        // Mock fetch function to return expected response when "Another test
        // plant" is removed from group
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                removed: [
                    {
                        uuid: "0640ec3b-1bed-4b15-a078-d6e7ec66be16",
                        created: "2024-02-26T01:25:12+00:00",
                        name: "Another test plant",
                        display_name: "Another test plant",
                        species: null,
                        description: null,
                        pot_size: 4,
                        last_watered: null,
                        last_fertilized: null,
                        thumbnail: "/media/thumbnails/photo2_thumb.webp",
                        archived: false
                    }
                ],
                failed: []
            })
        }));

        // Click Remove plants dropdown option
        await user.click(app.getByTestId("remove_plants_option"));

        // Select the first plant option, click Remove button
        const plantsCol = app.getByText('Plants (4)').closest('.section');
        await user.click(within(plantsCol).getByLabelText('Select Another test plant'));
        await user.click(app.getByRole('button', {name: 'Remove'}));

        // Confirm AddPlantsModal does not contain a duplicate option
        expect(within(modal).getAllByText("Another test plant").length).toBe(1);
    });
});
