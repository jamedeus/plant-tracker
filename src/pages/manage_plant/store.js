import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { parseDomContext } from 'src/util';
import { timestampToDateString } from 'src/timestampUtils';
import { plantSlice } from './plantSlice';
import { timelineSlice } from './timelineSlice';

// Takes object with event type keys, array of timestamps as value.
// Converts to object with YYYY-MM-DD keys, each containing an object with
// "events", "notes", and "photos" keys used to populate timeline.
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
// Merges and returns 2 state objects:
// - timelineDays: YYYY-MM-DD keys containing objects with events, notes, and
//   photos keys (all arrays). Used by Timeline and EventCalendar components.
// - navigationOptions: YYYY keys containing array of MM strings, populates
//   quick navigation dropdown options at top of Timeline component
export const buildStateObjects = (events, notes, photoUrls) => {
    // Convert to object with YYYY-MM-DD keys
    const timelineDays = formatEvents(events);

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
        timelineDays,
        navigationOptions
    };
};

// Takes initial timelineDays state, creates redux store and returns
function createReduxStore(preloadedState) {
    return configureStore({
        reducer: {
            plant: plantSlice.reducer,
            timeline: timelineSlice.reducer
        },
        preloadedState
    });
}

export function ReduxProvider({ children }) {
    // Parses django context elements containing events, photoUrls, and notes
    // Merges and returns values for all initialState keys in timelineSlice
    const init = () => {
        // Parse django context objects
        const plantDetails = parseDomContext("plant_details") || {};
        const groupOptions = parseDomContext("group_options") || [];
        const events = parseDomContext("events") || {};
        const photoUrls = parseDomContext('photo_urls') || [];
        const notes = parseDomContext('notes') || [];

        // Build state objects
        const {
            timelineDays,
            navigationOptions
        } = buildStateObjects(events, notes, photoUrls);

        // Return object with keys expected by plantSlice and timelineSlice
        return {
            plant: {
                plantDetails,
                groupOptions,
                events
            },
            timeline: {
                timelineDays,
                photoUrls,
                navigationOptions
            }
        };
    };

    // Create redux store with initial state built from django context items
    const store = useMemo(() => createReduxStore(
        init()
    ), []);

    return (
        <Provider store={store}>
            {children}
        </Provider>
    );
}

ReduxProvider.propTypes = {
    children: PropTypes.node
};
