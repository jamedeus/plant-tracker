import mockCurrentURL from 'src/testUtils/mockCurrentURL';
import mockPlantSpeciesOptionsResponse from 'src/testUtils/mockPlantSpeciesOptionsResponse';
import { within } from '@testing-library/react';
import { postHeaders } from 'src/testUtils/headers';
import mockFetchResponse from 'src/testUtils/mockFetchResponse';
import App from '../App';
import { Toast } from 'src/components/Toast';
import { ErrorModal } from 'src/components/ErrorModal';
import { mockContext, mockGroupOptions } from './mockContext';

// Mock the global navigate function used by sendPostRequest
jest.mock('src/navigate', () => ({
    navigate: jest.fn(),
    setNavigate: jest.fn(),
}));
import { navigate as globalMockNavigate } from 'src/navigate';

describe('App', () => {
    let app, user;

    beforeAll(() => {
        // Simulate SINGLE_USER_MODE disabled on backend
        globalThis.USER_ACCOUNTS_ENABLED = true;
    });

    beforeEach(() => {
        // Allow fast forwarding (must hold delete note button to confirm)
        jest.useFakeTimers({ doNotFake: ['Date'] });

        // Mock window.location (querystring parsed when page loads)
        mockCurrentURL('https://plants.lan/manage/e1393cfd-0133-443a-97b1-06bb5bd3fcca');

        // Render app + create userEvent instance to use in tests
        user = userEvent.setup({ advanceTimers: jest.advanceTimersByTimeAsync });
        app = render(
            <>
                <App initialState={mockContext} />
                <Toast />
                <ErrorModal />
            </>
        );
    });

    // Clean up pending timers after each test
    afterEach(() => {
        act(() => jest.runOnlyPendingTimers());
        jest.useRealTimers();
    });

    it('opens TitleDrawer with plant details when title is clicked', async () => {
        // Confirm title drawer is closed by default
        const titleDrawer = app.getByTestId('title-drawer');
        expect(titleDrawer.classList).not.toContain('title-drawer-open');

        // Click title, confirm drawer opens
        await user.click(app.getByText('Test Plant'));
        expect(titleDrawer.classList).toContain('title-drawer-open');

        // Click title again, confirm drawer closes
        await user.click(app.getByText('Test Plant'));
        expect(titleDrawer.classList).not.toContain('title-drawer-open');

        // Open again
        await user.click(app.getByText('Test Plant'));
        expect(titleDrawer.classList).toContain('title-drawer-open');

        // Click page outside of drawer, confirm drawer closes
        await user.click(app.getByText('History'));
        expect(titleDrawer.classList).not.toContain('title-drawer-open');
    });

    it('sends correct payload when edit modal is submitted', async () => {
        // Confirm details changed section not rendered in timeline
        expect(app.queryByText(/Name changed to/)).toBeNull();
        expect(app.queryByText(/Species changed to/)).toBeNull();
        expect(app.queryByText(/Description changed/)).toBeNull();
        expect(app.queryByText(/Pot Size changed to/)).toBeNull();

        // Mock /get_plant_species_options response (requested when modal opens)
        mockPlantSpeciesOptionsResponse();

        // Open edit modal, confirm fetched species options
        await user.click(app.getByRole('button', {name: 'Edit Details'}));
        await act(async () => await jest.advanceTimersByTimeAsync(100));
        expect(global.fetch).toHaveBeenCalledWith('/get_plant_species_options');

        // Mock fetch function to return expected response
        mockFetchResponse({
            name_before: null,
            name_after: "Test Plant",
            species_before: null,
            species_after: "Calathea",
            pot_size_before: null,
            pot_size_after: 4,
            description_before: null,
            description_after: "This is a plant with a long description",
        });

        // Click submit button inside edit modal
        const modal = document.body.querySelector(".modal-box");
        await user.click(within(modal).getByText("Edit"));
        await act(async () => await jest.advanceTimersByTimeAsync(100));

        // Confirm correct data posted to /edit_plant_details endpoint
        expect(global.fetch).toHaveBeenCalledWith('/edit_plant_details', {
            method: 'POST',
            body: JSON.stringify({
                plant_id: "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
                name: "Test Plant",
                species: "Calathea",
                pot_size: "4",
                description: "This is a plant with a long description",
            }),
            headers: postHeaders
        });

        // Confirm details changed section appeared in timeline
        expect(app.queryByText(/Name changed to/)).toBeInTheDocument();
        expect(app.queryByText(/Species changed to/)).toBeInTheDocument();
        expect(app.queryByText(/Description changed/)).toBeInTheDocument();
        expect(app.queryByText(/Pot Size changed to/)).toBeInTheDocument();
    });

    it('disables edit modal submit button when fields are too long', async () => {
        // Mock /get_plant_species_options response (requested when modal opens)
        mockPlantSpeciesOptionsResponse();

        // Open edit modal
        await user.click(app.getByRole('button', {name: 'Edit Details'}));
        await act(async () => await jest.advanceTimersByTimeAsync(100));

        // Get fields with length limits + edit button
        const modal = document.body.querySelector(".modal-box");
        const editButton = within(modal).getByRole("button", {name: "Edit"});
        const nameField = within(modal).getByRole('textbox', {name: 'Plant name'});
        const speciesField = within(modal).getByRole('combobox', {name: 'Plant species'});
        const descriptionField = within(modal).getByRole('textbox', {name: 'Description'});

        // Confirm edit button is enabled
        expect(editButton).not.toBeDisabled();

        // Type >50 characters in Plant name field, confirm edit button is disabled
        await user.type(nameField, '.'.repeat(51));
        expect(editButton).toBeDisabled();
        await user.clear(nameField);

        // Type >50 characters in species field, confirm edit button is disabled
        await user.type(speciesField, '.'.repeat(51));
        expect(editButton).toBeDisabled();
        await user.clear(speciesField);

        // Type >500 characters in description field, confirm edit button is disabled
        await user.type(descriptionField, '.'.repeat(501));
        expect(editButton).toBeDisabled();
    });

    it('sends correct payload when plant is watered', async () => {
        // Mock fetch function to return expected response
        mockFetchResponse({
            action: "water",
            timestamp: "2024-03-01T20:00:00+00:00",
            plant: "0640ec3b-1bed-4b15-a078-d6e7ec66be12"
        });

        // Click water button
        await user.click(app.getByRole("button", {name: "Water"}));

        // Confirm correct data posted to /add_plant_event endpoint
        expect(global.fetch).toHaveBeenCalledWith('/add_plant_event', {
            method: 'POST',
            body: JSON.stringify({
                plant_id: "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
                event_type: "water",
                timestamp: "2024-03-01T20:00:00.000Z"
            }),
            headers: postHeaders
        });
    });

    it('sends correct payload when plant is fertilized', async () => {
        // Mock fetch function to return expected response
        mockFetchResponse({
            action: "fertilize",
            timestamp: "2024-03-01T20:00:00+00:00",
            plant: "0640ec3b-1bed-4b15-a078-d6e7ec66be12"
        });

        // Click fertilize button
        await user.click(app.getByRole("button", {name: "Fertilize"}));

        // Confirm correct data posted to /add_plant_event endpoint
        expect(global.fetch).toHaveBeenCalledWith('/add_plant_event', {
            method: 'POST',
            body: JSON.stringify({
                plant_id: "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
                event_type: "fertilize",
                timestamp: "2024-03-01T20:00:00.000Z"
            }),
            headers: postHeaders
        });
    });

    it('sends correct payload when plant is pruned', async () => {
        // Mock fetch function to return expected response
        mockFetchResponse({
            action: "prune",
            timestamp: "2024-03-01T20:00:00+00:00",
            plant: "0640ec3b-1bed-4b15-a078-d6e7ec66be12"
        });

        // Click prune button
        await user.click(app.getByRole("button", {name: "Prune"}));

        // Confirm correct data posted to /add_plant_event endpoint
        expect(global.fetch).toHaveBeenCalledWith('/add_plant_event', {
            method: 'POST',
            body: JSON.stringify({
                plant_id: "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
                event_type: "prune",
                timestamp: "2024-03-01T20:00:00.000Z"
            }),
            headers: postHeaders
        });
    });

    it('shows error toast if duplicate event error received', async() => {
        // Mock fetch function to return error response
        mockFetchResponse({error: "event with same timestamp already exists"}, 409);

        // Click water button
        await user.click(app.getByRole("button", {name: "Water"}));
    });

    // Note: this response can only be received if SINGLE_USER_MODE is disabled
    it('redirects to login page if events added while user not signed in', async () => {
        // Mock fetch function to simulate user with an expired session
        mockFetchResponse({error: "authentication required"}, 401);

        // Click water button
        await user.click(app.getByRole("button", {name: "Water"}));

        // Confirm redirected
        expect(globalMockNavigate).toHaveBeenCalledWith('/accounts/login/');
    });

    it('sends correct payload when "Remove from group" clicked', async () => {
        // Mock fetch function to return expected response
        mockFetchResponse({
            action: "remove_plant_from_group",
            plant: "0640ec3b-1bed-4b15-a078-d6e7ec66be12"
        });

        // Click "Remove from group" button in details dropdown
        await user.click(app.getByTitle(/Remove plant from group/));

        // Confirm correct data posted to /remove_plant_from_group endpoint
        expect(global.fetch).toHaveBeenCalledWith('/remove_plant_from_group', {
            method: 'POST',
            body: JSON.stringify({
                plant_id: "0640ec3b-1bed-4b15-a078-d6e7ec66be12"
            }),
            headers: postHeaders
        });
    });

    it('scrolls to timeline when calendar day with events is clicked', async () => {
        // Click calendar day with no events, confirm scrollIntoView NOT called
        await user.click(app.getByLabelText('March 10, 2024'));
        expect(window.HTMLElement.prototype.scrollIntoView).not.toHaveBeenCalled();

        // Click calendar day with events, confirm scrollIntoView called
        await user.click(app.getByLabelText('March 1, 2024'));
        expect(window.HTMLElement.prototype.scrollIntoView).toHaveBeenCalled();
    });

    it('shows calendar month navigation when title is clicked', async () => {
        // Get reference to calendar, confirm shows current month
        const calendar = app.container.querySelector('.react-calendar');
        expect(calendar.querySelector('.react-calendar__month-view')).not.toBeNull();
        expect(calendar.querySelector('.react-calendar__year-view')).toBeNull();

        // Click calendar title, confirm changed to year view
        await user.click(within(calendar).getByText("March 2024"));
        expect(calendar.querySelector('.react-calendar__month-view')).toBeNull();
        expect(calendar.querySelector('.react-calendar__year-view')).not.toBeNull();
    });

    it('changes calendar month when user swipes left or right', async () => {
        // Confirm initial calendar month matches date mock
        const calendar = app.container.querySelector('.react-calendar');
        expect(within(calendar).getByRole('button', {name: 'March 2024'})).not.toBeNull();

        // Simulate user swiping left, confirm changed to previous month
        fireEvent.touchStart(calendar, {touches: [{ clientX: 50, clientY: 100 }]});
        fireEvent.touchMove(calendar, {touches: [{ clientX:  100, clientY: 100 }]});
        fireEvent.touchEnd(calendar, {changedTouches: [{ clientX:  100, clientY: 100 }]});
        expect(within(calendar).queryByRole('button', {name: 'March 2024'})).toBeNull();
        expect(within(calendar).getByRole('button', {name: 'February 2024'})).not.toBeNull();

        // Simulate user swiping right, confirm changed to next month
        fireEvent.touchStart(calendar, {touches: [{ clientX: 100, clientY: 100 }]});
        fireEvent.touchMove(calendar, {touches: [{ clientX:  50, clientY: 100 }]});
        fireEvent.touchEnd(calendar, {changedTouches: [{ clientX:  50, clientY: 100 }]});
        expect(within(calendar).queryByRole('button', {name: 'February 2024'})).toBeNull();
        expect(within(calendar).getByRole('button', {name: 'March 2024'})).not.toBeNull();
    });

    it('does not fetch new state when other pageshow events are triggered', () => {
        // Simulate pageshow event with persisted == false (ie initial load)
        const pageshowEvent = new Event('pageshow');
        Object.defineProperty(pageshowEvent, 'persisted', { value: false });
        act(() => window.dispatchEvent(pageshowEvent));

        // Confirm did not call fetch
        expect(global.fetch).not.toHaveBeenCalled();
    });

    it('opens default photo in gallery when photo in details dropdown clicked', async () => {
        // Confirm gallery div does not exist
        expect(document.body.querySelector('.yarl__root')).toBeNull();

        // Click default photo in details dropdown, confirm gallery appears
        await user.click(app.getByTestId('defaultPhotoThumbnail'));
        await act(async () => await jest.advanceTimersByTimeAsync(500));
        expect(document.body.querySelector('.yarl__root')).not.toBeNull();
        // Confirm visible slide src is full-res version of default photo
        expect(document.querySelector('.yarl__slide_current img').src).toBe(
            app.getByTestId('defaultPhotoThumbnail').src
                .replace('/media/previews', '/media/images')
                .replace('_preview.webp', '.jpg')
        );
    });

    it('opens PhotoModal when dropdown option clicked', async () => {
        // Confirm modal is not open
        expect(app.queryByTestId('photo-input')).toBeNull();

        // Click button in dropdown, confirm modal appears
        await user.click(app.getByText('Add photos'));
        await waitFor(() => {
            expect(app.queryByTestId('photo-input')).not.toBeNull();
        });
    });

    it('opens DivisionModal when dropdown option clicked', async () => {
        // Confirm modal is not open
        expect(app.queryByText('When did you divide your plant?')).toBeNull();

        // Click button in dropdown, confirm modal appears
        await user.click(app.getByText('Divide plant'));
        await waitFor(() => {
            expect(app.queryByText('When did you divide your plant?')).not.toBeNull();
        });
    });

    it('opens group modal when details dropdown button clicked', async () => {
        // Confirm modal is not rendered
        expect(app.queryByText('Add plant to group')).toBeNull();

        // Click remove from group button (re-renders with add to group option)
        await user.click(app.getByTitle(/Remove plant from group/));

        // Mock fetch to return group options (requested when modal opened)
        mockFetchResponse({ options: mockGroupOptions });

        // Click "Add to group" button in details dropdown
        await user.click(app.getByTitle(/Add plant to group/));

        // Confirm modal is rendered
        expect(app.getByText('Add plant to group')).toBeInTheDocument();
    });

    it('removes event markers from timeline when events are deleted', async () => {
        // Mock fetch function to return expected response
        mockFetchResponse({
            deleted: {
                water: [
                    "2024-03-01T15:45:44+00:00",
                    "2024-02-29T10:20:15+00:00",
                ],
                fertilize: [],
                prune: [],
                repot: []
            },
            failed: {
                water: [],
                fertilize: [],
                prune: [],
                repot: []
            }
        });

        // Confirm 2 water event icons exist
        expect(app.container.querySelectorAll('.fa-inline.text-info').length).toBe(2);

        // Start deleting events, select both water events, click delete button
        await user.click(app.getByText('Edit timeline'));
        await user.click(
            within(app.getByTestId("2024-03-01-events")).getByText("Watered")
        );
        await user.click(
            within(app.getByTestId("2024-02-29-events")).getByText("Watered")
        );
        // Simulate user holding delete button for 1.5 seconds
        const button1 = app.getByText('Delete');
        fireEvent.pointerDown(button1);
        await act(async () => await jest.advanceTimersByTimeAsync(1500));
        fireEvent.pointerUp(button1);

        // Confirm both water event icons disappeared
        expect(app.container.querySelectorAll('.fa-inline.text-info').length).toBe(0);
    });

    it('opens note modal when add note dropdown option is clicked', async () => {
        // Confirm note modal is not visible
        expect(app.queryByText('0 / 500')).toBeNull();

        // Click dropdown option, confirm HTMLDialogElement method was called
        await user.click(app.getByText('Add note'));
        await act(async () => await jest.advanceTimersByTimeAsync(100));
        expect(app.getByText('0 / 500')).not.toBeNull();
    });

    it('renders new notes in the timeline', async () => {
        // Mock fetch function to return expected response
        mockFetchResponse({
            action: "add_note",
            plant: "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
            timestamp: "2024-03-01T12:00:00+00:00",
            note_text: "Started flowering"
        });

        // Get reference to timeline div (excluding NoteModal)
        const timeline = app.container.querySelector('.timeline-layout');

        // Confirm timeline does not contain note text
        expect(within(timeline).queryByText(
            'Started flowering'
        )).toBeNull();

        // Open Note Modal
        await user.click(app.getByText('Add note'));
        await act(async () => await jest.advanceTimersByTimeAsync(100));

        // Simulate user typing new note and clicking save
        await user.type(app.getByRole('textbox'), '  Started flowering  ');
        await user.click(app.getByText('Save'));

        // Confirm note text appeared on page
        expect(within(timeline).queryByText(
            'Started flowering'
        )).not.toBeNull();
    });

    it('updates note text in timeline when note is edited', async () => {
        // Mock fetch function to return expected response
        mockFetchResponse({
            action: "edit_note",
            plant: "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
            timestamp: "2024-02-26T12:44:12+00:00",
            note_text: "One of the older leaves is starting to turn yellow, pinched it off"
        });

        // Get reference to timeline div (excluding NoteModal)
        const timeline = app.container.querySelector('.timeline-layout');

        // Confirm timeline contains note text from mockContext
        expect(within(timeline).queryByText(
            'One of the older leaves is starting to turn yellow'
        )).not.toBeNull();
        // Confirm timeline does not contain text we will add
        expect(within(timeline).queryByText(/pinched it off/)).toBeNull();

        // Simulate user clicking icon next to note, adding text, clicking save
        const editButton = within(timeline).getByText(
            'One of the older leaves is starting to turn yellow'
        ).closest('.note-collapse').querySelector('svg');
        await user.click(editButton);
        await act(async () => await jest.advanceTimersByTimeAsync(100));
        await user.type(app.getByRole('textbox'), ', pinched it off');
        await user.click(app.getByText('Save'));

        // Confirm new text was added to note
        expect(within(timeline).queryByText(
            'One of the older leaves is starting to turn yellow, pinched it off'
        )).not.toBeNull();
    });

    it('removes notes from timeline when deleted', async () => {
        // Mock fetch function to return expected response
        mockFetchResponse({
            deleted: ['2024-03-01T15:45:44+00:00'],
            failed: [],
            plant: "0640ec3b-1bed-4b15-a078-d6e7ec66be12"
        });

        // Get reference to timeline div (excluding NoteModal)
        const timeline = app.container.querySelector('.timeline-layout');

        // Confirm timeline contains note text
        expect(within(timeline).queryByText(
            'Fertilized with dilute 10-15-10 liquid fertilizer'
        )).not.toBeNull();

        // Simulate user clicking icon next to note (open modal)
        const editButton = within(timeline).getByText(
            'Fertilized with dilute 10-15-10 liquid fertilizer'
        ).closest('.note-collapse').querySelector('svg');
        await user.click(editButton);
        await act(async () => await jest.advanceTimersByTimeAsync(100));
        const editModal = app.getByText('Edit Note').closest('.modal-box');

        // Simulate user holding delete button for 1.5 seconds
        const button = within(editModal).getByText('Delete');
        fireEvent.pointerDown(button);
        await act(async () => await jest.advanceTimersByTimeAsync(1500));
        fireEvent.pointerUp(button);

        // Confirm timeline no longer contains note text
        expect(within(timeline).queryByText(
            'Fertilized with dilute 10-15-10 liquid fertilizer'
        )).toBeNull();
    });

    it('renders new photos in the timeline', async () => {
        // Mock expected API response when 2 photos are uploaded
        mockFetchResponse({
            uploaded: "2 photo(s)",
            failed: [],
            urls: [
                {
                    timestamp: "2024-06-21T20:52:03+00:00",
                    photo: "/media/images/photo1.jpg",
                    thumbnail: null,
                    preview: null,
                    key: 12,
                    pending: true
                },
                {
                    timestamp: "2024-06-21T20:54:03+00:00",
                    photo: "/media/images/photo2.jpg",
                    thumbnail: null,
                    preview: null,
                    key: 13,
                    pending: true
                }
            ]
        });

        // Get reference to timeline div
        const timeline = app.container.querySelector('.timeline-layout');

        // Confirm mock photos don't exist in timeline
        expect(within(timeline).queryByTitle('12:52 PM - June 21, 2024')).toBeNull();
        expect(within(timeline).queryByTitle('12:54 PM - June 21, 2024')).toBeNull();

        // Simulate user opening photo modal and selecting 2 files
        await user.click(app.getByText('Add photos'));
        await act(async () => await jest.advanceTimersByTimeAsync(100));
        const fileInput = app.getByTestId('photo-input');
        fireEvent.change(fileInput, { target: { files: [
            new File(['file1'], 'file1.jpg', { type: 'image/jpeg' }),
            new File(['file2'], 'file2.jpg', { type: 'image/jpeg' })
        ] } });
        await act(async () => await jest.advanceTimersByTimeAsync(100));

        // Confirm loading spinners appeared in timeline for both pending photos
        expect(app.getByTitle('Uploading photo (12:52 PM - June 21, 2024)')).toBeInTheDocument();
        expect(app.getByTitle('Uploading photo (12:54 PM - June 21, 2024)')).toBeInTheDocument();

        // Mock /get_photo_upload_status response when photos finish processing
        mockFetchResponse({
            photos: [
                {
                    status: 'complete',
                    plant_id: mockContext.plant_details.uuid,
                    photo_details: {
                        timestamp: "2024-06-21T20:52:03+00:00",
                        photo: "/media/images/photo1.jpg",
                        thumbnail: "/media/images/photo1_thumb.webp",
                        preview: "/media/images/photo1_preview.webp",
                        key: 12,
                        pending: false
                    }
                },
                {
                    status: 'complete',
                    plant_id: mockContext.plant_details.uuid,
                    photo_details: {
                        timestamp: "2024-06-21T20:54:03+00:00",
                        photo: "/media/images/photo2.jpg",
                        thumbnail: "/media/images/photo2_thumb.webp",
                        preview: "/media/images/photo2_preview.webp",
                        key: 13,
                        pending: false
                    }
                }
            ]
        });
        await act(async () => await jest.advanceTimersByTimeAsync(2500));

        // Confirm both mock photos rendered to the timeline
        expect(within(timeline).getByTitle('12:52 PM - June 21, 2024').firstChild.tagName).toBe('IMG');
        expect(within(timeline).getByTitle('12:54 PM - June 21, 2024').firstChild.tagName).toBe('IMG');
    });

    it('updates timeline QuickNavigation options when sections are added/removed', async () => {
        // Get QuickNavigation menu options, confirm 1 year option (2024)
        const quickNav = app.getByText('History').nextSibling;
        expect(quickNav.tagName).toBe('UL');
        expect(quickNav.children.length).toBe(1);
        expect(quickNav.children[0].textContent).toContain('2024');

        // Simulate user creating a water event in 2025
        const dateTimeInput = app.container.querySelector('input');
        fireEvent.input(
            dateTimeInput,
            {target: {value: '2025-02-20T12:00:00'}}
        );
        mockFetchResponse({
            action: "water",
            timestamp: '2025-02-20T20:00:00+00:00',
            plant: "0640ec3b-1bed-4b15-a078-d6e7ec66be12"
        });
        await user.click(app.getByRole("button", {name: "Water"}));

        // Confirm 2025 menu option was added
        expect(quickNav.children.length).toBe(2);
        expect(quickNav.children[0].textContent).toContain('2025');
        expect(quickNav.children[1].textContent).toContain('2024');

        // Start deleting events, select 2025 event, click delete button
        await user.click(app.getByText('Edit timeline'));
        await user.click(
            within(app.getByTestId("2025-02-20-events")).getByText("Watered")
        );
        mockFetchResponse({
            deleted: {
                water: ["2025-02-20T20:00:00+00:00"],
                fertilize: [],
                prune: [],
                repot: [],
            },
            failed: {
                water: [],
                fertilize: [],
                prune: [],
                repot: []
            }
        });
        // Simulate user holding delete button for 1.5 seconds
        const button = app.getByText('Delete');
        fireEvent.pointerDown(button);
        await act(async () => await jest.advanceTimersByTimeAsync(1500));
        fireEvent.pointerUp(button);

        // Confirm 2025 menu option was removed
        expect(quickNav.children.length).toBe(1);
        expect(quickNav.children[0].textContent).toContain('2024');
    });

    it('expands/collapses last event times when clicked', async () => {
        // Confirm div is collapsed (only shows last watered time)
        const lastEventTimes = app.getByTestId('last-event-times');
        expect(lastEventTimes).toHaveAttribute(
            "aria-label",
            "Show last event time for all event types"
        );

        // Click div, confirm expands to show last time for all event types
        await user.click(lastEventTimes);
        expect(lastEventTimes).toHaveAttribute(
            "aria-label",
            "Hide all last event times except water"
        );
    });

    it('renders new child plants in the timeline when registered in DivisonModal', async () => {
        // Confirm no division event or child plants in timeline
        expect(app.queryByText('Divided')).toBeNull();
        expect(app.queryByText('Divided into:')).toBeNull();

        // Open DivisionModal, wait until modal renders
        await user.click(app.getByText('Divide plant'));
        await waitFor(() => {
            expect(app.queryByText('When did you divide your plant?')).not.toBeNull();
        });

        // Mock fetch function to return expected /divide_plant response
        mockFetchResponse({
            plant_key: 'divided-parent-key',
            division_event_key: 'division-event-key',
            action: 'divide',
            plant: mockContext.plant_details.uuid
        });

        // Simulate user creating DivisionEvent
        await user.click(app.getByRole('button', { name: 'Start Dividing' }));
        await act(async () => await jest.advanceTimersByTimeAsync(100));
        expect(global.fetch).toHaveBeenCalled();

        // Confirm division event appeared in timeline (but no children yet)
        expect(app.queryByText('Divided')).not.toBeNull();
        expect(app.queryByText('Divided into:')).toBeNull();

        // Mock /get_plant_species_options response (requested when form loads)
        // Simulate user clicking "Add QR code later" button to load form
        mockPlantSpeciesOptionsResponse();
        await user.click(app.getByRole('button', { name: 'Add QR code later' }));

        // Simulate user typing name for new child plant
        await user.clear(app.getByRole('textbox', {name: 'Plant name'}));
        await user.type(app.getByRole('textbox', {name: 'Plant name'}), 'Baby plant');

        // Mock fetch function to return expected response when plant registered
        mockFetchResponse({
            success: 'plant registered',
            name: 'Baby plant',
            uuid: '3c55c103-308f-42ec-abac-8f0167c98704'
        });

        // Simulate user submitting form, confirm success screen appears
        await user.click(app.getByRole('button', { name: 'Register New Plant' }));
        await act(async () => await jest.advanceTimersByTimeAsync(100));
        expect(app.getByText('1st plant registered!')).toBeInTheDocument();

        // Confirm child plant appeared in timeline
        expect(app.queryByText('Divided into:')).not.toBeNull();
        expect(app.getByText('Baby plant')).toBeInTheDocument();
        expect(app.getByText('Baby plant')).toHaveAttribute(
            'href',
            '/manage/3c55c103-308f-42ec-abac-8f0167c98704'
        );
    });
});
