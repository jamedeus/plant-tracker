import { fireEvent } from '@testing-library/react';
import createMockContext from 'src/testUtils/createMockContext';
import { mockContext } from './mockContext';
import { postHeaders } from 'src/testUtils/headers';
import App from '../App';
import { PageWrapper } from 'src/index';

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

    // Original bug: The updatePlantTimestamps function overwrote last_watered
    // with the new timestamp without checking if the new timestamp was more
    // recent than the existing timestamp. Now only overwrites if more recent.
    it('only updates last_watered if new timestamp is more recent', async () => {
        // Mock fetch function to return successful response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                "action": "water",
                "plants": [
                    "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
                    "19f65fa0-1c75-4cba-b590-0c9b5b315fcc",
                    "26a9fc1f-ef04-4b0f-82ca-f14133fa3b16"
                ],
                "failed": []
            })
        }));

        // Get reference to plants column
        const plantsCol = app.getByText("Plants (3)").parentElement;

        // Confirm last_watered timestamps of first 2 plants say "Yesterday"
        expect(within(plantsCol).queryAllByText('Yesterday').length).toBe(2);
        // Confirm last_watered timestamp of last plant says "Never watered"
        expect(within(plantsCol).queryAllByText('Never watered').length).toBe(1);

        // Simulate user selecting 2 days ago in datetime input, click Water All
        const dateTimeInput = app.container.querySelector('input');
        fireEvent.input(
            dateTimeInput,
            {target: {value: '2024-02-28T04:45:00'}}
        );
        await user.click(app.getByText("Water All"));

        // Confirm last_watered for first 2 plants didn't change (new timestamp
        // older than existing), confirm last plant now says "2 days ago"
        expect(within(plantsCol).queryAllByText('Yesterday').length).toBe(2);
        expect(within(plantsCol).queryAllByText('2 days ago').length).toBe(1);

        // Simulate user selecting 15 min ago in datetime input, click Water All
        fireEvent.input(
            dateTimeInput,
            {target: {value: '2024-03-01T11:45:00'}}
        );
        await user.click(app.getByText("Water All"));

        // Confirm all last_watered changed (new timestamp newer than existing)
        expect(within(plantsCol).queryAllByText('Yesterday').length).toBe(0);
        expect(within(plantsCol).queryAllByText('Today').length).toBe(3);
    });

    // Original bug: Plant filter input included results where the UUID,
    // last_watered timestamp, or thumbnail URL matched the user's query.
    it('does not match match UUIDs, timestamps, or URLs when filtering', async () => {
        const plantColumn = app.getByText('Plants (3)').parentElement;
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
                "action": "water",
                "plants": [
                    "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
                    "26a9fc1f-ef04-4b0f-82ca-f14133fa3b16"
                ],
                "failed": []
            })
        }));

        // Get reference to plants column
        const plantsCol = app.getByText("Plants (3)").parentElement;

        // Click Manage button under plants, select all plants, click water
        await user.click(within(plantsCol).getByText("Manage"));
        await user.click(plantsCol.querySelectorAll('label.cursor-pointer')[0]);
        await user.click(plantsCol.querySelectorAll('label.cursor-pointer')[1]);
        await user.click(plantsCol.querySelectorAll('label.cursor-pointer')[2]);
        await user.click(within(plantsCol).getByText("Water"));

        // Confirm payload only contains UUIDs of the first and third plants
        // (the second plant is archived and can not be watered)
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

    // Original bug: The AddPlantsModal selected ref was not cleared after
    // adding plants. If plant1 was added, then the modal was opened again and
    // plant2 was added a duplicate card for plant1 would also be added.
    it('does not add duplicates when AddPlantsModal used twice', async () => {
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

        // Click Add plants dropdown option
        await user.click(app.getByText("Add plants"));

        // Get reference to modal, select first plant option, click add button
        const addPlantsModal = app.getByText("Add Plants").parentElement;
        await user.click(addPlantsModal.querySelectorAll('label.cursor-pointer')[0]);
        await user.click(addPlantsModal.querySelector('.btn-success'));

        // Confirm payload contains UUID of first plant
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

        // Reopen modal again, click add button again
        await user.click(app.getByText("Add plants"));
        await user.click(addPlantsModal.querySelector('.btn-success'));

        // Confirm payload contains no UUIDs (selected ref cleared)
        expect(global.fetch).toHaveBeenCalledWith('/bulk_add_plants_to_group', {
            method: 'POST',
            body: JSON.stringify({
                "group_id": "0640ec3b-1bed-4b15-a078-d6e7ec66be14",
                "plants": []
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
                "removed": [
                    "0640ec3b-1bed-4b15-a078-d6e7ec66be12"
                ],
                "failed": []
            })
        }));

        // Click Remove plants dropdown option
        await user.click(app.getByText("Remove plants"));

        // Get reference to modal, select first plant option, click Remove button
        const removePlantsModal = app.getByText("Remove Plants").parentElement;
        await user.click(removePlantsModal.querySelectorAll('label.cursor-pointer')[0]);
        await user.click(removePlantsModal.querySelector('.btn-error'));

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

        // Reopen modal again, click add button again
        await user.click(app.getByText("Remove plants"));
        await user.click(removePlantsModal.querySelector('.btn-error'));

        // Confirm payload contains no UUIDs (selected ref cleared)
        expect(global.fetch).toHaveBeenCalledWith('/bulk_remove_plants_from_group', {
            method: 'POST',
            body: JSON.stringify({
                "group_id": "0640ec3b-1bed-4b15-a078-d6e7ec66be14",
                "plants": []
            }),
            headers: postHeaders
        });
    });

    // Original bug: If the user clicked manage, selected a plant, then opened
    // RemovePlantsModal and removed the selected plant from group it's UUID
    // would still be in the selectedPlants ref (tracks FilterColumn selection)
    it('removes plant uuid from create events array if plant is removed from the group', async () => {
        // Click manage button to show checkboxes, water button
        await user.click(app.getByText("Manage"));
        // Select the first and third plants (not archived)
        const plantsCol = app.getByText("Plants (3)").parentElement;
        await user.click(plantsCol.querySelectorAll('label.cursor-pointer')[0]);
        await user.click(plantsCol.querySelectorAll('label.cursor-pointer')[2]);

        // Open Remove plants modal, select first plant option
        await user.click(app.getByText("Remove plants"));
        const removePlantsModal = app.getByText("Remove Plants").parentElement;
        await user.click(removePlantsModal.querySelectorAll('label.cursor-pointer')[0]);

        // Mock fetch function to return expected response, click remove button
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                "removed": [
                    "0640ec3b-1bed-4b15-a078-d6e7ec66be12"
                ],
                "failed": []
            })
        }));
        await user.click(removePlantsModal.querySelector('.btn-error'));

        // Mock fetch function to return expected response when third plant is
        // watered (first and third were selected but then first was removed)
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                "action": "water",
                "plants": [
                    "26a9fc1f-ef04-4b0f-82ca-f14133fa3b16"
                ],
                "failed": []
            })
        }));

        // Click water button, confirm payload only includes the third plant
        // uuid (first plant was removed from group after selecting)
        await user.click(within(
            app.getByText("Plants (2)").parentElement
        ).getByText("Water"));
        expect(global.fetch).toHaveBeenCalledWith('/bulk_add_plant_events', {
            method: 'POST',
            body: JSON.stringify({
                "plants": [
                    "26a9fc1f-ef04-4b0f-82ca-f14133fa3b16"
                ],
                "event_type": "water",
                "timestamp": "2024-03-01T20:00:00.000Z"
            }),
            headers: postHeaders
        });
    });
});
