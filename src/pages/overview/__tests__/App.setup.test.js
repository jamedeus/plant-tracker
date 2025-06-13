import createMockContext from 'src/testUtils/createMockContext';
import bulkCreateMockContext from 'src/testUtils/bulkCreateMockContext';
import { mockContext } from './mockContext';
import App from '../App';

jest.mock('print-js');

describe('App with empty database', () => {
    let app, user;

    beforeAll(() => {
        // Create mock state objects
        bulkCreateMockContext({ ...mockContext,
            plants: {},
            groups: {},
            show_archived: false
        });
        createMockContext('user_accounts_enabled', true);
    });

    beforeEach(() => {
        // Clear sessionStorage (cached sortDirection, sortKey)
        sessionStorage.clear();
        // Render app + create userEvent instance to use in tests
        user = userEvent.setup();
        app = render(<App />);
    });

    it('opens modal when Print QR Codes button clicked', async () => {
        // Confirm modal has not been opened
        expect(HTMLDialogElement.prototype.showModal).not.toHaveBeenCalled();
        expect(app.queryByText('96 QR codes per sheet')).toBeNull();

        // Click Print QR Codes button, confirm modal opened
        await user.click(app.getByRole("button", {name: "Print QR Codes"}));
        expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalled();
        expect(app.queryByText(/QR codes per sheet/)).not.toBeNull();
    });
});
