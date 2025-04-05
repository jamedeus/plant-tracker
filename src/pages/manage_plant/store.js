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

// Takes events, notes, and photos context objects from django backend
// Merges and returns 3 state objects:
// - calendarDays: YYYY-MM-DD keys containing arrays of event type strings.
//   Used by EventCalendar component.
// - timelineDays: YYYY-MM-DD keys containing objects with events, notes, and
//   photos keys (all arrays, all populated). Used by Timeline component.
// - navigationOptions: YYYY keys containing array of MM strings, populates
//   QuickNavigation options in dropdown at top of Timeline component.
export const buildStateObjects = (events, notes, photos) => {
    // Convert to object with YYYY-MM-DD keys (used by Timeline component)
    const timelineDays = formatEvents(events);

    // Add objects from photos context to photos key under correct dateKey
    photos.sort((a, b) => {
        return a.created.localeCompare(b.created);
    }).reverse();
    photos.forEach((photo) => {
        const dateKey = timestampToDateString(photo.created);
        if (!timelineDays[dateKey]) {
            timelineDays[dateKey] = {events: [], notes: [], photos: []};
        }
        timelineDays[dateKey].photos.push(photo);
    });

    // Add objects from notes context to notes key under correct dateKey
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

    // Build calendarDays object (only contains events, used by EventCalendar)
    const calendarDays = {}
    Object.keys(timelineDays).forEach(dateKey => {
        if (timelineDays[dateKey].events.length) {
            calendarDays[dateKey] = timelineDays[dateKey].events
        }
    })

    return {
        calendarDays,
        timelineDays,
        navigationOptions
    };
};

// Takes initial plantSlice and timelineSlice states, returns redux store
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
    // Parses django context elements containing events, photos, and notes
    // Merges and returns values for all initialState keys in timelineSlice
    const init = () => {
        // Parse django context objects
        const plantDetails = parseDomContext("plant_details");
        const groupOptions = parseDomContext("group_options");
        const eventsByType = parseDomContext("events");
        const photos = parseDomContext('photos');
        const notes = parseDomContext('notes');

        // Build state objects
        const {
            calendarDays,
            timelineDays,
            navigationOptions
        } = buildStateObjects(eventsByType, notes, photos);

        // Return object with keys expected by plantSlice and timelineSlice
        return {
            plant: {
                plantDetails,
                groupOptions
            },
            timeline: {
                eventsByType,
                calendarDays,
                timelineDays,
                photos,
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
