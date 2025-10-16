import { createSlice } from '@reduxjs/toolkit';
import { timestampToDateString } from 'src/utils/timestampUtils';
import { getDateKey, nonEmptyKeys, sortPhotosChronologically } from './store';

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
// timelineDays and calendarDays if not
function removeDateKeyIfEmpty(state, dateKey) {
    if (state.timelineDays[dateKey] &&
        !state.timelineDays[dateKey].notes.length &&
        !state.timelineDays[dateKey].photos.length &&
        !nonEmptyKeys(state.timelineDays[dateKey].events).length &&
        !state.timelineDays[dateKey].dividedFrom &&
        !state.timelineDays[dateKey].dividedInto
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
        //   events      (object with event type keys, array of timestamps values)
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

            // Add new event to correct dateKey in calendarDays and timelineDays
            const dateKey = getDateKey(state, newEvent.timestamp);
            state.timelineDays[dateKey].events[newEvent.type].push(newEvent.timestamp);
            state.calendarDays[dateKey] = nonEmptyKeys(state.timelineDays[dateKey].events);

            // First event added: add delete events dropdown option
            if (!state.hasEvents) {
                state.hasEvents = true;
            }
        },

        // Takes object with event types as keys, array of timestamps as values
        // Removes each event from events, calendarDays, and timelineDays states
        eventsDeleted(state, action) {
            Object.entries(action.payload).forEach(
                ([eventType, timestamps]) => timestamps.forEach(timestamp => {
                    // Remove event from events state
                    state.eventsByType[eventType].splice(
                        state.eventsByType[eventType].indexOf(timestamp),
                        1
                    );

                    // Remove event from timelineDays
                    const dateKey = timestampToDateString(timestamp);
                    state.timelineDays[dateKey].events[eventType].splice(
                        state.timelineDays[dateKey].events[eventType].indexOf(timestamp),
                        1
                    );
                    // Remove from calendarDays if no other events with same type exist
                    if (!state.timelineDays[dateKey].events[eventType].length) {
                        state.calendarDays[dateKey].splice(
                            state.calendarDays[dateKey].indexOf(eventType),
                            1
                        );
                        // Remove calendarDays and timelineDays day if no content left
                        removeDateKeyIfEmpty(state, dateKey);
                    }
                })
            );

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
            const dateKey = getDateKey(state, note.timestamp);
            state.timelineDays[dateKey].notes.push(note);
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

        // Takes array of deleted note timestamps, removes from timelineDays state
        notesDeleted(state, action) {
            action.payload.forEach(noteTime => {
                // Parse YYYY-MM-DD from deleted note timestamp
                const dateKey = timestampToDateString(noteTime);
                // Find in timelineDays state and remove
                state.timelineDays[dateKey].notes =
                    state.timelineDays[dateKey].notes.filter(
                        note => note.timestamp !== noteTime
                    );
                // Remove timelineDays day if no content left
                removeDateKeyIfEmpty(state, dateKey);
            });
        },

        // Takes photo URLs from API response when new photos are uploaded
        photosAdded(state, action) {
            const photos = action.payload;

            // Add new URLs to timelineDays state used to render timeline
            photos.forEach((photo) => {
                const dateKey = getDateKey(state, photo.timestamp);
                state.timelineDays[dateKey].photos.push(photo);
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
    }
});

// Export individual action creators from slice
export const {
    eventAdded,
    eventsDeleted,
    noteAdded,
    noteEdited,
    notesDeleted,
    photosAdded,
    photosDeleted,
    defaultPhotoChanged
} = timelineSlice.actions;
