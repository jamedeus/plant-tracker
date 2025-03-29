import React, { useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import { Provider } from 'react-redux';
import { configureStore, createSlice } from '@reduxjs/toolkit';
import { parseDomContext } from 'src/util';
import { timestampToDateString } from 'src/timestampUtils';

// Takes 2 arrays, returns True if contents are identical, otherwise False
const compareEvents = (array1, array2) => {
    return array1.length === array2.length &&
        array1.every((value, index) => value === array2[index]);
};

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

// Centralized redux slice to store timelineDays and photoUrls "states" and all
// callback functions that modify them
const timelineSlice = createSlice({
    name: 'timeline',
    initialState: {
        timelineDays: {},
        photoUrls: [],
        navigationOptions: {}
    },
    reducers: {
        // Takes formattedEvents, incrementally updates events in timelineDays
        // Called by useEffect in TimelineProvider when formattedEvents changes
        formattedEventsUpdated(state, action) {
            const formattedEvents = action.payload;

            // Copy new events from formattedEvents to timelineDays
            Object.keys(formattedEvents).forEach((dateKey) => {
                // Add new dateKey if missing
                if (!state.timelineDays[dateKey]) {
                    state.timelineDays[dateKey] = {
                        events: [ ...formattedEvents[dateKey].events ],
                        notes: [],
                        photos: []
                    };
                    // Add navigationOption if first dateKey in year + month
                    addNavigationOption(state, dateKey);
                // Add new events to existing dateKey
                } else if (!compareEvents(
                    state.timelineDays[dateKey].events,
                    formattedEvents[dateKey].events
                )) {
                    state.timelineDays[dateKey] = {
                        ...state.timelineDays[dateKey],
                        events: [ ...formattedEvents[dateKey].events ]
                    };
                }
            });

            // Remove events that no longer exist
            Object.keys(state.timelineDays).forEach((dateKey) => {
                if (!Object.keys(formattedEvents).includes(dateKey)) {
                    // Clear events array if not already empty
                    if (state.timelineDays[dateKey].events.length) {
                        state.timelineDays[dateKey].events = [];
                    }
                    // Remove whole day section if no notes or photos
                    removeDateKeyIfEmpty(state, dateKey);
                }
            });
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
export function TimelineProvider({ formattedEvents, children }) {
    // Merges items from notes and photoUrls states into formattedEvents param
    const buildTimelineDays = () => {
        // Deep copy to avoid mutating upstream state
        const timelineDays = JSON.parse(JSON.stringify(formattedEvents));

        // Add contents of photoUrls to photos key under correct date
        const photoUrls = parseDomContext('photo_urls') || [];
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
        const notes = parseDomContext('notes') || [];
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

        // Return object with keys expected by timelineSlice preloadedState
        return {
            timelineDays,
            photoUrls,
            navigationOptions
        };
    };

    // Create redux store with initial timelineDays state
    const store = useMemo(() => createTimelineStore(
        buildTimelineDays()
    ), []);

    // Update timelineDays state incrementally when formattedEvents is modified
    // (only render day with new/removed events)
    useEffect(() => {
        store.dispatch((dispatch) => {
            dispatch(
                timelineSlice.actions.formattedEventsUpdated(formattedEvents)
            );
        });
    }, [formattedEvents, store]);

    return (
        <Provider store={store}>
            {children}
        </Provider>
    );
}

TimelineProvider.propTypes = {
    formattedEvents: PropTypes.object.isRequired,
    children: PropTypes.node
};

// Export individual action creators from slice
export const {
    noteAdded,
    noteEdited,
    noteDeleted,
    photosAdded,
    photosDeleted,
    setPhotoUrls
} = timelineSlice.actions;
