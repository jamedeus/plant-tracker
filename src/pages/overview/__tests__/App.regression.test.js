import createMockContext from 'src/testUtils/createMockContext';
import { ThemeProvider } from 'src/context/ThemeContext';
import { ErrorModalProvider } from 'src/context/ErrorModalContext';
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
        // Render app + create userEvent instance to use in tests
        user = userEvent.setup();
        app = render(
            <ThemeProvider>
                <ErrorModalProvider>
                    <App />
                </ErrorModalProvider>
            </ThemeProvider>
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
        expect(plantColumn.querySelectorAll('.card').length).toBe(0);
        expect(groupColumn.querySelectorAll('.card').length).toBe(0);

        // Type part of timsetamp in plant input, should remove all cards
        await user.clear(plantFilterInput);
        await user.type(plantFilterInput, '2024-02-26');
        expect(plantColumn.querySelectorAll('.card').length).toBe(0);

        // Type part of thumbnail URL in plant input, should remove all cards
        await user.clear(plantFilterInput);
        await user.type(plantFilterInput, 'photo_thumb');
        expect(plantColumn.querySelectorAll('.card').length).toBe(0);
    });
});
