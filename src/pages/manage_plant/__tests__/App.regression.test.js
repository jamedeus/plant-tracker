import { fireEvent } from '@testing-library/react';
import createMockContext from 'src/testUtils/createMockContext';
import bulkCreateMockContext from 'src/testUtils/bulkCreateMockContext';
import App from '../App';
import { PageWrapper } from 'src/index';
import { mockContextNoEvents } from './mockContext';

describe('App', () => {
    let app, user;

    beforeAll(() => {
        // Create mock state objects
        bulkCreateMockContext(mockContextNoEvents);
        createMockContext('user_accounts_enabled', true);
    });

    beforeEach(() => {
        // Render app + create userEvent instance to use in tests
        user = userEvent.setup();
        app = render(
            <PageWrapper>
                <App />
            </PageWrapper>
        );
    });

    // Original bug: Same state was used for last_watered and last_fertilized,
    // both would update when plant was watered (fertilized should not update)
    it('updates correct relative time when plant is watered', async () => {
        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                "action": "water",
                "plant": "0640ec3b-1bed-4b15-a078-d6e7ec66be12"
            })
        }));

        // Confirm both relative times show "never"
        expect(app.getByText("Never watered")).not.toBeNull();
        expect(app.getByText("Never fertilized")).not.toBeNull();

        // Click water button
        await user.click(app.getByRole("button", {name: "Water"}));

        // Last watered time should change, last fertilized should not
        expect(app.queryByText("Never watered")).toBeNull();
        expect(app.getByText("Never fertilized")).not.toBeNull();
    });

    // Original bug: Same state was used for last_watered and last_fertilized,
    // neither would update when plant was fertilzized (fertilized should update)
    it('updates correct relative time when plant is fertilized', async () => {
        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                "action": "fertilize",
                "plant": "0640ec3b-1bed-4b15-a078-d6e7ec66be12"
            })
        }));

        // Confirm both relative times show "never"
        expect(app.getByText("Never watered")).not.toBeNull();
        expect(app.getByText("Never fertilized")).not.toBeNull();

        // Click fertilize button
        await user.click(app.getByRole("button", {name: "Fertilize"}));

        // Last fertilized time should change, last watered should not
        expect(app.getByText("Never watered")).not.toBeNull();
        expect(app.queryByText("Never fertilized")).toBeNull();
    });

    // Original bug: Repot events did not appear on calendar until page was
    // refreshed because the submit listener did not add them to history state
    it('updates calendar when repot modal is submitted', async () => {
        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                "action": "repot",
                "plant": "0640ec3b-1bed-4b15-a078-d6e7ec66be12"
            })
        }));

        // Confirm no repot events are shown on calendar
        const calendar = app.getByText('March 2024').parentNode.parentNode.parentNode;
        expect(calendar.querySelector('.dot-repot')).toBeNull();

        // Open Repot Modal
        await user.click(app.getAllByText(/Repot plant/)[0]);

        // Click Repot Modal submit button
        const repotModal = app.getAllByText(/Repot plant/)[1].parentNode;
        const submit = repotModal.querySelector('.btn-success');
        await user.click(submit);

        // Repot event should appear on calendar
        expect(calendar.querySelector('.dot-repot')).not.toBeNull();
    });

    // Original bug: PhotoModal file selection input retained prior selection
    // after uploading photos, confusing UX and easy to upload duplicates
    it('clears the PhotoModal file input after uploading photos', async () => {
        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({
                "uploaded": "2 photo(s)",
                "failed": [],
                "urls": [
                    {
                        "timestamp": "2024-03-21T10:52:03",
                        "image": "/media/images/photo1.jpg",
                        "thumbnail": "/media/images/photo1_thumb.jpg",
                        "key": 1
                    },
                    {
                        "timestamp": "2024-03-22T10:52:04",
                        "image": "/media/images/photo2.jpg",
                        "thumbnail": "/media/images/photo2_thumb.jpg",
                        "key": 2
                    },
                ]
            })
        }));

        // Create 2 mock files
        const file1 = new File(['file1'], 'file1.jpg', { type: 'image/jpeg' });
        const file2 = new File(['file2'], 'file2.jpg', { type: 'image/jpeg' });

        // Open photo modal
        await user.click(app.getByText('Add photos'));

        // Simulate user clicking input and selecting mock files
        const fileInput = app.getByTestId('photo-input');
        fireEvent.change(fileInput, { target: { files: [file1, file2] } });

        // Confirm names of both files appear in document (under file input)
        expect(app.getByText('file1.jpg')).not.toBeNull();
        expect(app.getByText('file2.jpg')).not.toBeNull();

        // Simulate user clicking upload button
        await user.click(app.getByText('Upload'));

        // Confirm both filenames are no longer in document (selection reset)
        await waitFor(() => {
            expect(app.queryByText('file1.jpg')).toBeNull();
            expect(app.queryByText('file2.jpg')).toBeNull();
        });
    });

    // Original bug: EventCalendar added a dot for each event in history, even
    // if another event with the same type existed on the same day. This caused
    // the layout to break if duplicate events were created.
    it('only shows one dot for each event type per calendar day', async () => {
        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                "action": "water",
                "plant": "0640ec3b-1bed-4b15-a078-d6e7ec66be12"
            })
        }));

        // Click water button, confirm only 1 WaterEvent is displayed
        await user.click(app.getByRole("button", {name: "Water"}));
        expect(app.container.querySelectorAll('.dot-water').length).toBe(1);

        // Click water button again, confirm no additional dot is added
        await user.click(app.getByRole("button", {name: "Water"}));
        expect(app.container.querySelectorAll('.dot-water').length).toBe(1);
    });

    // Original bug: Notes were rendered in database creation order, even if a
    // newly created note had a timestamp earlier than existing notes
    it('renders multiple notes on the same day in chronological order', async () => {
        // Simulate a new note added on April 1 with text the "Later timestamp"
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({
                "action": "add_note",
                "plant": "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
                "timestamp": "2024-04-01T12:00:00+00:00",
                "note_text": "Later timestamp"
            })
        }));

        // Open Note Modal, enter text (doesn't matter, will render text from
        // mock API response above), save first note
        await user.click(app.getByText('Add note'));
        await user.type(app.container.querySelector('.textarea'), '.');
        await user.click(app.getByText('Save'));

        // Simulate a second note with an earlier timestamp on the same day
        // with the text "Earlier timestamp"
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({
                "action": "add_note",
                "plant": "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
                "timestamp": "2024-04-01T10:00:00+00:00",
                "note_text": "Earlier timestamp"
            })
        }));

        // Save second note (created later, but earlier timestamp)
        await user.click(app.getByText('Add note'));
        await user.type(app.container.querySelector('.textarea'), '.');
        await user.click(app.getByText('Save'));

        // Get div wrapping both notes, get first and second child
        const notesSection = app.getByText('Later timestamp').parentElement.parentElement.parentElement;
        const firstNote = notesSection.children[0];
        const secondNote = notesSection.children[1];

        // Confirm notes were rendered chronologically, even though the note
        // with the earlier timestamp was added to the database second
        expect(firstNote.textContent).toContain('Earlier timestamp');
        expect(secondNote.textContent).toContain('Later timestamp');
    });

    // Original bug: If a fertilize event was created first, then a water event
    // was created on the same day, the timeline would render the fertilize
    // EventMarker before the water EventMakrer (should always be in the same
    // order on every day of the timeline for readability).
    it('renders EventMarkers in a predictable order', async () => {
        // Simulate user creating prune event
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                "action": "prune",
                "plant": "0640ec3b-1bed-4b15-a078-d6e7ec66be12"
            })
        }));
        await user.click(app.getByRole("button", {name: "Prune"}));

        // Simulate user creating fertilize event
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                "action": "fertilize",
                "plant": "0640ec3b-1bed-4b15-a078-d6e7ec66be12"
            })
        }));
        await user.click(app.getByRole("button", {name: "Fertilize"}));

        // Simulate user creating water event
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                "action": "water",
                "plant": "0640ec3b-1bed-4b15-a078-d6e7ec66be12"
            })
        }));
        await user.click(app.getByRole("button", {name: "Water"}));

        // Get div containing both EventMarkers, confirm "Watered" is first
        const today = app.getByText('today').parentElement.nextSibling;
        const eventMarkers = today.children[0];
        expect(eventMarkers.children[0].textContent).toContain('Watered');
        expect(eventMarkers.children[1].textContent).toContain('Fertilized');
        expect(eventMarkers.children[2].textContent).toContain('Pruned');
    });

    // Original bug: When RepotModal was submitted the pre-filled pot size
    // field in EditModal form did not update. If the user then opened the
    // EditModal to change description and did not noticed the outdated pot
    // size value they could easily reset back to the initial pot size.
    it('updates pot size in EditModal form when plant is repotted', async () => {
        // Open edit modal
        await user.click(within(
            app.container.querySelector('.dropdown-center')
        ).getByText("Edit"));

        // Confirm pot size field defaults to '4'
        expect(app.getByLabelText('Pot size').value).toBe('4');

        // Simulate user opening repot modal and clicking submit without
        // changing pot size (defaults to 6, next size up)
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                "action": "repot",
                "plant": "0640ec3b-1bed-4b15-a078-d6e7ec66be12"
            })
        }));
        await user.click(app.getAllByText(/Repot plant/)[0]);
        const repotModal = app.getAllByText(/Repot plant/)[1].parentElement;
        await user.click(repotModal.querySelector('.btn-success'));

        // Confirm pot size field in EditModal changed to '6'
        expect(app.getByLabelText('Pot size').value).toBe('6');
    });

    // Original bug: timelineSlice.eventDeleted assumed there was only 1 event
    // of each type per day. If there were multiple water events at different
    // times on the same day and only 1 was deleted eventDeleted would remove
    // the event type from dateKey, resulting in the calendar dot disappearing
    // and the timeline EventMarker being removed.
    it('does not remove event from timeline if another event with same type exists', async () => {
        // Confirm no water events exist in calendar or timeline
        expect(app.container.querySelectorAll('.dot-water').length).toBe(0);
        expect(app.container.querySelectorAll('.fa-droplet').length).toBe(0);

        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                "action": "water",
                "plant": "0640ec3b-1bed-4b15-a078-d6e7ec66be12"
            })
        }));

        // Create 2 water events 1 second apart on the same day
        const dateTimeInput = app.container.querySelector('input');
        fireEvent.input(
            dateTimeInput,
            {target: {value: '2024-03-01T12:00:00'}}
        );
        await user.click(app.getByRole("button", {name: "Water"}));
        fireEvent.input(
            dateTimeInput,
            {target: {value: '2024-03-01T12:00:01'}}
        );
        await user.click(app.getByRole("button", {name: "Water"}));

        // Confirm dot appeared on calendar, EventMarker appeared in timeline
        expect(app.container.querySelectorAll('.dot-water').length).toBe(1);
        expect(app.container.querySelectorAll('.fa-droplet').length).toBe(1);

        // Open event history modal, delete more recent event
        await user.click(app.getByText('Delete events'));
        const modal = app.getByText('Event History').parentElement;
        await user.click(within(modal).getAllByText(/today/)[0]);
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                "deleted": [
                    {"type": "water", "timestamp": "2024-03-01T20:00:01+00:00"}
                ],
                "failed": []
            })
        }));
        await user.click(within(modal).getByText('Delete'));

        // Confirm dot and marker are still present (second event still exists)
        expect(app.container.querySelectorAll('.dot-water').length).toBe(1);
        expect(app.container.querySelectorAll('.fa-droplet').length).toBe(1);
    });

    // Original bug: while fixing the issue above (event removed from calendar/
    // timeline even though another of same type exists) a bad fix was written
    // which compared timelineDays dateKeys (YYYY-MM-DD in user timezone) with
    // eventsByType timestamps (UTC). This could cause a TimelineDay to remain
    // in the timeline after the last event was deleted if the timestamp of an
    // event on the previous day had a UTC timestamp matching the dateKey (ie
    // event created just before midnight, so UTC timestamp is early next day).
    // This issue could be reintroduced fairly easily.
    it('does not fail to remove timeline day when the UTC timestamp of an event on prev day matches target day', async () => {
        // Confirm no water events exist in calendar or timeline
        expect(app.container.querySelectorAll('.dot-water').length).toBe(0);
        expect(app.container.querySelectorAll('.fa-droplet').length).toBe(0);

        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                "action": "water",
                "plant": "0640ec3b-1bed-4b15-a078-d6e7ec66be12"
            })
        }));

        // Create 2 water events at 10pm February 29 and 2am March 1 (different
        // days in PST but same day in UTC)
        const dateTimeInput = app.container.querySelector('input');
        fireEvent.input(
            dateTimeInput,
            {target: {value: '2024-02-29T22:00:00'}}
        );
        await user.click(app.getByRole("button", {name: "Water"}));
        fireEvent.input(
            dateTimeInput,
            {target: {value: '2024-03-01T02:00:00'}}
        );
        await user.click(app.getByRole("button", {name: "Water"}));

        // Confirm 2 EventCalendar dots and 2 EventMarkers in timeline
        expect(app.container.querySelectorAll('.dot-water').length).toBe(2);
        expect(app.container.querySelectorAll('.fa-droplet').length).toBe(2);

        // Open event history modal, delete March 1 event
        await user.click(app.getByText('Delete events'));
        const modal = app.getByText('Event History').parentElement;
        await user.click(within(modal).getByText(/today/));
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                "deleted": [
                    {"type": "water", "timestamp": "2024-03-01T20:00:00+00:00"}
                ],
                "failed": []
            })
        }));
        await user.click(within(modal).getByText('Delete'));

        // Confirm March 1 TimelineDay was removed (only 1 dot and marker left)
        expect(app.container.querySelectorAll('.dot-water').length).toBe(1);
        expect(app.container.querySelectorAll('.fa-droplet').length).toBe(1);
    });

    // Original bug: If a YYYY-MM-DD date contained photos and/or notes but no
    // events a dateKey would exist in timelineDays but not calendarDays, since
    // calendarDays only shows events. When an event was added on the same date
    // timelineSlice.eventAdded would build a new events array and write it to
    // calendarDays[dateKey].events, which did not exist (dateKey missing).
    // This prevented the event from rendering to the timeline or calendar.
    it('does not fail to add first event to day with existing photos/notes', async () => {
        // Mock expected API response when 2 photos are uploaded
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({
                "uploaded": "2 photo(s)",
                "failed": [],
                "urls": [
                    {
                        "timestamp": "2024-03-01T20:52:03+00:00",
                        "image": "/media/images/photo1.jpg",
                        "thumbnail": "/media/images/photo1_thumb.jpg",
                        "key": 12
                    },
                    {
                        "timestamp": "2024-03-01T20:54:03+00:00",
                        "image": "/media/images/photo2.jpg",
                        "thumbnail": "/media/images/photo2_thumb.jpg",
                        "key": 13
                    }
                ]
            })
        }));

        // Simulate user opening photo modal, selecting 2 files, and submitting
        await user.click(app.getByText('Add photos'));
        const fileInput = app.getByTestId('photo-input');
        fireEvent.change(fileInput, { target: { files: [
            new File(['file1'], 'file1.jpg', { type: 'image/jpeg' }),
            new File(['file2'], 'file2.jpg', { type: 'image/jpeg' })
        ] } });
        await user.click(app.getByText('Upload'));

        // Confirm no water events exist in calendar or timeline
        expect(app.container.querySelectorAll('.dot-water').length).toBe(0);
        expect(app.container.querySelectorAll('.fa-droplet').length).toBe(0);

        // Click water button (datetime input contains same day as photos)
        await user.click(app.getByRole("button", {name: "Water"}));

        // Confirm dot appeared on calendar, EventMarker appeared in timeline
        expect(app.container.querySelectorAll('.dot-water').length).toBe(1);
        expect(app.container.querySelectorAll('.fa-droplet').length).toBe(1);
    });

    // Original bug: If multiple photos existed on the same day and the first
    // photo (most-recent) was deleted the last photo would be removed instead,
    // leaving the deleted photo in the timeline until the page was refreshed.
    // This happened because a photo object from state.photos was passed to
    // state.timelineDays[dateKey].photos.indexOf, which returned -1 since the
    // object was not in the array (it was identical to an object in the array
    // but not the same reference, so strict equality check failed), resulting
    // in the last photo being deleted from the array.
    it('removes the correct photo from timelineDays state when photos are deleted', async () => {
        // Mock expected API response when 2 photos are uploaded
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({
                "uploaded": "2 photo(s)",
                "failed": [],
                "urls": [
                    {
                        "timestamp": "2024-03-01T20:54:03+00:00",
                        "image": "/media/images/photo1.jpg",
                        "thumbnail": "/media/images/photo1_thumb.jpg",
                        "key": 12
                    },
                    {
                        "timestamp": "2024-03-01T20:52:03+00:00",
                        "image": "/media/images/photo2.jpg",
                        "thumbnail": "/media/images/photo2_thumb.jpg",
                        "key": 13
                    }
                ]
            })
        }));

        // Simulate user opening photo modal, selecting 2 files, and submitting
        await user.click(app.getByText('Add photos'));
        const fileInput = app.getByTestId('photo-input');
        fireEvent.change(fileInput, { target: { files: [
            new File(['photo1'], 'photo1.jpg', { type: 'image/jpeg' }),
            new File(['photo2'], 'photo2.jpg', { type: 'image/jpeg' })
        ] } });
        await user.click(app.getByText('Upload'));

        // Confirm both photos rendered to the timeline
        expect(app.getByTitle('12:52 PM - March 1, 2024')).not.toBeNull();
        expect(app.getByTitle('12:54 PM - March 1, 2024')).not.toBeNull();

        // Mock fetch to return expected response when newest photo is deleted
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({
                "deleted": [12],
                "failed": []
            })
        }));

        // Simulate user opening DeletePhotosModal, selecting first photo
        await user.click(app.getByText('Delete photos'));
        const modal = app.getByText('Delete Photos').parentElement;
        await user.click(within(modal).getAllByText(/Select/)[0]);
        // Simulate user clicking delete button, confirm delete button
        await user.click(within(modal).getAllByRole("button", {name: "Delete"})[0]);
        await user.click(app.getByTestId('confirm_delete_photos'));

        // Confirm the deleted photo is no longer in the timeline
        expect(app.getByTitle('12:52 PM - March 1, 2024')).not.toBeNull();
        expect(app.queryByTitle('12:54 PM - March 1, 2024')).toBeNull();
    });
});
