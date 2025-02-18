import createMockContext from 'src/testUtils/createMockContext';
import { PageWrapper } from 'src/index';
import App from '../App';

jest.mock('print-js');

describe('App with empty database', () => {
    let app, user;

    beforeAll(() => {
        // Create mock state objects
        createMockContext('plants', []);
        createMockContext('groups', []);
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

    it('opens modal when Print QR Codes button clicked', async () => {
        // Confirm modal has not been opened
        expect(HTMLDialogElement.prototype.showModal).not.toHaveBeenCalled();

        // Click Print QR Codes button, confirm modal opened
        await user.click(app.getByRole("button", {name: "Print QR Codes"}));
        expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalled();
    });
});
