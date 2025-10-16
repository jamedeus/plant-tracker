import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { timestampToDateString } from 'src/utils/timestampUtils';
import { plantSlice } from './plantSlice';
import { timelineSlice } from './timelineSlice';
import { settingsSlice } from './settingsSlice';
import { interfaceSlice } from './interfaceSlice';
import { loadUserSettings } from './Settings';
import { useIsBreakpointActive } from 'src/hooks/useBreakpoint';
import initialStatePropTypes from './initialStatePropTypes';

// Correct order for event markers within a single timeline day (readability)
const EVENTS_ORDER = ['water', 'fertilize', 'prune', 'repot'];

// Takes object where each key contains an array
// Returns array of key names that contain non-empty arrays
export const nonEmptyKeys = (data) => Object.entries(data)
    .filter(([, value]) => value.length > 0)
    .map(([key]) => key)
    .sort((a, b) => EVENTS_ORDER.indexOf(a) - EVENTS_ORDER.indexOf(b));

// Factory returns template for each dateKey in timelineDays state
const getTimelineDaysTemplate = () => ({
    events: {
        water: [],
        fertilize: [],
        prune: [],
        repot: []
    },
    notes: [],
    photos: []
});

// Takes timelineSlice state and new YYYY-MM-DD dateKey
// Adds month and year to state.navigationOptions if not already present
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

// Takes timelineSlice state and timestamp, returns YYYY-MM-DD dateKey
// Populates timelineDays state and navigationOptions if dateKey is new
export function getDateKey(state, timestamp) {
    const dateKey = timestampToDateString(timestamp);
    if (!state.timelineDays[dateKey]) {
        // Add empty timelineDays template if dateKey missing
        state.timelineDays[dateKey] = getTimelineDaysTemplate();
        // Add navigationOption if first dateKey in year + month
        addNavigationOption(state, dateKey);
    }
    return dateKey;
}

// Takes timelineSlice state with timelineDays populated with events.
// Populates calendarDays key with YYYY-MM-DD dateKeys containing an array of
// event types for each day (used to render EventCalendar component).
const buildCalendarDays = (state) => {
    Object.keys(state.timelineDays).forEach(dateKey => {
        const eventTypes = nonEmptyKeys(state.timelineDays[dateKey].events);
        state.calendarDays[dateKey] = eventTypes;
    });
};

// Takes timelineSlice state with eventsByType, photos, divisionEvents, and
// dividedFrom keys pre-populated (from initialState) and notes initialState.
//
// Populates timelineDays state with YYYY-MM-DD dateKeys containing objects with
// events, notes, and photos keys (used to render Timeline component). Only adds
// dividedFrom and dividedInto keys to date when plant was divided (no empty
// keys on every day - can only have 1 dividedFrom, dividedInto is rare).
//
// Populates calendarDays state with YYYY-MM-DD dateKeys containing an array of
// event types for each day (used to render EventCalendar component).
//
// Populates navigationOptions state with YYYY keys containing arrays of MM
// month strings (used to render QuickNavigation component).
const buildTimelineState = (state, notes) => {
    // Takes ISO timestamp, dayTemplate key, and value (string or array)
    // Appends value to array under requested key (concatenates if array value)
    const addValue = (timestamp, key, value) => {
        const dateKey = getDateKey(state, timestamp);
        state.timelineDays[dateKey][key] =  [
            ...state.timelineDays[dateKey][key] || [],
            ...Array.isArray(value) ? value : [value]
        ];
    };

    // Iterates timestamps for each event type (water, fertilize, prune, repot)
    // Add timestamp to correct event type array under correct dateKey
    Object.entries(state.eventsByType).forEach(([eventType, eventDates]) =>
        eventDates.forEach(date => {
            const dateKey = getDateKey(state, date);
            state.timelineDays[dateKey].events[eventType].push(date);
        })
    );

    // Populate calendarDays state used by EventCalendar component
    buildCalendarDays(state);

    // Add objects from photos context to photos key under correct dateKey
    state.photos.forEach((photo) =>
        addValue(photo.timestamp, 'photos', photo)
    );

    // Convert notes object to array of objects in notes key under correct dateKey
    Object.entries(notes).forEach(([timestamp, text]) =>
        addValue(timestamp, 'notes', { timestamp: timestamp, text: text })
    );

    // Add dividedInto if has children (adds link(s) to child plants on days
    // they were divided)
    Object.entries(state.divisionEvents).forEach(([timestamp, plants]) =>
        addValue(timestamp, 'dividedInto', plants)
    );

    // Add dividedFrom if has parent (adds link to parent at start of timeline)
    if (state.dividedFrom) {
        const dateKey = getDateKey(state, state.dividedFrom.timestamp);
        state.timelineDays[dateKey].dividedFrom = state.dividedFrom;
    }
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
        const timelineSliceState = {
            eventsByType: initialState.events,
            dividedFrom: initialState.divided_from,
            divisionEvents: initialState.division_events,
            calendarDays: {},
            timelineDays: {},
            photos: sortPhotosChronologically(
                Object.values(initialState.photos)
            ),
            navigationOptions: {},
            defaultPhoto: initialState.default_photo,
            hasPhotos: Object.values(initialState.photos).length > 0,
            hasEvents: initialState.events.water.length > 0 ||
                       initialState.events.fertilize.length > 0 ||
                       initialState.events.prune.length > 0 ||
                       initialState.events.repot.length > 0
        };

        // Build timelineDays, calendarDays, and navigationOptions objects
        buildTimelineState(timelineSliceState, initialState.notes);

        // Return object with keys expected by plantSlice and timelineSlice
        return {
            plant: {
                plantDetails: initialState.plant_details
            },
            timeline: timelineSliceState,
            settings: loadUserSettings(layout),
            interface: {
                titleDrawerOpen: false,
                changeQrScannerOpen: false,
                divisionScannerOpen: false,
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
    initialState: initialStatePropTypes.isRequired
};
