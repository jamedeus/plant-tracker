import createMockContext from 'src/testUtils/createMockContext';
import bulkCreateMockContext from 'src/testUtils/bulkCreateMockContext';
import Timeline from '../Timeline';
import { ReduxProvider } from '../store';
import { PageWrapper } from 'src/index';
import { mockContext, mockEvents, mockphotos } from './mockContext';

describe('Timeline', () => {
    let app, user;

    beforeAll(() => {
        // Create mock state object
        bulkCreateMockContext(mockContext);
        createMockContext('user_accounts_enabled', true);
        // Override events and photos states with mocks containing more items
        createMockContext('events', mockEvents);
        createMockContext('photos', mockphotos);
    });

    beforeEach(() => {
        // Render app + create userEvent instance to use in tests
        user = userEvent.setup();
        app = render(
            <PageWrapper>
                <ReduxProvider>
                    <Timeline />
                </ReduxProvider>
            </PageWrapper>
        );
    });

    it('expands quick navigation subsections when user hovers', async () => {
        // Get reference to History title and first subsection in dropdown menu
        const history = app.getByText(/History/);
        const yearSection = history.nextSibling.querySelector('details');

        // Confirm year subsection is closed
        expect(yearSection).toHaveProperty('open', false);

        // Click history and hover over subsection, confirm subsection opens
        await user.click(history);
        await user.hover(yearSection);
        expect(yearSection).toHaveProperty('open', true);

        // Unhover, confirm subsection closes
        await user.unhover(yearSection);
        expect(yearSection).toHaveProperty('open', false);
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
