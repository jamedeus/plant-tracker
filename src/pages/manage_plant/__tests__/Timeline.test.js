import mockCurrentURL from 'src/testUtils/mockCurrentURL';
import Timeline from '../Timeline';
import { ReduxProvider } from '../store';
import { Toast } from 'src/components/Toast';
import { ErrorModal } from 'src/components/ErrorModal';
import { mockContext, mockEvents, mockphotos } from './mockContext';

describe('Timeline', () => {
    let app, user;

    beforeAll(() => {
        // Simulate SINGLE_USER_MODE disabled on backend
        globalThis.USER_ACCOUNTS_ENABLED = true;
    });

    beforeEach(() => {
        // Mock window.location (querystring parsed when page loads)
        mockCurrentURL('https://plants.lan/manage/e1393cfd-0133-443a-97b1-06bb5bd3fcca');

        // Render app + create userEvent instance to use in tests
        user = userEvent.setup();
        app = render(
            <>
                <ReduxProvider initialState={{ ...mockContext, events: mockEvents, photos: mockphotos }}>
                    <Timeline openRepotModal={jest.fn()} />
                </ReduxProvider>
                <Toast />
                <ErrorModal />
            </>
        );
    });

    it('scrolls to timeline when quick navigation is clicked', async () => {
        // Get reference to History title (contains quick nav dropdown)
        const history = app.getByText(/History/).closest('.dropdown');

        // Confirm scrollIntoView has not been called
        expect(window.HTMLElement.prototype.scrollIntoView).not.toHaveBeenCalled();

        // Click year and month in history menu
        await user.click(history);
        await user.click(within(history).getByText(/2023/));
        await user.click(within(history).getByText(/December/));

        // Confirm scrollIntoView was called
        expect(window.HTMLElement.prototype.scrollIntoView).toHaveBeenCalled();
    });

    it('expands/collapses note text when clicked', async () => {
        // Get reference to note div, confirm is collapsed (default)
        const note = app.queryByText(
            'Fertilized with dilute 10-15-10 liquid fertilizer'
        );
        // NOTE: Non-breaking space between HH:MM and AM, will fail without
        expect(
            app.getByTitle('07:45 AM - March 1, 2024').classList
        ).toContain('line-clamp-1');

        // Click note, confirm expanded (line clamp class removed)
        await user.click(note);
        expect(
            app.getByTitle('07:45 AM - March 1, 2024').classList
        ).not.toContain('line-clamp-1');

        // Click again, confirm collapsed (line clamp class added)
        await user.click(note);
        await waitFor(() => {
            expect(
                app.getByTitle('07:45 AM - March 1, 2024').classList
            ).toContain('line-clamp-1');
        });
    });
});
