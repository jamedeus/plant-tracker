import React, { useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import { Provider } from 'react-redux';
import { configureStore, createSlice } from '@reduxjs/toolkit';
import { parseDomContext } from 'src/util';
import { timestampToDateString } from 'src/timestampUtils';

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
    // Rmove month if no timelineDays have the same year and month
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
        // Remove navigationOption if no more content in month
        removeNavigationOption(state, dateKey);
    }
}

// Takes object with event type keys, array of timestamps as value.
// Converts to object with date string keys, each containing an object with
// "events", "notes", and "photos" keys used to populate timeline
const formatEvents = (events) => {
    return Object.entries(events).reduce(
        (acc, [eventType, eventDates]) => {
            eventDates.forEach(date => {
                const dateKey = timestampToDateString(date);
                // Add new date key unless it already exists
                if (!acc[dateKey]) {
                    acc[dateKey] = {events: [], notes: [], photos: []};
                }
                // Add event to date key unless same type already exists
                if (!acc[dateKey]['events'].includes(eventType)) {
                    acc[dateKey]['events'].push(eventType);
                }
            });
            return acc;
        },
        {}
    );
};

// Takes events, notes, and photo_urls context objects from django backend
// Merges and returns 3 state objects:
// - formattedEvents: YYYY-MM-DD keys, used by EventCalendar component
// - timelineDays: YYYY-MM-DD keys, used by Timeline component
// - navigationOptions: YYYY keys containing array of MM strings, populates
//   quick navigation dropdown options at top of Timeline component
const buildStateObjects = (events, notes, photoUrls) => {
    const formattedEvents = formatEvents(events);

    // Deep copy to avoid mutating upstream state
    const timelineDays = JSON.parse(JSON.stringify(formattedEvents));

    // Add contents of photoUrls to photos key under correct date
    photoUrls.sort((a, b) => {
        return a.created.localeCompare(b.created);
    }).reverse();
    photoUrls.forEach((photo) => {
        const dateKey = timestampToDateString(photo.created);
        if (!timelineDays[dateKey]) {
            timelineDays[dateKey] = {events: [], notes: [], photos: []};
        }
        timelineDays[dateKey].photos.push(photo);
    });

    // Add note text to notes key under correct date
    notes.forEach((note) => {
        const dateKey = timestampToDateString(note.timestamp);
        if (!timelineDays[dateKey]) {
            timelineDays[dateKey] = {events: [], notes: [], photos: []};
        }
        timelineDays[dateKey].notes.push(note);
    });

    // Build object used to populate quick navigation menu
    // Contains years as keys, list of month numbers as values
    const navigationOptions = {};
    Object.keys(timelineDays).forEach(dateString => {
        const [year, month] = dateString.split('-');
        if (!navigationOptions[year]) {
            navigationOptions[year] = [];
        }
        if (!navigationOptions[year].includes(month)) {
            navigationOptions[year].push(month);
        }
    });

    return {
        formattedEvents,
        timelineDays,
        navigationOptions
    };
};

