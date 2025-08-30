import App from '../App';

jest.mock('print-js');

describe('App with empty database', () => {
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
        app = render(<App initialState={{
            plants: {},
            groups: {},
            show_archive: false,
            title: 'Plant Overview'
        }} />);
    });

    it('opens modal when Print QR Codes button clicked', async () => {
        // Confirm modal has not been opened
        expect(HTMLDialogElement.prototype.showModal).not.toHaveBeenCalled();
        expect(app.queryByText('96 QR codes per sheet')).toBeNull();

        // Click Print QR Codes button, confirm modal opened
        await user.click(app.getByRole("button", {name: "Print QR Codes"}));
        expect(app.queryByText(/QR codes per sheet/)).not.toBeNull();
    });
});
