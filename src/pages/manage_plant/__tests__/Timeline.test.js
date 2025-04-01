import createMockContext from 'src/testUtils/createMockContext';
import Timeline from '../Timeline';
import { TimelineProvider } from '../TimelineContext';
import { PageWrapper } from 'src/index';
import { mockContext, mockEvents, mockPhotoUrls } from './mockContext';

describe('Timeline', () => {
    let app, user;

    beforeAll(() => {
        // Create mock state object
        createMockContext('events', mockEvents);
        createMockContext('notes', mockContext.notes);
        createMockContext('photo_urls', mockPhotoUrls);
    });

    beforeEach(() => {
        // Render app + create userEvent instance to use in tests
        user = userEvent.setup();
        app = render(
            <PageWrapper>
                <TimelineProvider>
                    <Timeline archived={false} />
                </TimelineProvider>
            </PageWrapper>
        );
    });

    it('expands quick navigation subsections when user hovers', async () => {
        // Get reference to History title, dropdown menu, and first subsection
        const history = app.getByText(/History/);
        const dropdown = history.parentElement.children[1];
        const yearSection = dropdown.children[0].children[0];

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
        const history = app.getByText(/History/).parentElement;

        // Confirm scrollIntoView has not been called
        expect(window.HTMLElement.prototype.scrollIntoView).not.toHaveBeenCalled();

        // Click year and month in history menu
        await user.click(history);
        await user.click(within(history).getByText(/2023/));
        await user.click(within(history).getByText(/December/));

        // Confirm scrollIntoView was called
        expect(window.HTMLElement.prototype.scrollIntoView).toHaveBeenCalled();
    });

    it('opens photo popover when thumbnails are clicked', async () => {
        // Confirm no popover div exists
        expect(document.body.querySelector(
            '#react-tiny-popover-container'
        )).toBeNull();

        // Click image thumbnail, confirm popover appears
        await user.click(app.getAllByRole('img')[0]);
        expect(document.body.querySelector(
            '#react-tiny-popover-container'
        )).not.toBeNull();

        // Click outside, confirm popover closed
        await user.click(document.body);
        expect(document.body.querySelector(
            '#react-tiny-popover-container'
        )).toBeNull();
    });

    it('expands/collapses note text when clicked', async () => {
        // Get reference to note div, confirm is collapsed (default)
        const note = within(app.container.querySelector('.grid')).queryByText(
            'Fertilized with dilute 10-15-10 liquid fertilizer'
        );
        expect(note.parentElement.classList).toContain('line-clamp-1');

        // Click note, confirm expanded (line clamp class removed)
        await user.click(note);
        expect(note.parentElement.classList).not.toContain('line-clamp-1');

        // Click again, confirm collapsed (line clamp class added)
        await user.click(note);
        await waitFor(() => {
            expect(note.parentElement.classList).toContain('line-clamp-1');
        });
    });
});
