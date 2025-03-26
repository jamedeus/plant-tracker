import createMockContext from 'src/testUtils/createMockContext';
import Timeline from '../Timeline';
import { TimelineProvider } from '../TimelineContext';
import { formatEvents } from '../App';
import { PageWrapper } from 'src/index';
import { mockContext, mockEvents, mockPhotoUrls } from './mockContext';

describe('Timeline', () => {
    let app, user;

    beforeAll(() => {
        // Create mock state object
        createMockContext('notes', mockContext.notes);
        createMockContext('photo_urls', mockPhotoUrls);
    });

    beforeEach(() => {
        const formattedEvents = formatEvents(mockEvents);

        // Render app + create userEvent instance to use in tests
        user = userEvent.setup();
        app = render(
            <PageWrapper>
                <TimelineProvider formattedEvents={formattedEvents}>
                    <Timeline
                        plantID='0640ec3b-1bed-4b15-a078-d6e7ec66be12'
                        formattedEvents={formattedEvents}
                        archived={false}
                    />
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

    it('opens PhotoModal when dropdown option clicked', async () => {
        // Confirm modal is not open
        expect(app.queryByTestId('photo-input')).toBeNull();

        // Click button, confirm HTMLDialogElement method was called
        await user.click(app.getByText('Add photos'));
        // expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalled();
        await waitFor(() => {
            expect(app.queryByTestId('photo-input')).not.toBeNull();
        });
    });

    it('opens DeletePhotosModal when dropdown option clicked', async () => {
        // Confirm modal is not open
        expect(app.container.querySelector('#photo0')).toBeNull();

        // Click button, confirm HTMLDialogElement method was called
        await user.click(app.getByText('Delete photos'));
        expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalled();
        await waitFor(() => {
            expect(app.container.querySelector('#photo24')).not.toBeNull();
        });
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

    it('opens note modal when add note dropdown option is clicked', async () => {
        // Confirm note modal is not visible
        expect(app.queryByText('0 / 500')).toBeNull();

        // Click dropdown option, confirm HTMLDialogElement method was called
        await user.click(app.getByText('Add note'));
        expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalled();
        expect(app.getByText('0 / 500')).not.toBeNull();
    });

    it('renders new notes in the timeline', async () => {
        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({
                "action": "add_note",
                "plant": "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
                "timestamp": "2024-03-01T12:00:00+00:00",
                "note_text": "Started flowering"
            })
        }));

        // Get reference to timeline div (excluding NoteModal)
        const timeline = app.container.querySelector('.grid');

        // Confirm timeline does not contain note text
        expect(within(timeline).queryByText(
            'Started flowering'
        )).toBeNull();

        // Open Note Modal
        await user.click(app.getByText('Add note'));

        // Simulate user typing new note and clicking save
        await user.type(
            app.container.querySelector('.textarea'),
            '  Started flowering  '
        );
        await user.click(app.getByText('Save'));

        // Confirm note text appeared on page
        expect(within(timeline).queryByText(
            'Started flowering'
        )).not.toBeNull();
    });

    it('updates note text in timeline when note is edited', async () => {
        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({
                "action": "edit_note",
                "plant": "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
                "timestamp": "2024-02-26T12:44:12+00:00",
                "note_text": "One of the older leaves is starting to turn yellow, pinched it off"
            })
        }));

        // Get reference to timeline div (excluding NoteModal)
        const timeline = app.container.querySelector('.grid');

        // Confirm timeline contains note text from mockContext
        expect(within(timeline).queryByText(
            'One of the older leaves is starting to turn yellow'
        )).not.toBeNull();
        // Confirm timeline does not contain text we will add
        expect(within(timeline).queryByText(
            /pinched it off/
        )).toBeNull();

        // Simulate user clicking icon next to note, adding text, clicking save
        const editButton = within(timeline).getByText(
            'One of the older leaves is starting to turn yellow'
        ).parentElement.parentElement.children[0];
        await user.click(editButton);
        await user.type(
            app.container.querySelector('.textarea'),
            ', pinched it off'
        );
        await user.click(app.getByText('Save'));

        // Confirm new text was added to note
        expect(within(timeline).queryByText(
            'One of the older leaves is starting to turn yellow, pinched it off'
        )).not.toBeNull();
    });

    it('removes notes from timeline when deleted', async () => {
        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({
                "deleted": "note",
                "plant": "0640ec3b-1bed-4b15-a078-d6e7ec66be12"
            })
        }));

        // Get reference to timeline div (excluding NoteModal)
        const timeline = app.container.querySelector('.grid');

        // Confirm timeline contains note text
        expect(within(timeline).queryByText(
            'Fertilized with dilute 10-15-10 liquid fertilizer'
        )).not.toBeNull();

        // Simulate user clicking icon next to note, then clicking delete
        const editButton = within(timeline).getByText(
            'Fertilized with dilute 10-15-10 liquid fertilizer'
        ).parentElement.parentElement.children[0];
        await user.click(editButton);
        await user.click(
            within(app.getByText('Edit Note').parentElement).getByText('Delete')
        );

        // Confirm timeline no longer contains note text
        expect(within(timeline).queryByText(
            'Fertilized with dilute 10-15-10 liquid fertilizer'
        )).toBeNull();
    });
});
