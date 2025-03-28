import React, { useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import { Provider, useSelector, useDispatch } from 'react-redux';
import { configureStore, createSlice } from '@reduxjs/toolkit';
import { parseDomContext } from 'src/util';
import { timestampToDateString } from 'src/timestampUtils';

// Takes 2 arrays, returns True if contents are identical, otherwise False
const compareEvents = (array1, array2) => {
    return array1.length === array2.length &&
        array1.every((value, index) => value === array2[index]);
};

// Centralized redux slice to store timelineDays and photoUrls "states" and all
// callback functions that modify them
const timelineSlice = createSlice({
    name: 'timeline',
    initialState: {
        timelineDays: {},
        photoUrls: []
    },
    reducers: {
        // Takes formattedEvents, incrementally updates events in timelineDays
        // Called by useEffect in TimelineProvider when formattedEvents changes
        updateTimelineDays(state, action) {
            const formattedEvents = action.payload;

            // Copy new events from formattedEvents to timelineDays
            Object.keys(formattedEvents).forEach((timestamp) => {
                // Add new timestamp key
                if (!state.timelineDays[timestamp]) {
                    state.timelineDays[timestamp] = {
                        ...formattedEvents[timestamp]
                    };
                // Add new events to existing timestamp key
                } else if (!compareEvents(
                    state.timelineDays[timestamp].events,
                    formattedEvents[timestamp].events
                )) {
                    state.timelineDays[timestamp] = {
                        ...state.timelineDays[timestamp],
                        events: [ ...formattedEvents[timestamp].events ]
                    };
                }
            });

            // Remove events that no longer exist
            Object.keys(state.timelineDays).forEach((timestamp) => {
                if (!Object.keys(formattedEvents).includes(timestamp)) {
                    // Clear events array if not already empty
                    if (state.timelineDays[timestamp].events.length) {
                        state.timelineDays[timestamp].events = [];
                    }
                    // Remove whole day section if no notes or photos
                    if (!state.timelineDays[timestamp].notes.length &&
                        !state.timelineDays[timestamp].photos.length
                    ) {
                        delete state.timelineDays[timestamp];
                    }
                }
            });
        },

        // Takes object with timestamp and text keys, adds to timelineDays state
        addNewNote(state, action) {
            const note = action.payload;
            const dateKey = timestampToDateString(note.timestamp);
            // Add new timestamp key if missing
            if (!state.timelineDays[dateKey]) {
                state.timelineDays[dateKey] = {
                    events: [],
                    notes: [note],
                    photos: []
                };
            } else {
                state.timelineDays[dateKey] = {
                    ...state.timelineDays[dateKey],
                    notes: [ ...state.timelineDays[dateKey].notes, note ]
                };
            }
        },

        // Takes note with same timestamp as existing note (timestamp cannot be
        // changed once created), overwrites text in timelineDays state.
        editExistingNote(state, action) {
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
        deleteNote(state, action) {
            const noteTime = action.payload;

            // Parse YYYY-MM-DD from deleted note timestamp, find in
            // timelineDays state and remove
            const dateKey = timestampToDateString(noteTime);
            state.timelineDays[dateKey].notes = state.timelineDays[dateKey].notes.filter(
                note => note.timestamp !== noteTime
            );
            // Remove timelineDays day if no content left
            if (!state.timelineDays[dateKey].notes.length &&
                !state.timelineDays[dateKey].photos.length &&
                !state.timelineDays[dateKey].events.length
            ) {
                delete state.timelineDays[dateKey];
            }
        },

        // Takes photo URLs from API response when new photos are uploaded
        addPhotos(state, action) {
            const photos = action.payload;

            // Add new URLs to timelineDays state used to render timeline
            photos.forEach((photo) => {
                const dateKey = timestampToDateString(photo.created);
                // Add new timestamp key if missing
                if (!state.timelineDays[dateKey]) {
                    state.timelineDays[dateKey] = {
                        events: [],
                        notes: [],
                        photos: [photo]
                    };
                } else {
                    // Add photo to photos array for correct day
                    state.timelineDays[dateKey] = {
                        ...state.timelineDays[dateKey],
                        photos: [
                            ...state.timelineDays[dateKey].photos, photo
                        ]
                    };
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
        deletePhotos(state, action) {
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
                    if (
                        state.timelineDays[dateKey] &&
                        !state.timelineDays[dateKey].photos.length &&
                        !state.timelineDays[dateKey].events.length &&
                        !state.timelineDays[dateKey].notes.length
                    ) {
                        delete state.timelineDays[dateKey];
                    }
                    // Return false (remove from photoUrls)
                    return false;
                }
                return true;
            });
        },

        // Simulates old photoUrls useState hook, takes new photoUrls contents
        setPhotoUrls(state, action) {
            state.photoUrls = action.payload;
        }
    },
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
        }).reverse()
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

        return {
            // The slice expects certain keys:
            timelineDays,
            photoUrls
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
                timelineSlice.actions.updateTimelineDays(formattedEvents)
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
    addNewNote,
    editExistingNote,
    deleteNote,
    addPhotos,
    deletePhotos,
    setPhotoUrls
} = timelineSlice.actions;
