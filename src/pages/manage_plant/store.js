import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { timestampToDateString } from 'src/timestampUtils';
import { plantSlice } from './plantSlice';
import { timelineSlice } from './timelineSlice';
import { settingsSlice } from './settingsSlice';
import { interfaceSlice } from './interfaceSlice';
import { loadUserSettings } from './Settings';
import { useIsBreakpointActive } from 'src/hooks/useBreakpoint';

// Takes events, notes, photos, dividedFrom, and divisionEvents context objects
// from django backend, returns timelineDays state used by Timeline component
// (YYYY-MM-DD keys containing objects with events, notes, and photos keys).
//
// Only adds dividedFrom and dividedInto keys to date when plant was divided (no
// empty keys on every day - can only have 1 dividedFrom, dividedInto is rare).
export const buildTimelineDays = (events, notes, photos, dividedFrom, divisionEvents) => {
    // Create object, will have YYYY-MM-DD keys containing template below
    const timelineDays = {};
    const dayTemplate = {events: [], notes: [], photos: []};

    // Takes ISO timestamp, converts to YYYY-MM-DD dateKey, returns
    // If dateKey does not exist in timelineDays adds dayTemplate
    const getDateKey = (timestamp) => {
        const dateKey = timestampToDateString(timestamp);
        if (!timelineDays[dateKey]) {
            timelineDays[dateKey] = { ...dayTemplate };
        }
        return dateKey;
    };

    // Takes ISO timestamp, dayTemplate key, and value (string or array)
    // Appends value to array under requested key (concatenates if array value)
    const addValue = (timestamp, key, value) => {
        const dateKey = getDateKey(timestamp);
        timelineDays[dateKey][key] =  [
            ...timelineDays[dateKey][key] || [],
            ...Array.isArray(value) ? value : [value]
        ];
    };

    // Iterates timestamps under each event type (water, fertilize, prune, repot)
    // Add event object (type + timestamp) to events array under correct dateKey
    Object.entries(events).forEach(([eventType, eventDates]) =>
        eventDates.forEach(date =>
            addValue(date, 'events', {type: eventType, timestamp: date}))
    );
    // Remove duplicate event types on same day
    Object.keys(timelineDays).forEach(dateKey =>
        timelineDays[dateKey].events = [...new Set(timelineDays[dateKey].events)]
    );

    // Add objects from photos context to photos key under correct dateKey
    photos.forEach((photo) =>
        addValue(photo.timestamp, 'photos', photo)
    );

    // Convert notes object to array of objects in notes key under correct dateKey
    Object.entries(notes).forEach(([timestamp, text]) =>
        addValue(timestamp, 'notes', { timestamp: timestamp, text: text })
    );

    // Add dividedInto if has children (adds link(s) to child plants on days
    // they were divided)
    Object.entries(divisionEvents).forEach(([timestamp, plants]) =>
        addValue(timestamp, 'dividedInto', plants)
    );

    // Add dividedFrom if has parent (adds link to parent at start of timeline)
    if (dividedFrom) {
        timelineDays[getDateKey(dividedFrom.timestamp)].dividedFrom = dividedFrom;
    }

    return timelineDays;
};

// Takes timelineDays state, flattens and returns calendarDays state used by
// EventCalendar component (YYYY-MM-DD keys containing array of event strings).
export const buildCalendarDays = (timelineDays) => {
    const calendarDays = {};
    Object.keys(timelineDays).forEach(dateKey => {
        if (timelineDays[dateKey].events.length) {
            // Convert array of objects to array of type strings (no duplicates)
            calendarDays[dateKey] = [...new Set(
                timelineDays[dateKey].events.map(event => event.type)
            )];
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

// Takes array of photo objects (contains timestamp key), sorts chronologically
export const sortPhotosChronologically = (photos) => {
    return photos.sort((a, b) =>
        a.timestamp.localeCompare(b.timestamp)
    ).reverse();
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

export function ReduxProvider({ children, initialState }) {
    // Get layout string used to look up default settings for current breakpoint
    const layout = useIsBreakpointActive("md") ? 'desktop' : 'mobile';

    // Parses SPA-provided context elements containing events, photos, and notes
    // Merges and returns values for all initialState keys in timelineSlice
    const init = () => {
        const plantDetails = initialState.plant_details;
        const eventsByType = initialState.events;
        const dividedFrom = initialState.divided_from;
        const divisionEvents = initialState.division_events;
        const photos = sortPhotosChronologically(
            Object.values(initialState.photos || {})
        );
        const notes = initialState.notes;
        const defaultPhoto = initialState.default_photo;
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
                plantDetails
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
                deleteMode: false,
                selectedEvents: {
                    water: [],
                    fertilize: [],
                    prune: [],
                    repot: []
                },
                selectedPhotos: [],
                selectedNotes: []
            }
        };
    };

    // Create redux store
    const store = useMemo(() => createReduxStore(
        init()
    ), [initialState, layout]);

    return (
        <Provider store={store}>
            {children}
        </Provider>
    );
}

ReduxProvider.propTypes = {
    children: PropTypes.node,
    initialState: PropTypes.shape({
        plant_details: PropTypes.object.isRequired,
        events: PropTypes.object.isRequired,
        divided_from: PropTypes.oneOfType([PropTypes.object, PropTypes.oneOf([null])]),
        division_events: PropTypes.object.isRequired,
        photos: PropTypes.oneOfType([PropTypes.array, PropTypes.object]).isRequired,
        notes: PropTypes.object.isRequired,
        default_photo: PropTypes.object.isRequired,
    }).isRequired
};
