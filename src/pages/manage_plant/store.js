import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { parseDomContext } from 'src/util';
import { timestampToDateString } from 'src/timestampUtils';
import { plantSlice } from './plantSlice';
import { timelineSlice } from './timelineSlice';
import { settingsSlice } from './settingsSlice';
import { loadUserSettings } from './Settings';
import { useIsBreakpointActive } from 'src/useBreakpoint';

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

// Takes events, notes, and photos context objects from django backend, returns
// timelineDays state used by Timeline component (YYYY-MM-DD keys containing
// objects with events, notes, and photos keys).
export const buildTimelineDays = (events, notes, photos) => {
    // Convert to object with YYYY-MM-DD keys
    const timelineDays = formatEvents(events);

    // Add objects from photos context to photos key under correct dateKey
    photos.sort((a, b) => {
        return a.timestamp.localeCompare(b.timestamp);
    }).reverse();
    photos.forEach((photo) => {
        const dateKey = timestampToDateString(photo.timestamp);
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

    return timelineDays;
};

// Takes timelineDays state, flattens and returns calendarDays state used by
// EventCalendar component (YYYY-MM-DD keys containing array of event strings).
export const buildCalendarDays = (timelineDays) => {
    const calendarDays = {};
    Object.keys(timelineDays).forEach(dateKey => {
        if (timelineDays[dateKey].events.length) {
            calendarDays[dateKey] = timelineDays[dateKey].events;
        }
    });
    return calendarDays;
};

// Takes timelineDays state, returns navigationOptions state used to populate
// timeline QuickNavigation options (YYYY keys containing array of MM strings).
export const buildNavigationOptions = (timelineDays) => {
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
    // Sort months in each year chronologically (timelineDays is not sorted)
    Object.keys(navigationOptions).forEach(year =>
        navigationOptions[year].sort().reverse()
    );
    return navigationOptions;
};

// Takes initial plantSlice and timelineSlice states, returns redux store
function createReduxStore(preloadedState) {
    return configureStore({
        reducer: {
            plant: plantSlice.reducer,
            timeline: timelineSlice.reducer,
            settings: settingsSlice.reducer
        },
        preloadedState
    });
}

export function ReduxProvider({ children }) {
    // Get layout string used to look up default settings for current breakpoint
    const layout = useIsBreakpointActive("md") ? 'desktop' : 'mobile';

    // Parses django context elements containing events, photos, and notes
    // Merges and returns values for all initialState keys in timelineSlice
    const init = () => {
        // Parse django context objects
        const plantDetails = parseDomContext("plant_details");
        const groupOptions = parseDomContext("group_options");
        const eventsByType = parseDomContext("events");
        const photos = parseDomContext('photos');
        const notes = parseDomContext('notes');
        const defaultPhoto = parseDomContext('default_photo');
        const photoGalleryIndex = 0;
        const photoGalleryOpen = false;

        // Build state objects
        const timelineDays = buildTimelineDays(eventsByType, notes, photos);
        const calendarDays = buildCalendarDays(timelineDays);
        const navigationOptions = buildNavigationOptions(timelineDays);

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
                navigationOptions,
                defaultPhoto,
                photoGalleryIndex,
                photoGalleryOpen
            },
            settings: loadUserSettings(layout)
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
