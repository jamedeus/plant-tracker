import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { parseDomContext } from 'src/util';
import { timestampToDateString } from 'src/timestampUtils';
import { plantSlice } from './plantSlice';
import { timelineSlice } from './timelineSlice';
import { settingsSlice } from './settingsSlice';
import { interfaceSlice } from './interfaceSlice';
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

// Takes events, notes, photos, dividedFrom, and divisionEvents context objects
// from django backend, returns timelineDays state used by Timeline component
// (YYYY-MM-DD keys containing objects with events, notes, and photos keys).
//
// Only adds dividedFrom and dividedInto keys to date when plant was divided (no
// empty keys on every day - can only have 1 dividedFrom, dividedInto is rare).
export const buildTimelineDays = (events, notes, photos, dividedFrom, divisionEvents) => {
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

    // Add dividedFrom if has parent (adds link to parent at start of timeline)
    if (dividedFrom) {
        const dateKey = timestampToDateString(dividedFrom.timestamp);
        if (!timelineDays[dateKey]) {
            timelineDays[dateKey] = {events: [], notes: [], photos: []};
        }
        timelineDays[dateKey].dividedFrom = dividedFrom;
    }

    // Add dividedInto if has children (adds link(s) to child plants on days
    // they were divided)
    Object.entries(divisionEvents).forEach(([timestamp, plants]) => {
        const dateKey = timestampToDateString(timestamp);
        if (!timelineDays[dateKey]) {
            timelineDays[dateKey] = {events: [], notes: [], photos: []};
        }
        if (!timelineDays[dateKey].dividedInto) {
            timelineDays[dateKey].dividedInto = plants;
        } else {
            timelineDays[dateKey].dividedInto.push(...plants);
        }
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
            settings: settingsSlice.reducer,
            interface: interfaceSlice.reducer
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
        const dividedFrom = parseDomContext("divided_from");
        const divisionEvents = parseDomContext("division_events");
        const photos = parseDomContext('photos');
        const notes = parseDomContext('notes');
        const defaultPhoto = parseDomContext('default_photo');
        const hasPhotos = photos.length > 0;
        const hasEvents = eventsByType.water.length > 0 ||
                          eventsByType.fertilize.length > 0 ||
                          eventsByType.prune.length > 0 ||
                          eventsByType.repot.length > 0;

        // Build state objects
        const timelineDays = buildTimelineDays(
            eventsByType,
            notes,
            photos,
            dividedFrom,
            divisionEvents
        );
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
                dividedFrom,
                divisionEvents,
                calendarDays,
                timelineDays,
                photos,
                navigationOptions,
                defaultPhoto,
                hasPhotos,
                hasEvents
            },
            settings: loadUserSettings(layout),
            interface: {
                settingsMenuOpen: false,
                photoGalleryOpen: false,
                photoGalleryIndex: 0,
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
