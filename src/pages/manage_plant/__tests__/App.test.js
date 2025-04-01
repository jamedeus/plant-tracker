import createMockContext from 'src/testUtils/createMockContext';
import { postHeaders } from 'src/testUtils/headers';
import App from '../App';
import { TimelineProvider } from '../TimelineContext';
import { PageWrapper } from 'src/index';
import { mockContext } from './mockContext';

describe('App', () => {
    let app, user;

    beforeAll(() => {
        // Create mock state objects
        createMockContext('plant_details', mockContext.plant_details);
        createMockContext('events', mockContext.events);
        createMockContext('notes', mockContext.notes);
        createMockContext('group_options', mockContext.group_options);
        createMockContext('species_options', mockContext.species_options);
        createMockContext('photo_urls', mockContext.photo_urls);
    });

    beforeEach(() => {
        // Render app + create userEvent instance to use in tests
        user = userEvent.setup();
        app = render(
            <PageWrapper>
                <TimelineProvider>
                    <App />
                </TimelineProvider>
            </PageWrapper>
        );
    });

    it('sends correct payload when edit modal is submitted', async () => {
        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                "name": "Test Plant",
                "species": "Calathea",
                "pot_size": 4,
                "description": "This is a plant with a long description",
                "display_name": "Test Plant"
            })
        }));

        // Open edit modal
        await user.click(within(
            app.container.querySelector('.dropdown-center')
        ).getByText("Edit"));

        // Click submit button inside edit modal
        const modal = app.getByText("Edit Details").parentElement;
        await user.click(within(modal).getByText("Edit"));

        // Confirm correct data posted to /edit_plant endpoint
        expect(global.fetch).toHaveBeenCalledWith('/edit_plant', {
            method: 'POST',
            body: JSON.stringify({
                "name": "Test Plant",
                "species": "Calathea",
                "pot_size": "4",
                "description": "This is a plant with a long description",
                "plant_id": "0640ec3b-1bed-4b15-a078-d6e7ec66be12"
            }),
            headers: postHeaders
        });
    });

    it('sends correct payload when plant is watered', async () => {
        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                "action": "water",
                "plant": "0640ec3b-1bed-4b15-a078-d6e7ec66be12"
            })
        }));

        // Click water button
        await user.click(app.getByRole("button", {name: "Water"}));

        // Confirm correct data posted to /add_plant_event endpoint
        expect(global.fetch).toHaveBeenCalledWith('/add_plant_event', {
            method: 'POST',
            body: JSON.stringify({
                "plant_id": "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
                "event_type": "water",
                "timestamp": "2024-03-01T20:00:00.000Z"
            }),
            headers: postHeaders
        });
    });

    it('sends correct payload when plant is fertilized', async () => {
        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                "action": "fertilize",
                "plant": "0640ec3b-1bed-4b15-a078-d6e7ec66be12"
            })
        }));

        // Click fertilize button
        await user.click(app.getByRole("button", {name: "Fertilize"}));

        // Confirm correct data posted to /add_plant_event endpoint
        expect(global.fetch).toHaveBeenCalledWith('/add_plant_event', {
            method: 'POST',
            body: JSON.stringify({
                "plant_id": "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
                "event_type": "fertilize",
                "timestamp": "2024-03-01T20:00:00.000Z"
            }),
            headers: postHeaders
        });
    });

    it('sends correct payload when plant is pruned', async () => {
        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                "action": "prune",
                "plant": "0640ec3b-1bed-4b15-a078-d6e7ec66be12"
            })
        }));

        // Click prune button
        await user.click(app.getByRole("button", {name: "Prune"}));

        // Confirm correct data posted to /add_plant_event endpoint
        expect(global.fetch).toHaveBeenCalledWith('/add_plant_event', {
            method: 'POST',
            body: JSON.stringify({
                "plant_id": "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
                "event_type": "prune",
                "timestamp": "2024-03-01T20:00:00.000Z"
            }),
            headers: postHeaders
        });
    });

    it('shows error toast if duplicate event error received', async() => {
        // Mock fetch function to return error response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: false,
            status: 409,
            json: () => Promise.resolve({
                "error": "event with same timestamp already exists"
            })
        }));

        // Click water button
        await user.click(app.getByRole("button", {name: "Water"}));
    });

    it('sends correct payload when "Remove from group" clicked', async () => {
        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({
                "action": "remove_plant_from_group",
                "plant": "0640ec3b-1bed-4b15-a078-d6e7ec66be12"
            })
        }));

        // Click "Remove from group" button in details dropdown
        await user.click(app.getByTitle(/Remove plant from group/));

        // Confirm correct data posted to /remove_plant_from_group endpoint
        expect(global.fetch).toHaveBeenCalledWith('/remove_plant_from_group', {
            method: 'POST',
            body: JSON.stringify({
                "plant_id": "0640ec3b-1bed-4b15-a078-d6e7ec66be12"
            }),
            headers: postHeaders
        });
    });

    it('sends the correct payload when "Add to group" modal submitted', async () => {
        // Click remove from group button (re-renders with add to group option)
        await user.click(app.getByTitle(/Remove plant from group/));

        // Click "Add to group" button in details dropdown
        await user.click(app.getByTitle(/Add plant to group/));

        // Get reference to AddToGroupModal
        const addToGroupModal = app.getByText("Add plant to group").parentElement;

        // Select group option, confirm correct data posted to /add_plant_to_group
        await user.click(within(addToGroupModal).getByText("Test group"));
        expect(global.fetch).toHaveBeenCalledWith('/add_plant_to_group', {
            method: 'POST',
            body: JSON.stringify({
                "plant_id": "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
                "group_id": "0640ec3b-1bed-4b15-a078-d6e7ec66be14"
            }),
            headers: postHeaders
        });
    });

    it('sends correct payload when RepotModal is submitted', async () => {
        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                "action": "repot",
                "plant": "0640ec3b-1bed-4b15-a078-d6e7ec66be12"
            })
        }));

        // Click "Repot plant" dropdown option (open modal)
        await user.click(app.getAllByText(/Repot plant/)[0]);

        // Get reference to Repot Modal + submit button
        const repotModal = app.getAllByText(/Repot plant/)[1].parentElement;
        const submit = repotModal.querySelector('.btn-success');

        // Click submit button
        await user.click(submit);

        // Confirm correct data posted to /repot_plant endpoint
        expect(global.fetch).toHaveBeenCalledWith('/repot_plant', {
            method: 'POST',
            body: JSON.stringify({
                "plant_id": "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
                "new_pot_size": 6,
                "timestamp": "2024-03-01T20:00:00.000Z"
            }),
            headers: postHeaders
        });
    });

    it('detects when custom pot size is selected in RepotModal', async () => {
        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                "action": "repot",
                "plant": "0640ec3b-1bed-4b15-a078-d6e7ec66be12"
            })
        }));

        // Click "Repot plant" dropdown option (open modal)
        await user.click(app.getAllByText(/Repot plant/)[0]);

        // Get reference to Repot Modal + submit button
        const repotModal = app.getAllByText(/Repot plant/)[1].parentElement;
        const submit = repotModal.querySelector('.btn-success');

        // Click custom pot size option, enter "5"
        const customPotSize = repotModal.querySelector('.pot-size.w-32');
        await user.click(customPotSize);
        await user.type(customPotSize, '5');

        // Click submit button
        await user.click(submit);

        // Confirm payload includes custom pot size
        expect(global.fetch).toHaveBeenCalledWith('/repot_plant', {
            method: 'POST',
            body: JSON.stringify({
                "plant_id": "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
                "new_pot_size": 5,
                "timestamp": "2024-03-01T20:00:00.000Z"
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

    it('redirects to overview when dropdown option is clicked', async () => {
        // Click overview dropdown option, confirm redirected
        await user.click(app.getByText('Overview'));
        expect(window.location.href).toBe('/');
    });

    it('fetches new state when user navigates to page with back button', async () => {
        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                "plant_details": mockContext.plant_details,
                "events": mockContext.events,
                "notes": mockContext.notes,
                "group_options": mockContext.group_options,
                "species_options": mockContext.species_options,
                "photo_urls": mockContext.photo_urls
            })
        }));

        // Simulate user navigating to page with back button
        const pageshowEvent = new Event('pageshow');
        Object.defineProperty(pageshowEvent, 'persisted', { value: true });
        window.dispatchEvent(pageshowEvent);

        // Confirm fetched correct endpoint
        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                '/get_plant_state/0640ec3b-1bed-4b15-a078-d6e7ec66be12'
            );
        });
    });

    it('reloads page if unable to fetch new state when user presses back button', async () => {
        // Mock fetch function to return error response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: false,
            json: () => Promise.resolve({'Error': 'Plant not found'})
        }));

        // Simulate user navigating to page with back button
        const pageshowEvent = new Event('pageshow');
        Object.defineProperty(pageshowEvent, 'persisted', { value: true });
        window.dispatchEvent(pageshowEvent);

        // Confirm fetched correct endpoint
        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                '/get_plant_state/0640ec3b-1bed-4b15-a078-d6e7ec66be12'
            );
        });

        // Confirm page was reloaded
        expect(window.location.reload).toHaveBeenCalled();
    });

    it('does not fetch new state when other pageshow events are triggered', () => {
        // Simulate pageshow event with persisted == false (ie initial load)
        const pageshowEvent = new Event('pageshow');
        Object.defineProperty(pageshowEvent, 'persisted', { value: false });
        window.dispatchEvent(pageshowEvent);

        // Confirm did not call fetch
        expect(global.fetch).not.toHaveBeenCalled();
    });

    it('opens DefaultPhotoModal when dropdown option clicked', async () => {
        // Confirm modal is not open
        expect(app.container.querySelector('#slide1')).toBeNull();

        // Click button, confirm HTMLDialogElement method was called
        await user.click(app.getByText('Set default photo'));
        expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalled();
        await waitFor(() => {
            expect(app.container.querySelector('#slide1')).not.toBeNull();
        });
    });

    it('opens ChangeQrModal when dropdown option clicked', async () => {
        // Confirm modal is not open
        expect(app.queryByText('You will have 15 minutes to scan the new QR code.')).toBeNull();

        // Click button, confirm HTMLDialogElement method was called
        await user.click(app.getByText('Change QR code'));
        expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalled();
        await waitFor(() => {
            expect(app.queryByText('You will have 15 minutes to scan the new QR code.')).not.toBeNull();
        });
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
        expect(app.container.querySelector('#photo3')).toBeNull();

        // Click button, confirm HTMLDialogElement method was called
        await user.click(app.getByText('Delete photos'));
        expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalled();
        await waitFor(() => {
            expect(app.container.querySelector('#photo3')).not.toBeNull();
        });
    });

    it('removes event markers from timeline when events are deleted', async () => {
        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                "deleted": [
                    {"type": "water", "timestamp": "2024-03-01T15:45:44+00:00"},
                ],
                "failed": []
            })
        }));

        // Confirm 2 water event icons exist
        expect(app.container.querySelectorAll('.fa-droplet').length).toBe(2);

        // Open event history modal, get reference to modal
        await user.click(app.getByText('Delete events'));
        const modal = app.getByText('Event History').parentElement;

        // Select both water events, click delete button
        await user.click(within(modal).getByText(/today/));
        await user.click(within(modal).getByText(/yesterday/));
        await user.click(within(modal).getByText('Delete'));

        // Confirm both water event icons disappeared
        expect(app.container.querySelectorAll('.fa-droplet').length).toBe(0);
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
