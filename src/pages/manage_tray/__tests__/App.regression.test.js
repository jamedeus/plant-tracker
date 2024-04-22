import { render } from '@testing-library/react';
import userEvent from "@testing-library/user-event";
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

    beforeEach(() => {
        // Create mock state objects
        createMockContext('tray', mockContext.tray);
        createMockContext('details', mockContext.details);
        createMockContext('options', mockContext.options);

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
                    "19f65fa0-1c75-4cba-b590-0c9b5b315fcc"
                ],
                "failed": []
            })
        }));

        // Confirm last_watered timestamps say "14 hours ago"
        expect(app.queryAllByText(/14 hours ago/).length).toBe(4);

        // Simulate user selecting 2 days ago in datetime input, click Water All
        simulateUserDatetimeInput('2024-02-28T05:45:00.000Z');
        await user.click(app.getByText("Water All"));

        // Confirm last_watered did not change (new timestamp older than existing)
        expect(app.queryAllByText(/14 hours ago/).length).toBe(4);

        // Simulate user selecting 15 min ago in datetime input, click Water All
        simulateUserDatetimeInput('2024-03-01T19:45:00.000Z');
        await user.click(app.getByText("Water All"));

        // Confirm last_watered changed (new timestamp newer than existing)
        expect(app.queryAllByText(/14 hours ago/).length).toBe(0);
        expect(app.queryAllByText(/15 minutes ago/).length).toBe(4);
    });
});
