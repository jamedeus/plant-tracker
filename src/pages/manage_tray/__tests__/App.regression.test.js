import createMockContext from 'src/testUtils/createMockContext';
import { mockContext } from './mockContext';
import { localToUTC } from 'src/util';

// Mock localToUTC so the return value can be set to an arbitrary string
jest.mock('src/util', () => {
    const module = jest.requireActual('src/util');
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
import { ToastProvider } from 'src/context/ToastContext';
import { ThemeProvider } from 'src/context/ThemeContext';
import { ErrorModalProvider } from 'src/context/ErrorModalContext';

describe('App', () => {
    let app, user;

    beforeAll(() => {
        // Create mock state objects
        createMockContext('tray', mockContext.tray);
        createMockContext('details', mockContext.details);
        createMockContext('options', mockContext.options);
    });

    beforeEach(() => {
        // Render app + create userEvent instance to use in tests
        app = render(
            <ThemeProvider>
                <ToastProvider>
                    <ErrorModalProvider>
                        <App />
                    </ErrorModalProvider>
                </ToastProvider>
            </ThemeProvider>
        );
        user = userEvent.setup();
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

        // Confirm last_watered timestamps of first 2 plants say "yesterday"
        expect(within(plantsCol).queryAllByText('yesterday').length).toBe(2);
        // Confirm last_watered timestamp of last plant says "Never watered"
        expect(within(plantsCol).queryAllByText('Never watered').length).toBe(1);

        // Simulate user selecting 2 days ago in datetime input, click Water All
        simulateUserDatetimeInput('2024-02-28T12:45:00.000Z');
        await user.click(app.getByText("Water All"));

        // Confirm last_watered for first 2 plants didn't change (new timestamp
        // older than existing), confirm last plant now says "2 days ago"
        expect(within(plantsCol).queryAllByText('yesterday').length).toBe(2);
        expect(within(plantsCol).queryAllByText('2 days ago').length).toBe(1);

        // Simulate user selecting 15 min ago in datetime input, click Water All
        simulateUserDatetimeInput('2024-03-01T19:45:00.000Z');
        await user.click(app.getByText("Water All"));

        // Confirm all last_watered changed (new timestamp newer than existing)
        expect(within(plantsCol).queryAllByText('yesterday').length).toBe(0);
        expect(within(plantsCol).queryAllByText('today').length).toBe(3);
    });

    // Original bug: Plant filter input included results where the UUID,
    // last_watered timestamp, or thumbnail URL matched the user's query.
    it('does not match match UUIDs, timestamps, or URLs when filtering', async () => {
        const plantColumn = app.getByText('Plants (3)').parentElement;
        const filterInput = within(plantColumn).getByRole('textbox');

        // Type part of UUID in input, should remove all cards
        await userEvent.type(filterInput, '0640');
        expect(plantColumn.querySelectorAll('.card').length).toBe(0);

        // Type part of timsetamp in input, should remove all cards
        await userEvent.clear(filterInput);
        await userEvent.type(filterInput, '2024-03-01');
        expect(plantColumn.querySelectorAll('.card').length).toBe(0);

        // Type part of thumbnail URL in input, should remove all cards
        await userEvent.clear(filterInput);
        await userEvent.type(filterInput, 'photo_thumb');
        expect(plantColumn.querySelectorAll('.card').length).toBe(0);
    });
});
