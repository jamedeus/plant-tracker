import { fireEvent, waitFor } from '@testing-library/react';
import mockCurrentURL from 'src/testUtils/mockCurrentURL';
import mockFetchResponse, { mockMultipleFetchResponses } from 'src/testUtils/mockFetchResponse';
import App from '../App';
import { Toast } from 'src/components/Toast';
import { ErrorModal } from 'src/components/ErrorModal';
import { mockContextNoEvents } from './mockContext';
import { act } from '@testing-library/react';

describe('App', () => {
    let app, user;

    beforeAll(() => {
        // Simulate SINGLE_USER_MODE disabled on backend
        globalThis.USER_ACCOUNTS_ENABLED = true;
    });

    beforeEach(() => {
        // Allow fast forwarding (must hold delete button to confirm)
        jest.useFakeTimers({ doNotFake: ['Date'] });

        // Mock window.location (querystring parsed when page loads)
        mockCurrentURL('https://plants.lan/manage/e1393cfd-0133-443a-97b1-06bb5bd3fcca');

        // Render app + create userEvent instance to use in tests
        user = userEvent.setup({ advanceTimers: jest.advanceTimersByTimeAsync });
        app = render(
            <>
                <App initialState={mockContextNoEvents} />
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

    // Original bug: Same state was used for last_watered and last_fertilized,
    // both would update when plant was watered (fertilized should not update)
    it('updates correct relative time when plant is watered', async () => {
        // Mock fetch function to return expected response
        mockFetchResponse({
            action: "water",
            timestamp: "2024-03-01T20:00:01+00:00",
            plant: "0640ec3b-1bed-4b15-a078-d6e7ec66be12"
        });

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
        mockFetchResponse({
            action: "fertilize",
            timestamp: "2024-03-01T20:00:01+00:00",
            plant: "0640ec3b-1bed-4b15-a078-d6e7ec66be12"
        });

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
        mockFetchResponse({
            action: "repot",
            plant: "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
            timestamp: "2024-03-01T20:00:00+00:00",
            pot_size: 8
        });

        // Confirm no repot events are shown on calendar
        const calendar = app.getByText('March 2024').closest('.react-calendar');
        expect(calendar.querySelector('.dot > .bg-repot')).toBeNull();

        // Open Repot Modal
        await user.click(app.getAllByText(/Repot plant/)[0]);
        await act(async () => await jest.advanceTimersByTimeAsync(100));

        // Click Repot Modal submit button
        await user.click(app.getByRole('button', {name: 'Repot Plant'}));

        // Repot event should appear on calendar
        expect(calendar.querySelector('.dot > .bg-repot')).not.toBeNull();
    });

    // Original bug: PhotoModal file selection input retained prior selection
    // after uploading photos, confusing UX and easy to upload duplicates
    it('clears the PhotoModal file input after uploading photos', async () => {
        // Mock fetch function to return expected response
        mockFetchResponse({
            uploaded: "2 photo(s)",
            failed: [],
            urls: [
                {
                    timestamp: "2024-03-21T10:52:03.123+00:00",
                    image: "/media/images/photo1.jpg",
                    thumbnail: "/media/images/photo1_thumb.webp",
                    preview: "/media/images/photo1_preview.webp",
                    key: 12
                },
                {
                    timestamp: "2024-03-22T10:52:04.123+00:00",
                    image: "/media/images/photo2.jpg",
                    thumbnail: "/media/images/photo2_thumb.webp",
                    preview: "/media/images/photo2_preview.webp",
                    key: 13
                }
            ]
        });

        // Create 2 mock files
        const file1 = new File(['file1'], 'file1.jpg', { type: 'image/jpeg' });
        const file2 = new File(['file2'], 'file2.jpg', { type: 'image/jpeg' });

        // Open photo modal
        await user.click(app.getByText('Add photos'));
        await act(async () => await jest.advanceTimersByTimeAsync(100));

        // Simulate user clicking input and selecting mock files
        const fileInput = app.getByTestId('photo-input');
        fireEvent.change(fileInput, { target: { files: [file1, file2] } });

        // Confirm input was cleared
        expect(fileInput.value).toBe('');
    });

    // Original bug: EventCalendar added a dot for each event in history, even
    // if another event with the same type existed on the same day. This caused
    // the layout to break if duplicate events were created.
    it('only shows one dot for each event type per calendar day', async () => {
        // Mock fetch function to return expected response
        mockFetchResponse({
            action: "water",
            timestamp: "2024-03-01T20:00:01+00:00",
            plant: "0640ec3b-1bed-4b15-a078-d6e7ec66be12"
        });

        // Click water button, confirm only 1 WaterEvent is displayed
        await user.click(app.getByRole("button", {name: "Water"}));
        expect(app.container.querySelectorAll('.dot > .bg-info').length).toBe(1);

        // Click water button again, confirm no additional dot is added
        await user.click(app.getByRole("button", {name: "Water"}));
        expect(app.container.querySelectorAll('.dot > .bg-info').length).toBe(1);
    });

    // Original bug: Notes were rendered in database creation order, even if a
    // newly created note had a timestamp earlier than existing notes
    it('renders multiple notes on the same day in chronological order', async () => {
        // Simulate a new note added on April 1 with text the "Later timestamp"
        mockFetchResponse({
            action: "add_note",
            plant: "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
            timestamp: "2024-04-01T12:00:00+00:00",
            note_text: "Later timestamp"
        });

        // Open Note Modal, enter text (doesn't matter, will render text from
        // mock API response above), save first note
        await user.click(app.getByText('Add note'));
        await act(async () => await jest.advanceTimersByTimeAsync(100));
        await user.type(app.getByRole('textbox'), '.');
        await user.click(app.getByText('Save'));

        // Simulate a second note with an earlier timestamp on the same day
        // with the text "Earlier timestamp"
        mockFetchResponse({
            action: "add_note",
            plant: "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
            timestamp: "2024-04-01T10:00:00+00:00",
            note_text: "Earlier timestamp"
        });

        // Save second note (created later, but earlier timestamp)
        await user.click(app.getByText('Add note'));
        await act(async () => await jest.advanceTimersByTimeAsync(100));
        await user.type(app.getByRole('textbox'), '.');
        await user.click(app.getByText('Save'));

        // Get div wrapping both notes, get first and second child
        const notesSection = app.getByTestId('2024-04-01-notes');
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
        mockFetchResponse({
            action: "prune",
            timestamp: "2024-03-01T20:00:01+00:00",
            plant: "0640ec3b-1bed-4b15-a078-d6e7ec66be12"
        });
        await user.click(app.getByRole("button", {name: "Prune"}));

        // Simulate user creating fertilize event
        mockFetchResponse({
            action: "fertilize",
            timestamp: "2024-03-01T20:00:01+00:00",
            plant: "0640ec3b-1bed-4b15-a078-d6e7ec66be12"
        });
        await user.click(app.getByRole("button", {name: "Fertilize"}));

        // Simulate user creating water event
        mockFetchResponse({
            action: "water",
            timestamp: "2024-03-01T20:00:01+00:00",
            plant: "0640ec3b-1bed-4b15-a078-d6e7ec66be12"
        });
        await user.click(app.getByRole("button", {name: "Water"}));

        // Get div containing both EventMarkers, confirm "Watered" is first
        const eventMarkers = app.getByTestId('2024-03-01-events');
        expect(eventMarkers.children[0].textContent).toContain('Watered');
        expect(eventMarkers.children[1].textContent).toContain('Fertilized');
        expect(eventMarkers.children[2].textContent).toContain('Pruned');
    });

    // Original bug: If a fertilize event was created first, then a water event
    // was created on the same day, the EventCalendar would render the green
    // fertilize dot before the blue water dot (should always be in the same
    // order on every day of the calendar for readability).
    it('renders EventCalendar dots in a predictable order', async () => {
        // Simulate user creating prune event
        mockFetchResponse({
            action: "prune",
            timestamp: "2024-03-01T20:00:01+00:00",
            plant: "0640ec3b-1bed-4b15-a078-d6e7ec66be12"
        });
        await user.click(app.getByRole("button", {name: "Prune"}));

        // Simulate user creating fertilize event
        mockFetchResponse({
            action: "fertilize",
            timestamp: "2024-03-01T20:00:01+00:00",
            plant: "0640ec3b-1bed-4b15-a078-d6e7ec66be12"
        });
        await user.click(app.getByRole("button", {name: "Fertilize"}));

        // Simulate user creating water event
        mockFetchResponse({
            action: "water",
            timestamp: "2024-03-01T20:00:01+00:00",
            plant: "0640ec3b-1bed-4b15-a078-d6e7ec66be12"
        });
        await user.click(app.getByRole("button", {name: "Water"}));

        // Get div containing EventCalendar dots, confirm "Watered" is first
        const calendarDay = app.getByLabelText('March 1, 2024').parentElement;
        const calendarDots = calendarDay.querySelectorAll('.dot');
        expect(calendarDots[0].children[0].classList).toContain('bg-info');
        expect(calendarDots[1].children[0].classList).toContain('bg-success');
        expect(calendarDots[2].children[0].classList).toContain('bg-prune');
    });

    // Original bug: timelineSlice.eventDeleted assumed there was only 1 event
    // of each type per day. If there were multiple water events at different
    // times on the same day and only 1 was deleted eventDeleted would remove
    // the event type from dateKey, resulting in the calendar dot disappearing
    // and the timeline EventMarker being removed.
    //
    // NOTE this is no longer reproducible in prod (delete mode will select all
    // events within same day), but worth keeping for timelineSlice coverage.
    it('does not remove event from timeline if another event with same type exists', async () => {
        // Confirm no water events exist in calendar or timeline
        expect(app.container.querySelectorAll('.dot > .bg-info').length).toBe(0);
        expect(app.container.querySelectorAll('.fa-inline.text-info').length).toBe(0);

        // Mock fetch function to return expected response

        // Create 2 water events 1 second apart on the same day
        const dateTimeInput = app.container.querySelector('input');
        fireEvent.input(
            dateTimeInput,
            {target: {value: '2024-03-01T12:00:00'}}
        );
        mockFetchResponse({
            action: "water",
            timestamp: "2024-03-01T20:00:00+00:00",
            plant: "0640ec3b-1bed-4b15-a078-d6e7ec66be12"
        });
        await user.click(app.getByRole("button", {name: "Water"}));
        fireEvent.input(
            dateTimeInput,
            {target: {value: '2024-03-01T12:00:01'}}
        );
        mockFetchResponse({
            action: "water",
            timestamp: "2024-03-01T20:00:01+00:00",
            plant: "0640ec3b-1bed-4b15-a078-d6e7ec66be12"
        });
        await user.click(app.getByRole("button", {name: "Water"}));

        // Confirm dot appeared on calendar, EventMarker appeared in timeline
        expect(app.container.querySelectorAll('.dot > .bg-info').length).toBe(1);
        expect(app.container.querySelectorAll('.fa-inline.text-info').length).toBe(1);

        // Start deleting events, select more recent event
        await user.click(app.getByText('Edit timeline'));
        await user.click(
            within(app.getByTestId("2024-03-01-events")).getByText("Watered")
        );
        mockFetchResponse({
            deleted: {
                water: ["2024-03-01T20:00:01+00:00"],
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

        // Confirm dot and marker are still present (second event still exists)
        expect(app.container.querySelectorAll('.dot > .bg-info').length).toBe(1);
        expect(app.container.querySelectorAll('.fa-inline.text-info').length).toBe(1);
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
        expect(app.container.querySelectorAll('.dot > .bg-info').length).toBe(0);
        expect(app.container.querySelectorAll('.fa-inline.text-info').length).toBe(0);

        // Create 2 water events at 10pm February 29 and 2am March 1 (different
        // days in PST but same day in UTC)
        mockFetchResponse({
            action: "water",
            timestamp: "2024-03-01T06:00:00+00:00",
            plant: "0640ec3b-1bed-4b15-a078-d6e7ec66be12"
        });
        const dateTimeInput = app.container.querySelector('input');
        fireEvent.input(
            dateTimeInput,
            {target: {value: '2024-02-29T22:00:00'}}
        );
        // First event (February 29)
        await user.click(app.getByRole("button", {name: "Water"}));

        mockFetchResponse({
            action: "water",
            timestamp: "2024-03-01T10:00:00+00:00",
            plant: "0640ec3b-1bed-4b15-a078-d6e7ec66be12"
        });
        fireEvent.input(
            dateTimeInput,
            {target: {value: '2024-03-01T02:00:00'}}
        );
        // Second event (March 1)
        await user.click(app.getByRole("button", {name: "Water"}));

        // Confirm 2 EventCalendar dots and 2 EventMarkers in timeline
        expect(app.container.querySelectorAll('.dot > .bg-info').length).toBe(2);
        expect(app.container.querySelectorAll('.fa-inline.text-info').length).toBe(2);

        // Start deleting events, select March 1 event
        await user.click(app.getByText('Edit timeline'));
        await user.click(
            within(app.getByTestId("2024-03-01-events")).getByText("Watered")
        );
        mockFetchResponse({
            deleted: {
                water: ["2024-03-01T10:00:00+00:00"],
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

        // Confirm March 1 TimelineDay was removed (only 1 dot and marker left)
        expect(app.container.querySelectorAll('.dot > .bg-info').length).toBe(1);
        expect(app.container.querySelectorAll('.fa-inline.text-info').length).toBe(1);
    });

    // Original bug: If a YYYY-MM-DD date contained photos and/or notes but no
    // events a dateKey would exist in timelineDays but not calendarDays, since
    // calendarDays only shows events. When an event was added on the same date
    // timelineSlice.eventAdded would build a new events array and write it to
    // calendarDays[dateKey].events, which did not exist (dateKey missing).
    // This prevented the event from rendering to the timeline or calendar.
    it('does not fail to add first event to day with existing photos/notes', async () => {
        // Mock expected /add_plant_photos response when 2 photos are uploaded
        // (pending) followed by /get_photo_upload_status response (completed)
        mockMultipleFetchResponses([
            [{
                uploaded: "2 photo(s)",
                failed: [],
                urls: [
                    {
                        timestamp: "2024-03-01T20:52:03+00:00",
                        image: "/media/images/photo1.jpg",
                        thumbnail: null,
                        preview: null,
                        key: 12,
                        pending: true
                    },
                    {
                        timestamp: "2024-03-01T20:54:03+00:00",
                        image: "/media/images/photo2.jpg",
                        thumbnail: null,
                        preview: null,
                        key: 13,
                        pending: true
                    }
                ]
            }],
            [{
                photos: [
                    {
                        status: 'complete',
                        plant_id: mockContextNoEvents.plant_details.uuid,
                        photo_details: {
                            timestamp: "2024-03-01T20:52:03+00:00",
                            image: "/media/images/photo1.jpg",
                            thumbnail: "/media/images/photo1_thumb.webp",
                            preview: "/media/images/photo1_preview.webp",
                            key: 12,
                            pending: false
                        }
                    },
                    {
                        status: 'complete',
                        plant_id: mockContextNoEvents.plant_details.uuid,
                        photo_details: {
                            timestamp: "2024-03-01T20:54:03+00:00",
                            image: "/media/images/photo2.jpg",
                            thumbnail: "/media/images/photo2_thumb.webp",
                            preview: "/media/images/photo2_preview.webp",
                            key: 13,
                            pending: false
                        }
                    }
                ]
            }]
        ]);

        // Simulate user opening photo modal and selecting 2 files
        await user.click(app.getByText('Add photos'));
        await act(async () => await jest.advanceTimersByTimeAsync(100));
        const fileInput = app.getByTestId('photo-input');
        fireEvent.change(fileInput, { target: { files: [
            new File(['file1'], 'file1.jpg', { type: 'image/jpeg' }),
            new File(['file2'], 'file2.jpg', { type: 'image/jpeg' })
        ] } });
        await act(async () => await jest.advanceTimersByTimeAsync(100));
        await act(async () => await jest.advanceTimersByTimeAsync(2500));

        // Confirm no water events exist in calendar or timeline
        expect(app.container.querySelectorAll('.dot > .bg-info').length).toBe(0);
        expect(app.container.querySelectorAll('.fa-inline.text-info').length).toBe(0);

        // Mock fetch function to return expected response when water event added
        mockFetchResponse({
            action: "water",
            timestamp: "2024-03-01T20:54:03+00:00",
            plant: "0640ec3b-1bed-4b15-a078-d6e7ec66be12"
        });

        // Click water button (datetime input contains same day as photos)
        await user.click(app.getByRole("button", {name: "Water"}));

        // Confirm dot appeared on calendar, EventMarker appeared in timeline
        expect(app.container.querySelectorAll('.dot > .bg-info').length).toBe(1);
        expect(app.container.querySelectorAll('.fa-inline.text-info').length).toBe(1);
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
        // Mock expected /add_plant_photos response when 2 photos are uploaded
        // (pending) followed by /get_photo_upload_status response (completed)
        mockMultipleFetchResponses([
            [{
                uploaded: "2 photo(s)",
                failed: [],
                urls: [
                    {
                        timestamp: "2024-03-01T20:54:03+00:00",
                        image: "/media/images/photo1.jpg",
                        thumbnail: null,
                        preview: null,
                        key: 12,
                        pending: true
                    },
                    {
                        timestamp: "2024-03-01T20:52:03+00:00",
                        image: "/media/images/photo2.jpg",
                        thumbnail: null,
                        preview: null,
                        key: 13,
                        pending: true
                    }
                ]
            }],
            [{
                photos: [
                    {
                        status: 'complete',
                        plant_id: mockContextNoEvents.plant_details.uuid,
                        photo_details: {
                            timestamp: "2024-03-01T20:54:03+00:00",
                            image: "/media/images/photo1.jpg",
                            thumbnail: "/media/images/photo1_thumb.webp",
                            preview: "/media/images/photo1_preview.webp",
                            key: 12,
                            pending: false
                        }
                    },
                    {
                        status: 'complete',
                        plant_id: mockContextNoEvents.plant_details.uuid,
                        photo_details: {
                            timestamp: "2024-03-01T20:52:03+00:00",
                            image: "/media/images/photo2.jpg",
                            thumbnail: "/media/images/photo2_thumb.webp",
                            preview: "/media/images/photo2_preview.webp",
                            key: 13,
                            pending: false
                        }
                    }
                ]
            }]
        ]);

        // Simulate user opening photo modal and selecting 2 files
        await user.click(app.getByText('Add photos'));
        await act(async () => await jest.advanceTimersByTimeAsync(100));
        const fileInput = app.getByTestId('photo-input');
        fireEvent.change(fileInput, { target: { files: [
            new File(['photo1'], 'photo1.jpg', { type: 'image/jpeg' }),
            new File(['photo2'], 'photo2.jpg', { type: 'image/jpeg' })
        ] } });
        await act(async () => await jest.advanceTimersByTimeAsync(100));
        await act(async () => await jest.advanceTimersByTimeAsync(2500));

        // Confirm both photos rendered to the timeline
        expect(app.getByTitle('12:52 PM - March 1, 2024')).not.toBeNull();
        expect(app.getByTitle('12:54 PM - March 1, 2024')).not.toBeNull();

        // Mock fetch to return expected response when newest photo is deleted
        mockFetchResponse({
            deleted: [12],
            failed: []
        });

        // Simulate user entering delete mode, selecting first photo
        await user.click(app.getByText('Edit timeline'));
        await user.click(app.getByTitle('12:54 PM - March 1, 2024'));
        // Simulate user holding delete button for 1.5 seconds
        const button = app.getByText('Delete');
        fireEvent.pointerDown(button);
        await act(async () => await jest.advanceTimersByTimeAsync(1500));
        fireEvent.pointerUp(button);

        // Confirm the deleted photo is no longer in the timeline
        expect(app.getByTitle('12:52 PM - March 1, 2024')).not.toBeNull();
        expect(app.queryByTitle('12:54 PM - March 1, 2024')).toBeNull();
    });

    // Original bug: The top-left dropdown contained a gallery link even if no
    // photos existed, which rendered an empty lightbox with no explanation.
    it('only shows gallery and delete mode links if 1 or more photos exist', async () => {
        // Confirm Gallery and Edit timeline dropdown options were not rendered
        expect(app.queryByText('Gallery')).toBeNull();
        expect(app.queryByText('Edit timeline')).toBeNull();

        // Mock expected /add_plant_photos response when photo is uploaded
        // (pending) followed by /get_photo_upload_status response (completed)
        mockMultipleFetchResponses([
            [{
                uploaded: "1 photo(s)",
                failed: [],
                urls: [
                    {
                        timestamp: "2024-06-21T20:52:03+00:00",
                        image: "/media/images/photo1.jpg",
                        thumbnail: null,
                        preview: null,
                        key: 1,
                        pending: true
                    }
                ]
            }],
            [{
                photos: [
                    {
                        status: 'complete',
                        plant_id: mockContextNoEvents.plant_details.uuid,
                        photo_details: {
                            timestamp: "2024-06-21T20:52:03+00:00",
                            image: "/media/images/photo1.jpg",
                            thumbnail: "/media/images/photo1_thumb.webp",
                            preview: "/media/images/photo1_preview.webp",
                            key: 1,
                            pending: false
                        }
                    },
                ]
            }]
        ]);

        // Simulate user opening photo modal and selecting 1 photo
        await user.click(app.getByText('Add photos'));
        await act(async () => await jest.advanceTimersByTimeAsync(100));
        const fileInput = app.getByTestId('photo-input');
        fireEvent.change(fileInput, { target: { files: [
            new File(['file1'], 'file1.jpg', { type: 'image/jpeg' })
        ] } });
        await act(async () => await jest.advanceTimersByTimeAsync(100));
        await act(async () => await jest.advanceTimersByTimeAsync(2500));

        // Confirm Gallery and Edit timeline dropdown options appeared
        expect(app.queryByText('Gallery')).not.toBeNull();
        expect(app.queryByText('Edit timeline')).not.toBeNull();

        // Mock fetch function to return expected response when photo is deleted
        mockFetchResponse({
            deleted: [1],
            failed: []
        });

        // Simulate user entering delete mode, selecting photo
        await user.click(app.getByText('Edit timeline'));
        await user.click(app.getByTitle('12:52 PM - June 21, 2024'));
        // Simulate user holding delete button for 1.5 seconds
        const button = app.getByText('Delete');
        fireEvent.pointerDown(button);
        await act(async () => await jest.advanceTimersByTimeAsync(1500));
        fireEvent.pointerUp(button);

        // Confirm Gallery and Edit timeline dropdown options were removed
        expect(app.queryByText('Gallery')).toBeNull();
        expect(app.queryByText('Edit timeline')).toBeNull();
    });

    it('only shows delete mode dropdown option if events exist', async () => {
        // Confirm Edit timeline dropdown option was not rendered
        expect(app.queryByText('Edit timeline')).toBeNull();

        // Mock fetch function to return expected response when water event added
        mockFetchResponse({
            action: "water",
            timestamp: "2024-03-01T15:45:44+00:00",
            plant: "0640ec3b-1bed-4b15-a078-d6e7ec66be12"
        });

        // Click water button
        await user.click(app.getByRole("button", {name: "Water"}));

        // Confirm Edit timeline dropdown option appeared
        expect(app.queryByText('Edit timeline')).not.toBeNull();

        // Mock fetch function to return expected response when water event deleted
        mockFetchResponse({
            deleted: {
                water: ["2024-03-01T15:45:44+00:00"],
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

        // Start deleting events, select water event
        await user.click(app.getByText('Edit timeline'));
        await user.click(
            within(app.getByTestId("2024-03-01-events")).getByText("Watered")
        );
        mockFetchResponse({
            deleted: {
                water: ["2024-03-01T15:45:44+00:00"],
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

        // Confirm Edit timeline dropdown option was removed
        expect(app.queryByText('Edit timeline')).toBeNull();
    });

    it('does not clear DivisionModal contents if user closes modal', async () => {
        // Open DivisionModal, confirm modal appears
        await user.click(app.getByText('Divide plant'));
        await waitFor(() => {
            expect(app.queryByText('When did you divide your plant?')).not.toBeNull();
        });

        // Mock fetch function to return expected /divide_plant response
        mockFetchResponse({
            plant_key: 'divided-parent-key',
            division_event_key: 'division-event-key',
            action: 'divide',
            plant: "0640ec3b-1bed-4b15-a078-d6e7ec66be12"
        });

        // Simulate user creating DivisionEvent
        await user.click(app.getByRole('button', { name: 'Start Dividing' }));
        await act(async () => await jest.advanceTimersByTimeAsync(100));

        // Confirm instructions disappeared, register child buttons appeared
        expect(app.queryByText(/Dividing a plant lets you register new plants/)).toBeNull();
        expect(app.getByRole('button', { name: 'Register with QR code' })).toBeInTheDocument();

        // Close modal
        await user.click(app.getByLabelText('Close modal'));
        await act(async () => await jest.advanceTimersByTimeAsync(1000));

        // Open modal again, confirm still on second step (did not remount)
        await user.click(app.getByText('Divide plant'));
        expect(app.queryByText(/Dividing a plant lets you register new plants/)).toBeNull();
        expect(app.getByRole('button', { name: 'Register with QR code' })).toBeInTheDocument();
    });
});
