import { createSlice } from '@reduxjs/toolkit';
import { timestampToDateString } from 'src/timestampUtils';
import { backButtonPressed } from './plantSlice';
import {
    buildTimelineDays,
    buildCalendarDays,
    buildNavigationOptions
} from './store';

// Correct order for event markers within a single timeline day (readability)
const EVENTS_ORDER = ['water', 'fertilize', 'prune', 'repot'];

// Takes timelineSlice state and new YYYY-MM-DD dateKey
// Adds month and year to navigationOptions if not already present
function addNavigationOption(state, dateKey) {
    const [year, month] = dateKey.split('-');
    if (!state.navigationOptions[year]) {
        state.navigationOptions[year] = [];
    }
    if (!state.navigationOptions[year].includes(month)) {
        state.navigationOptions[year].push(month);
        state.navigationOptions[year].sort().reverse();
    }
}

// Takes timelineSlice state and removed YYYY-MM-DD dateKey
// Removes month and year from navigationOptions if there are no days left in
// timelineDays in the same month and year
function removeNavigationOption(state, dateKey) {
    const [year, month] = dateKey.split('-');
    // Remove month if no timelineDays have the same year and month
    if (!Object.keys(state.timelineDays).filter(
        datestring => datestring.startsWith(`${year}-${month}`)
    ).length) {
        state.navigationOptions[year].splice(
            state.navigationOptions[year].indexOf(month),
            1
        );
    }
    // Remove year if no timelineDays have the same year
    if (!Object.keys(state.timelineDays).filter(
        datestring => datestring.startsWith(year)
    ).length) {
        delete state.navigationOptions[year];
    }
}

// Takes timelineSlice state and YYYY-MM-DD dateKey of a removed item
// Checks if any content exists on the same date, removes dateKey from
// timelineDays if not
function removeDateKeyIfEmpty(state, dateKey) {
    if (state.timelineDays[dateKey] &&
        !state.timelineDays[dateKey].notes.length &&
        !state.timelineDays[dateKey].photos.length &&
        !state.timelineDays[dateKey].events.length
    ) {
        delete state.timelineDays[dateKey];
        delete state.calendarDays[dateKey];
        // Remove navigationOption if no more content in month
        removeNavigationOption(state, dateKey);
    }
}

