import createMockContext from 'src/testUtils/createMockContext';
import { mockContext } from './mockContext';
import { localToUTC } from 'src/timestampUtils';
import { postHeaders } from 'src/testUtils/headers';

// Mock localToUTC so the return value can be set to an arbitrary string
jest.mock('src/timestampUtils', () => {
    const module = jest.requireActual('src/timestampUtils');
    return {
        ...module,
        localToUTC: jest.fn()
    };
});

// Simulates user setting datetime-local input value
// Since the input value is passed directly to localToUTC mocking the return
// value bypasses the actual input, which can't be reliable set with fireEvent
const simulateUserDatetimeInput = (timestamp) => {
    localToUTC.mockReturnValueOnce(timestamp);
};

// Import App, will use mocked localToUTC
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
        simulateUserDatetimeInput('2024-02-28T12:45:00.000Z');
        await user.click(app.getByText("Water All"));

        // Confirm last_watered for first 2 plants didn't change (new timestamp
        // older than existing), confirm last plant now says "2 days ago"
        expect(within(plantsCol).queryAllByText('Yesterday').length).toBe(2);
        expect(within(plantsCol).queryAllByText('2 days ago').length).toBe(1);

        // Simulate user selecting 15 min ago in datetime input, click Water All
        simulateUserDatetimeInput('2024-03-01T19:45:00.000Z');
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

        // Set simulated datetime
        simulateUserDatetimeInput('2024-03-01T20:00:00.000Z');

        // Get reference to plants column
        const plantsCol = app.getByText("Plants (3)").parentElement;

        // Click Manage button under plants, select all plants, click water
        await user.click(within(plantsCol).getByText("Manage"));
        await user.click(app.container.querySelectorAll('.radio')[0]);
        await user.click(app.container.querySelectorAll('.radio')[1]);
        await user.click(app.container.querySelectorAll('.radio')[2]);
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
});
