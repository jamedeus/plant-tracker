import createMockContext from 'src/testUtils/createMockContext';
import { postHeaders } from 'src/testUtils/headers';
import { PageWrapper } from 'src/index';
import App from '../App';
import { mockContext } from './mockContext';

jest.mock('print-js');

describe('App', () => {
    let app, user;

    beforeAll(() => {
        // Create mock state objects
        createMockContext('plants', mockContext.plants);
        createMockContext('groups', mockContext.groups);
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

    // Original bug: Plant and Group filter inputs included results where the
    // UUID, last_watered timestamp, or thumbnail URL matched the user's query.
    it('does not match match UUIDs, timestamps, or URLs when filtering', async () => {
        const plantColumn = app.getByText('Plants (1)').parentElement;
        const groupColumn = app.getByText('Groups (1)').parentElement;
        const plantFilterInput = within(plantColumn).getByRole('textbox');
        const groupFilterInput = within(groupColumn).getByRole('textbox');

        // Type part of UUID in both inputs, should remove all cards
        await user.type(plantFilterInput, '0640');
        await user.type(groupFilterInput, '0640');
        await waitFor(() => {
            expect(plantColumn.querySelectorAll('.card').length).toBe(0);
            expect(groupColumn.querySelectorAll('.card').length).toBe(0);
        });

        // Type part of timsetamp in plant input, should remove all cards
        await user.clear(plantFilterInput);
        await user.type(plantFilterInput, '2024-02-26');
        await waitFor(() => {
            expect(plantColumn.querySelectorAll('.card').length).toBe(0);
        });

        // Type part of thumbnail URL in plant input, should remove all cards
        await user.clear(plantFilterInput);
        await user.type(plantFilterInput, 'photo_thumb');
        await waitFor(() => {
            expect(plantColumn.querySelectorAll('.card').length).toBe(0);
        });
    });

    // Original bug: The selectedPlants and selectedGroups refs weren't cleared
    // ater deleting or archiving plants/groups. If the user entered edit mode,
    // selected items, submitted, and then entered edit mode again the second
    // payload would still contain all UUIDs from the first. This did not cause
    // issues on the frontend but did cause unnecessary database queries.
    it('does not submit UUIDs that have already been deleted', async () => {
        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                "deleted": "uuid"
            })
        }));

        // Click edit option, click both checkboxes (first plant second grou)
        await user.click(app.getByText("Edit"));
        await user.click(app.container.querySelectorAll('label.cursor-pointer')[0]);
        await user.click(app.container.querySelectorAll('label.cursor-pointer')[1]);

        // Click delete button in floating div
        await user.click(app.getByText('Delete'));

        // Confirm UUIDs posted to /delete_plant and /delete_group endpoints
        expect(global.fetch).toHaveBeenCalledWith('/delete_plant', {
            method: 'POST',
            body: JSON.stringify({
                "plant_id": "0640ec3b-1bed-4b15-a078-d6e7ec66be12"
            }),
            headers: postHeaders
        });
        expect(global.fetch).toHaveBeenCalledWith('/delete_group', {
            method: 'POST',
            body: JSON.stringify({
                "group_id": "0640ec3b-1bed-4b15-a078-d6e7ec66be14"
            }),
            headers: postHeaders
        });

        // Clear mock fetch calls
        jest.clearAllMocks();

        // Click edit option, click delete again
        await user.click(app.getByText("Edit"));
        await user.click(app.getByText('Delete'));

        // Confirm no request was made (selection cleared after first request)
        expect(global.fetch).not.toHaveBeenCalled();
    });

    // Original bug: The selectedPlants and selectedGroups refs weren't cleared
    // ater deleting or archiving plants/groups. If the user entered edit mode,
    // selected items, submitted, and then entered edit mode again the second
    // payload would still contain all UUIDs from the first. This did not cause
    // issues on the frontend but did cause unnecessary database queries.
    it('does not submit UUIDs that have already been archived', async () => {
        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                "updated": "uuid"
            })
        }));

        // Click edit option, click both checkboxes (first plant second grou)
        await user.click(app.getByText("Edit"));
        await user.click(app.container.querySelectorAll('label.cursor-pointer')[0]);
        await user.click(app.container.querySelectorAll('label.cursor-pointer')[1]);

        // Click archive button in floating div
        await user.click(app.getByText('Archive'));

        // Confirm UUIDs posted to /archive_plant and /archive_group endpoints
        expect(global.fetch).toHaveBeenCalledWith('/archive_plant', {
            method: 'POST',
            body: JSON.stringify({
                "plant_id": "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
                archived: true
            }),
            headers: postHeaders
        });
        expect(global.fetch).toHaveBeenCalledWith('/archive_group', {
            method: 'POST',
            body: JSON.stringify({
                "group_id": "0640ec3b-1bed-4b15-a078-d6e7ec66be14",
                archived: true
            }),
            headers: postHeaders
        });

        // Clear mock fetch calls
        jest.clearAllMocks();

        // Click edit option, click archive again
        await user.click(app.getByText("Edit"));
        await user.click(app.getByText('Archive'));

        // Confirm no request was made (selection cleared after first request)
        expect(global.fetch).not.toHaveBeenCalled();
    });
});
