import createMockContext from 'src/testUtils/createMockContext';
import Timeline from '../Timeline';
import { NoteModalProvider } from '../NoteModal';
import { ToastProvider } from 'src/context/ToastContext';
import { ErrorModalProvider } from 'src/context/ErrorModalContext';
import { mockContext, mockEvents, mockPhotoUrls } from './mockContext';

describe('App', () => {
    let app, user;

    beforeAll(() => {
        // Create mock state object
        createMockContext('notes', mockContext.notes);
    });

    beforeEach(() => {
        // Render app + create userEvent instance to use in tests
        app = render(
            <ErrorModalProvider>
                <ToastProvider>
                    <NoteModalProvider>
                        <Timeline
                            plantID={"0640ec3b-1bed-4b15-a078-d6e7ec66be12"}
                            events={mockEvents}
                            photoUrls={mockPhotoUrls}
                        />
                    </NoteModalProvider>
                </ToastProvider>
            </ErrorModalProvider>
        );
        user = userEvent.setup();
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

    it('opens note modal when add note dropdown option is clicked', async () => {
        // Click dropdown option, confirm HTMLDialogElement method was called
        await user.click(app.getByText('Add note'));
        expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalled();
    });

    it('renders new notes in the timeline', async () => {
        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({
                "action": "add_note",
                "plant": "0640ec3b-1bed-4b15-a078-d6e7ec66be12"
            })
        }));

        // Get reference to timeline div (excluding NoteModal)
        const timeline = app.container.querySelector('.grid');

        // Confirm timeline does not contain note text
        expect(within(timeline).queryByText(
            'Some leaves turning yellow, probably watering too often'
        )).toBeNull();

        // Simulate user typing new note and clicking save
        await user.type(
            app.container.querySelector('.textarea'),
            'Some leaves turning yellow, probably watering too often'
        );
        await user.click(app.getByText('Save'));

        // Confirm note text appeared on page
        expect(within(timeline).queryByText(
            'Some leaves turning yellow, probably watering too often'
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
        ).parentElement.children[0];
        await user.click(editButton);
        await user.click(app.getByText('Delete'));

        // Confirm timeline no longer contains note text
        expect(within(timeline).queryByText(
            'Fertilized with dilute 10-15-10 liquid fertilizer'
        )).toBeNull();
    });
});
