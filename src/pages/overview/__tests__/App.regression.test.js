import { fireEvent, waitFor } from '@testing-library/react';
import createMockContext from 'src/testUtils/createMockContext';
import bulkCreateMockContext from 'src/testUtils/bulkCreateMockContext';
import { postHeaders } from 'src/testUtils/headers';
import { PageWrapper } from 'src/index';
import App from '../App';
import { mockContext } from './mockContext';

jest.mock('print-js');

describe('App', () => {
    let app, user;

    beforeAll(() => {
        // Create mock state objects
        bulkCreateMockContext(mockContext);
        createMockContext('user_accounts_enabled', true);
    });

    beforeEach(() => {
        // Allow fast forwarding (must hold delete button to confirm)
        jest.useFakeTimers({ doNotFake: ['Date'] });

        // Clear sessionStorage (cached sortDirection, sortKey)
        sessionStorage.clear();
        // Render app + create userEvent instance to use in tests
        user = userEvent.setup({ advanceTimers: jest.advanceTimersByTimeAsync });
        app = render(
            <PageWrapper>
                <App />
            </PageWrapper>
        );
    });

    // Clean up pending timers after each test
    afterEach(() => {
        act(() => jest.runAllTimers());
        jest.useRealTimers();
    });

    // Original bug: Plant and Group filter inputs included results where the
    // UUID, last_watered timestamp, or thumbnail URL matched the user's query.
    it('does not match match UUIDs, timestamps, or URLs when filtering', async () => {
        const plantColumn = app.getByText('Plants (2)').closest('.section');
        const groupColumn = app.getByText('Groups (2)').closest('.section');
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
                deleted: [
                    "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
                    "0640ec3b-1bed-4b15-a078-d6e7ec66be14"
                ],
                failed: []
            })
        }));

        // Click edit option, select first plant and first group checkboxes
        await user.click(app.getByText("Edit"));
        await user.click(app.getByLabelText('Select Test Plant'));
        await user.click(app.getByLabelText('Select Test group'));

        // Click delete button in floating div, hold for 2.5 seconds, release
        const button = app.getByRole('button', { name: 'Delete' });
        fireEvent.mouseDown(button);
        await act(async () => await jest.advanceTimersByTimeAsync(2500));
        fireEvent.mouseUp(button);

        // Confirm correct data posted to /bulk_delete_plants_and_groups endpoint
        expect(global.fetch).toHaveBeenCalledWith('/bulk_delete_plants_and_groups', {
            method: 'POST',
            body: JSON.stringify({
                uuids: [
                    "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
                    "0640ec3b-1bed-4b15-a078-d6e7ec66be14"
                ]
            }),
            headers: postHeaders
        });

        // Clear mock fetch calls
        jest.clearAllMocks();

        // Click edit option, hold delete button again
        await user.click(app.getByText("Edit"));
        fireEvent.mouseDown(button);
        await act(async () => await jest.advanceTimersByTimeAsync(2500));
        fireEvent.mouseUp(button);

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
                archived: [
                    "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
                    "0640ec3b-1bed-4b15-a078-d6e7ec66be14"
                ],
                failed: []
            })
        }));

        // Click edit option, select first plant and first group checkboxes
        await user.click(app.getByText("Edit"));
        await user.click(app.getByLabelText('Select Test Plant'));
        await user.click(app.getByLabelText('Select Test group'));

        // Click archive button in floating div
        await user.click(app.getByText('Archive'));

        // Confirm correct data posted to /bulk_delete_plants_and_groups endpoint
        expect(global.fetch).toHaveBeenCalledWith('/bulk_archive_plants_and_groups', {
            method: 'POST',
            body: JSON.stringify({
                uuids: [
                    "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
                    "0640ec3b-1bed-4b15-a078-d6e7ec66be14"
                ],
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
