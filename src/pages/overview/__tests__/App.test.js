import createMockContext from 'src/testUtils/createMockContext';
import { postHeaders } from 'src/testUtils/headers';
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
        createMockContext('trays', mockContext.trays);
    });

    beforeEach(() => {
        // Render app + create userEvent instance to use in tests
        app = render(
            <ThemeProvider>
                <ErrorModalProvider>
                    <App />
                </ErrorModalProvider>
            </ThemeProvider>
        );
        user = userEvent.setup();

        // Reset all mocks to isolate tests
        jest.resetAllMocks();
    });

    it('opens modal when Print QR Codes dropdown option clicked', async () => {
        // Confirm modal has not been opened
        expect(HTMLDialogElement.prototype.showModal).not.toHaveBeenCalled();

        // Click Print QR Codes dropdown option, confirm modal opened
        await user.click(app.getByText("Print QR Codes"));
        expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalled();
    });

    it('shows checkboxes and delete button when edit option clicked', async () => {
        // Confirm delete button and checkboxes are not visible
        expect(app.queryByText('Delete')).toBeNull();
        expect(app.container.querySelectorAll('.radio').length).toBe(0);

        // Click Edit option, confirm buttons and checkboxes appear
        await user.click(app.getByText("Edit"));
        expect(app.getByText('Delete').nodeName).toBe('BUTTON');
        expect(app.container.querySelectorAll('.radio').length).not.toBe(0);

        // Click cancel button, confirm buttons and checkboxes disappear
        const buttonDiv = app.container.querySelector('.sticky.bottom-4');
        await user.click(within(buttonDiv).getByText('Cancel'));
        expect(app.queryByText('Delete')).toBeNull();
        expect(app.container.querySelectorAll('.radio').length).toBe(0);
    });

    it('sends correct payload when plants are deleted', async () => {
        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                "deleted": "uuid"
            })
        }));

        // Click edit option, click first checkbox (plant)
        await user.click(app.getByText("Edit"));
        await user.click(app.container.querySelectorAll('.radio')[0]);

        // Click delete button in floating div
        await user.click(app.getByText('Delete'));

        // Confirm correct data posted to /delete_plant endpoint
        expect(global.fetch).toHaveBeenCalledWith('/delete_plant', {
            method: 'POST',
            body: JSON.stringify({
                "plant_id": "0640ec3b-1bed-4b15-a078-d6e7ec66be12"
            }),
            headers: postHeaders
        });
    });

    it('sends correct payload when trays are deleted', async () => {
        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                "deleted": "uuid"
            })
        }));

        // Click edit option, click second checkbox (tray)
        await user.click(app.getByText("Edit"));
        await user.click(app.container.querySelectorAll('.radio')[1]);

        // Click delete button in floating div
        await user.click(app.getByText('Delete'));

        // Confirm correct data posted to /delete_tray endpoint
        expect(global.fetch).toHaveBeenCalledWith('/delete_tray', {
            method: 'POST',
            body: JSON.stringify({
                "tray_id": "0640ec3b-1bed-4b15-a078-d6e7ec66be14"
            }),
            headers: postHeaders
        });
    });
});
