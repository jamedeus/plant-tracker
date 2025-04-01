import { createSlice } from '@reduxjs/toolkit';

// Centralized redux slice to store timelineDays and photoUrls "states" and all
// callback functions that modify them
export const plantSlice = createSlice({
    name: 'events',
    initialState: {
        plantDetails: {},
        groupOptions: [],
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

        // Takes new plantDetails object
        plantDetailsUpdated(state, action) {
            state.plantDetails = action.payload;
        },

        // Takes new pot size
        // Does NOT create event (call eventAdded separately)
        plantRepotted(state, action) {
            state.plantDetails.pot_size = action.payload;
        },

        // Takes object with name and uuid keys
        plantAddedToGroup(state, action) {
            state.plantDetails.group = action.payload;
        },

        plantRemovedFromGroup(state, action) {
            state.plantDetails.group = null;
        },

        // Takes response from /get_plant_state endpoint, rebuilds all state
        // objects with new contents. Called when page navigated to using back
        // button (update potentially outdated contents).
        backButtonPressed(state, action) {
            state.events = action.payload.events;
            state.plantDetails = action.payload.plant_details;
            state.groupOptions = action.payload.group_options;
        }
    }
});

// Export individual action creators from slice
export const {
    eventAdded,
    eventDeleted,
    plantDetailsUpdated,
    plantRepotted,
    plantAddedToGroup,
    plantRemovedFromGroup,
    backButtonPressed
} = plantSlice.actions;
