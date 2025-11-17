import { createSlice } from '@reduxjs/toolkit';

// Redux slice to store all state related to the plant's current status, except
// events, notes, and photos (stored in timelineSlice)
export const plantSlice = createSlice({
    name: 'plant',
    initialState: {
        plantDetails: {}
    },
    reducers: {
        // Takes object with all plantDetails keys that changed, overwrites
        // matching keys in plantDetails without modifying other keys
        plantDetailsUpdated(state, action) {
            state.plantDetails = {
                ...state.plantDetails,
                ...action.payload
            };
        },

        // Takes object with name and uuid keys
        plantAddedToGroup(state, action) {
            state.plantDetails.group = action.payload;
        },

        plantRemovedFromGroup(state) {
            state.plantDetails.group = null;
        }
    }
});

// Export individual action creators from slice
export const {
    plantDetailsUpdated,
    plantAddedToGroup,
    plantRemovedFromGroup
} = plantSlice.actions;