// Centralized redux slice to store timelineDays and photoUrls "states" and all
// callback functions that modify them
const timelineSlice = createSlice({
    name: 'timeline',
    initialState: {
        events: {},
        formattedEvents: {},
        timelineDays: {},
        photoUrls: [],
        navigationOptions: {}
    },
    reducers: {
        // Takes object with timestamp and type keys, adds to events,
        // formattedEvents, and timelineDays states
        eventAdded(state, action) {
            const newEvent = action.payload;
            const dateKey = timestampToDateString(newEvent.timestamp);
            state.events[newEvent.type].push(newEvent.timestamp);
            state.events[newEvent.type].sort().reverse();
            // Add new dateKey if missing
            if (!state.formattedEvents[dateKey]) {
                state.formattedEvents[dateKey] = {
                    events: [ newEvent.type ],
                    notes: [],
                    photos: []
                };
                // Add navigationOption if first dateKey in year + month
                addNavigationOption(state, dateKey);
            // Add new events to existing dateKey
            } else if (!state.formattedEvents[dateKey].events.includes(newEvent.type)) {
                state.formattedEvents[dateKey].events.push(newEvent.type);
            }
            // Add new dateKey if missing
            if (!state.timelineDays[dateKey]) {
                state.timelineDays[dateKey] = {
                    events: [ newEvent.type ],
                    notes: [],
                    photos: []
                };
                // Add navigationOption if first dateKey in year + month
                addNavigationOption(state, dateKey);
            // Add new events to existing dateKey
            } else if (!state.timelineDays[dateKey].events.includes(newEvent.type)) {
                state.timelineDays[dateKey].events.push(newEvent.type);
            }
        },

        // Takes object with timestamp and type keys, removes from events,
        // formattedEvents, and timelineDays states
        eventDeleted(state, action) {
            const deletedEvent = action.payload;
            const dateKey = timestampToDateString(deletedEvent.timestamp);
            state.events[deletedEvent.type].splice(
                state.events[deletedEvent.type].indexOf(deletedEvent.timestamp),
                1
            );
            state.formattedEvents[dateKey].events = state.formattedEvents[dateKey].events.filter(
                event => event !== deletedEvent.type
            );
            state.timelineDays[dateKey].events = state.timelineDays[dateKey].events.filter(
                event => event !== deletedEvent.type
            );
            // Remove timelineDays day if no content left
            removeDateKeyIfEmpty(state, dateKey);
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
            state.photoUrls = state.photoUrls.concat(photos).sort((a, b) => {
                return a.created.localeCompare(b.created);
            }).reverse();
        },

        // Takes array of deleted photo keys, removes from photoUrls state and
        // from photos key in correct day of timelineDays state
        photosDeleted(state, action) {
            const deletedKeys = action.payload;
            state.photoUrls = state.photoUrls.filter((photo) => {
                if (deletedKeys.includes(photo.key)) {
                    // Parse YYYY-MM-DD from deleted photo timestamp, find in
                    // timelineDays state and remove
                    const dateKey = timestampToDateString(photo.created);
                    if (state.timelineDays[dateKey]) {
                        state.timelineDays[dateKey].photos = state.timelineDays[dateKey].photos.filter(
                            photo => !deletedKeys.includes(photo.key)
                        );
                    }
                    // Remove timelineDays day if no content left
                    removeDateKeyIfEmpty(state, dateKey);
                    // Return false (remove from photoUrls)
                    return false;
                }
                return true;
            });
        },

        // Takes response from /get_plant_state endpoint, rebuilds all state
        // objects with new contents. Called when page navigated to using back
        // button (update potentially outdated contents).
        backButtonPressed(state, action) {
            state.events = action.payload.events;

            const {
                formattedEvents,
                timelineDays,
                navigationOptions
            } = buildStateObjects(
                action.payload.events,
                action.payload.notes,
                action.payload.photo_urls
            );
            state.formattedEvents = formattedEvents;
            state.timelineDays = timelineDays;
            state.navigationOptions = navigationOptions;
        }
    }
});

// Takes initial timelineDays state, creates redux store and returns
function createTimelineStore(preloadedState) {
    return configureStore({
        reducer: timelineSlice.reducer,
        preloadedState
    });
}

// Simulate useContext provider so formattedEvents can be passed as prop and
// used to build redux preloadedState
export function TimelineProvider({ children }) {
    // Parses django context elements containing events, photoUrls, and notes
    // Merges and returns values for all initialState keys in timelineSlice
    const init = () => {
        // Parse django context objects
        const events = parseDomContext("events") || [];
        const photoUrls = parseDomContext('photo_urls') || [];
        const notes = parseDomContext('notes') || [];

        // Build state objects
        const {
            formattedEvents,
            timelineDays,
            navigationOptions
        } = buildStateObjects(events, notes, photoUrls);

        // Return object with keys expected by timelineSlice preloadedState
        return {
            events,
            formattedEvents,
            timelineDays,
            photoUrls,
            navigationOptions
        };
    };

    // Create redux store with initial state built from django context items
    const store = useMemo(() => createTimelineStore(
        init()
    ), []);

    return (
        <Provider store={store}>
            {children}
        </Provider>
    );
}

TimelineProvider.propTypes = {
    children: PropTypes.node
};

// Export individual action creators from slice
export const {
    eventAdded,
    eventDeleted,
    noteAdded,
    noteEdited,
    noteDeleted,
    photosAdded,
    photosDeleted,
    backButtonPressed
} = timelineSlice.actions;