// Redux slice to store all state related to the Timeline component (events,
// notes, photos) and callback functions that modify them
export const timelineSlice = createSlice({
    name: 'timeline',
    initialState: {
        // All arrays contain full ISO event timestamps in UTC
        eventsByType: {
            water: [],
            fertilize: [],
            prune: [],
            repot: []
        },
        // Keys are YYYY-MM-DD in user's local timezone
        // Values are array of event types (eg ['water', 'fertilize'])
        calendarDays: {},
        // Keys are YYYY-MM-DD in user's local timezone
        // Values are objects with 3 keys:
        //   events      (array of strings)
        //   notes       (array of objects with text and timestamp keys)
        //   photos      (array of objects with same keys as photos state)
        timelineDays: {},
        // Array of objects each representing 1 photo, keys:
        //   created     (full ISO timestamp in UTC)
        //   image       (full resolution URL)
        //   thumbnail   (thumbnail image URL)
        //   key         (backend database key used to delete photo)
        photos: [],
        // Keys are year strings (YYYY), values are array of month strings (MM)
        navigationOptions: {}
    },
    reducers: {
        // Takes object with timestamp and type keys, adds to events,
        // calendarDays, and timelineDays states
        eventAdded(state, action) {
            // Add new event to events state
            const newEvent = action.payload;
            state.eventsByType[newEvent.type].push(newEvent.timestamp);
            state.eventsByType[newEvent.type].sort().reverse();

            // Add new dateKey to calendarDays and timelineDays if missing
            const dateKey = timestampToDateString(newEvent.timestamp);
            if (!state.timelineDays[dateKey]) {
                const day = {
                    events: [ newEvent.type ],
                    notes: [],
                    photos: []
                };
                state.calendarDays[dateKey] = day.events;
                state.timelineDays[dateKey] = day;
                // Add navigationOption if first dateKey in year + month
                addNavigationOption(state, dateKey);

            // Add new events to existing dateKey in calendarDays and timelineDays
            } else if (!state.timelineDays[dateKey].events.includes(newEvent.type)) {
                const newEvents = [
                    ...state.timelineDays[dateKey].events,
                    newEvent.type
                ].sort(
                    (a, b) => EVENTS_ORDER.indexOf(a) - EVENTS_ORDER.indexOf(b)
                );
                state.calendarDays[dateKey] = newEvents;
                state.timelineDays[dateKey].events = newEvents;
            }
        },

        // Takes object with timestamp and type keys, removes from events,
        // calendarDays, and timelineDays states
        eventDeleted(state, action) {
            // Remove event from events state
            const deletedEvent = action.payload;
            state.eventsByType[deletedEvent.type].splice(
                state.eventsByType[deletedEvent.type].indexOf(deletedEvent.timestamp),
                1
            );

            // If no other events with same type exist on same day, remove
            // event from calendarDays and timelineDays
            const dateKey = timestampToDateString(deletedEvent.timestamp);
            if (!state.eventsByType[deletedEvent.type].filter(
                // eventsByType timestamps are UTC so can't just use startsWith
                datestring => timestampToDateString(datestring) === dateKey
            ).length) {
                const newEvents = state.timelineDays[dateKey].events.filter(
                    event => event !== deletedEvent.type
                );
                state.timelineDays[dateKey].events = newEvents;
                state.calendarDays[dateKey] = newEvents;
                // Remove calendarDays and timelineDays day if no content left
                removeDateKeyIfEmpty(state, dateKey);
            }
        },

        // Takes object with timestamp and text keys, adds to timelineDays state
        noteAdded(state, action) {
            const note = action.payload;
            const dateKey = timestampToDateString(note.timestamp);
            // Add new dateKey if missing
            if (!state.timelineDays[dateKey]) {
                state.timelineDays[dateKey] = {
                    events: [],
                    notes: [note],
                    photos: []
                };
            } else {
                state.timelineDays[dateKey].notes.push(note);
            }
            // Add navigationOption if first note in year + month
            addNavigationOption(state, dateKey);
        },

        // Takes note with same timestamp as existing note (timestamp cannot be
        // changed once created), overwrites text in timelineDays state.
        noteEdited(state, action) {
            const note = action.payload;
            const dateKey = timestampToDateString(note.timestamp);
            state.timelineDays[dateKey].notes = state.timelineDays[dateKey].notes.map(
                oldNote => {
                    if (oldNote.timestamp === note.timestamp) {
                        return {timestamp: note.timestamp, text: note.text};
                    }
                    return oldNote;
                }
            );
        },

        // Takes timestamp of deleted note, removes from timelineDays state
        noteDeleted(state, action) {
            const noteTime = action.payload;

            // Parse YYYY-MM-DD from deleted note timestamp, find in
            // timelineDays state and remove
            const dateKey = timestampToDateString(noteTime);
            state.timelineDays[dateKey].notes = state.timelineDays[dateKey].notes.filter(
                note => note.timestamp !== noteTime
            );
            // Remove timelineDays day if no content left
            removeDateKeyIfEmpty(state, dateKey);
        },

        // Takes photo URLs from API response when new photos are uploaded
        photosAdded(state, action) {
            const photos = action.payload;

            // Add new URLs to timelineDays state used to render timeline
            photos.forEach((photo) => {
                const dateKey = timestampToDateString(photo.created);
                // Add new dateKey if missing
                if (!state.timelineDays[dateKey]) {
                    state.timelineDays[dateKey] = {
                        events: [],
                        notes: [],
                        photos: [photo]
                    };
                    // Add navigationOption if first photo in year + month
                    addNavigationOption(state, dateKey);
                } else {
                    // Add photo to photos array for correct day
                    state.timelineDays[dateKey].photos.push(photo);
                }
            });

            // Add new URLs to photoUrl state (used by DeletePhotoModal and
            // DefaultPhotoModal)
            state.photos = state.photos.concat(photos).sort((a, b) => {
                return a.created.localeCompare(b.created);
            }).reverse();
        },

        // Takes array of deleted photo keys, removes from photos state and
        // from photos key in correct day of timelineDays state
        photosDeleted(state, action) {
            const deletedKeys = action.payload;
            state.photos = state.photos.filter((photo) => {
                if (deletedKeys.includes(photo.key)) {
                    // Parse YYYY-MM-DD from deleted photo timestamp, find in
                    // timelineDays state and remove
                    const dateKey = timestampToDateString(photo.created);
                    state.timelineDays[dateKey].photos.splice(
                        state.timelineDays[dateKey].photos.indexOf(photo),
                        1
                    );
                    // Remove timelineDays day if no content left
                    removeDateKeyIfEmpty(state, dateKey);
                    // Return false (remove from state.photos)
                    return false;
                }
                return true;
            });
        },
    },
    extraReducers: builder => {
        // Rebuild all states when user navigates to the page with back button
        // (fetches new state from backend to replace outdated contents)
        builder.addCase(backButtonPressed.fulfilled, (state, action) => {
            const newTimelineDays = buildTimelineDays(
                action.payload.events,
                action.payload.notes,
                action.payload.photos
            );
            state.eventsByType = action.payload.events;
            state.timelineDays = newTimelineDays;
            state.calendarDays = buildCalendarDays(newTimelineDays);
            state.navigationOptions = buildNavigationOptions(newTimelineDays);
        });
    }
});

// Export individual action creators from slice
export const {
    eventAdded,
    eventDeleted,
    noteAdded,
    noteEdited,
    noteDeleted,
    photosAdded,
    photosDeleted
} = timelineSlice.actions;
