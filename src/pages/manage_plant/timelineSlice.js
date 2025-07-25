import { createSlice } from '@reduxjs/toolkit';
import { timestampToDateString } from 'src/timestampUtils';
import { backButtonPressed } from './plantSlice';
import {
    buildTimelineDays,
    buildCalendarDays,
    buildNavigationOptions,
    sortPhotosChronologically
} from './store';

// Correct order for event markers within a single timeline day (readability)
export const EVENTS_ORDER = ['water', 'fertilize', 'prune', 'repot'];

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
        // Object (name, uuid, and timestamp keys) if has parent plant (or false)
        dividedFrom: false,
        // Object with full ISO event timestamps in UTC as keys, array of child
        // plant objects (name and uuid keys) created on that date as values
        divisionEvents: {},
        // Keys are YYYY-MM-DD in user's local timezone
        // Values are array of event types (eg ['water', 'fertilize'])
        calendarDays: {},
        // Keys are YYYY-MM-DD in user's local timezone
        // Values are objects with 3 keys:
        //   events      (array of objects with type and timestamp keys)
        //   notes       (array of objects with text and timestamp keys)
        //   photos      (array of objects with same keys as photos state)
        timelineDays: {},
        // Array of objects each representing 1 photo, keys:
        //   timestamp   (full ISO timestamp in UTC)
        //   photo       (full resolution URL)
        //   thumbnail   (thumbnail image URL)
        //   preview     (preview image URL)
        //   key         (backend database key used to delete photo)
        photos: [],
        // Keys are year strings (YYYY), values are array of month strings (MM)
        navigationOptions: {},
        // Object with set key (true if default photo set, false if not) and
        // details of default photo (or most-recent photo if not set)
        defaultPhoto: {
            set: false,
            timestamp: null,
            photo: null,
            thumbnail: null,
            preview: null,
            key: null
        },
        // Has 1 or more photo (shows gallery dropdown option if true)
        hasPhotos: false,
        // Has 1 or more event (shows delete events dropdown option if true)
        hasEvents: false,
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
                state.timelineDays[dateKey] = {
                    events: [ newEvent ],
                    notes: [],
                    photos: []
                };
                state.calendarDays[dateKey] = [ newEvent.type ];
                // Add navigationOption if first dateKey in year + month
                addNavigationOption(state, dateKey);

            // Add new event to existing dateKey in calendarDays and timelineDays
            } else {
                state.timelineDays[dateKey].events.push(newEvent);
                state.calendarDays[dateKey] = [...new Set(
                    state.timelineDays[dateKey].events.map(event => event.type)
                )].sort(
                    (a, b) => EVENTS_ORDER.indexOf(a) - EVENTS_ORDER.indexOf(b)
                );
            }

            // First event added: add delete events dropdown option
            if (!state.hasEvents) {
                state.hasEvents = true;
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

            // Remove event from timelineDays
            const dateKey = timestampToDateString(deletedEvent.timestamp);
            state.timelineDays[dateKey].events =
                state.timelineDays[dateKey].events.filter(event =>
                    event.type != deletedEvent.type ||
                    event.timestamp != deletedEvent.timestamp
                );
            // Remove from calendarDays if no other events with same type exist
            const sameTypeAndDay = state.timelineDays[dateKey].events.filter(
                event => event.type == deletedEvent.type
            );
            if (!sameTypeAndDay.length) {
                state.calendarDays[dateKey] = state.calendarDays[dateKey].filter(
                    event => event !== deletedEvent.type
                );
                // Remove calendarDays and timelineDays day if no content left
                removeDateKeyIfEmpty(state, dateKey);
            }

            // Last event deleted: remove delete events dropdown option
            if (!state.eventsByType.water.length &&
                !state.eventsByType.fertilize.length &&
                !state.eventsByType.prune.length &&
                !state.eventsByType.repot.length
            ) {
                state.hasEvents = false;
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
            state.timelineDays[dateKey].notes =
                state.timelineDays[dateKey].notes.map(oldNote => {
                    if (oldNote.timestamp === note.timestamp) {
                        return {timestamp: note.timestamp, text: note.text};
                    }
                    return oldNote;
                });
        },

        // Takes timestamp of deleted note, removes from timelineDays state
        noteDeleted(state, action) {
            const noteTime = action.payload;

            // Parse YYYY-MM-DD from deleted note timestamp, find in
            // timelineDays state and remove
            const dateKey = timestampToDateString(noteTime);
            state.timelineDays[dateKey].notes =
                state.timelineDays[dateKey].notes.filter(
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
                const dateKey = timestampToDateString(photo.timestamp);
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

            // Add new URLs to photos state (used by Gallery)
            state.photos = sortPhotosChronologically(
                state.photos.concat(photos)
            );

            // If defaultPhoto not set: Use most-recent photo as default photo
            if (!state.defaultPhoto.set) {
                state.defaultPhoto = { ...state.defaultPhoto, ...state.photos[0] };
            }

            // First photo added: add gallery dropdown option
            if(!state.hasPhotos) {
                state.hasPhotos = true;
            }
        },

        // Takes array of deleted photo keys, removes from photos state and
        // from photos key in correct day of timelineDays state
        photosDeleted(state, action) {
            const deletedKeys = action.payload;
            state.photos = state.photos.filter((photo) => {
                if (deletedKeys.includes(photo.key)) {
                    // Parse YYYY-MM-DD from deleted photo timestamp, find in
                    // timelineDays state and remove
                    const dateKey = timestampToDateString(photo.timestamp);
                    state.timelineDays[dateKey].photos =
                        state.timelineDays[dateKey].photos.filter(
                            p => p.key !== photo.key
                        );
                    // Remove timelineDays day if no content left
                    removeDateKeyIfEmpty(state, dateKey);
                    // Return false (remove from state.photos)
                    return false;
                }
                return true;
            });

            // If last photo deleted: clear default photo state
            if (!state.photos.length) {
                state.defaultPhoto = {
                    set: false,
                    timestamp: null,
                    image: null,
                    thumbnail: null,
                    key: null
                };

                // Remove gallery dropdown option
                state.hasPhotos = false;
            // If defaultPhoto not set: Use most-recent photo as default photo
            } else if (!state.defaultPhoto.set) {
                state.defaultPhoto = { ...state.defaultPhoto, ...state.photos[0] };
            // If defaultPhoto deleted: set defaultPhoto to most-recent photo
            } else if (deletedKeys.includes(state.defaultPhoto?.key)) {
                state.defaultPhoto = { set: false, ...state.photos[0] };
            }
        },

        // Takes object with same keys as defaultPhoto state
        defaultPhotoChanged(state, action) {
            state.defaultPhoto = action.payload;
        },
    },
    extraReducers: builder => {
        // Rebuild all states when user navigates to the page with back button
        // (fetches new state from backend to replace outdated contents)
        builder.addCase(backButtonPressed.fulfilled, (state, action) => {
            // Convert object indexed by photo keys (used for incremental state
            // updates on backend) to array of objects sorted chronologically
            const newPhotos = sortPhotosChronologically(
                Object.values(action.payload.photos)
            );
            // Build new timelineDays state from response objects
            const newTimelineDays = buildTimelineDays(
                action.payload.events,
                action.payload.notes,
                newPhotos,
                action.payload.divided_from,
                action.payload.division_events,
            );
            // Overwrite states
            state.photos = newPhotos;
            state.eventsByType = action.payload.events;
            state.dividedFrom = action.payload.divided_from;
            state.divisionEvents = action.payload.division_events;
            state.defaultPhoto = action.payload.default_photo;
            state.timelineDays = newTimelineDays;
            state.calendarDays = buildCalendarDays(newTimelineDays);
            state.navigationOptions = buildNavigationOptions(newTimelineDays);
            // Set bool states that control dropdown option visibility
            state.hasPhotos = newPhotos.length > 0;
            state.hasEvents = action.payload.events.water.length > 0 ||
                              action.payload.events.fertilize.length > 0 ||
                              action.payload.events.prune.length > 0 ||
                              action.payload.events.repot.length > 0;
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
    photosDeleted,
    defaultPhotoChanged
} = timelineSlice.actions;
