import { createSlice } from '@reduxjs/toolkit';

// Centralized redux slice to store timelineDays and photoUrls "states" and all
// callback functions that modify them
export const eventsSlice = createSlice({
    name: 'events',
    initialState: {
        events: {
            water: [],
            fertilize: [],
            prune: [],
            repot: []
        }
    },
    reducers: {
        // Takes object with timestamp and type keys, adds to events and
        // timelineDays states
        eventAdded(state, action) {
            const newEvent = action.payload;
            state.events[newEvent.type].push(newEvent.timestamp);
            state.events[newEvent.type].sort().reverse();
        },

        // Takes object with timestamp and type keys, removes from events and
        // timelineDays states
        eventDeleted(state, action) {
            const deletedEvent = action.payload;
            state.events[deletedEvent.type].splice(
                state.events[deletedEvent.type].indexOf(deletedEvent.timestamp),
                1
            );
        },

        // Takes response from /get_plant_state endpoint, rebuilds all state
        // objects with new contents. Called when page navigated to using back
        // button (update potentially outdated contents).
        backButtonPressed(state, action) {
            state.events = action.payload.events;
        }
    }
});

// Export individual action creators from slice
export const {
    eventAdded,
    eventDeleted,
    backButtonPressed
} = eventsSlice.actions;
