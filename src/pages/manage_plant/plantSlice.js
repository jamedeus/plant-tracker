import { createSlice } from '@reduxjs/toolkit';

// Redux slice to store all state related to the plant's current status, except
// events, notes, and photos (stored in timelineSlice)
export const plantSlice = createSlice({
    name: 'plant',
    initialState: {
        plantDetails: {
            // Null or string (50 characters max), configured name
            name: '',
            // Name shown in title (always set, auto generated if name is null)
            display_name: '',
            // UUID v4 string
            uuid: '',
            // True if archived, false if not
            archived: false,
            // ISO 8601 timestamp string (UTC)
            created: '',
            // Null or string (50 characters max)
            species: '',
            // Null or string (500 characters max)
            description: '',
            // Null or integer (pot size in inches)
            pot_size: null,
            // Null or ISO 8601 timestamp string (UTC)
            last_watered: '',
            // Null or ISO 8601 timestamp string (UTC)
            last_fertilized: '',
            // URL of default photo thumbnail (or most-recent photo if not set)
            thumbnail: null,
            // Null or object with name and uuid keys
            group: null,
        }
    },
    reducers: {
        // Takes object with all plantDetails keys that changed, overwrites
        // matching keys in plantDetails without modifying other keys
        plantDetailsUpdated(state, action) {
            state.plantDetails = {
                ...state.plantDetails,
                ...action.payload
            };
        }
    }
});

// Export individual action creators from slice
export const {
    plantDetailsUpdated
} = plantSlice.actions;
