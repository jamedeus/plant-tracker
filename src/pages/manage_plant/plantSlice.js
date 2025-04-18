import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

// Returns new state objects fetched from /get_plant_state endpoint
// Called when user navigates to page by pressing back button (update contents)
export const backButtonPressed = createAsyncThunk(
    'plant/backButtonPressed',
    async (_, thunkAPI) => {
        const plantId = thunkAPI.getState().plant.plantDetails.uuid;
        const response = await fetch(`/get_plant_state/${plantId}`);
        if (!response.ok) {
            throw new Error('Failed to get new plant state');
        }
        const data = await response.json();
        return data;
    }
);

// Redux slice to store all state related to the plant's current status, except
// events, notes, and photos (stored in timelineSlice)
export const plantSlice = createSlice({
    name: 'plant',
    initialState: {
        plantDetails: {},
        groupOptions: []
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

        // Takes URL of new default photo thumbnail
        plantDefaultPhotoChanged(state, action) {
            state.plantDetails = {
                ...state.plantDetails,
                thumbnail: action.payload
            };
        },

        // Takes new pot size
        // Does NOT create event (dispatch timelineSlice.eventAdded separately)
        plantRepotted(state, action) {
            state.plantDetails.pot_size = action.payload;
        },

        // Takes object with name and uuid keys
        plantAddedToGroup(state, action) {
            state.plantDetails.group = action.payload;
        },

        plantRemovedFromGroup(state) {
            state.plantDetails.group = null;
        }
    },
    extraReducers: builder => {
        // Replace both states when user navigates to the page with back button
        // (fetches new state from backend to replace outdated contents)
        builder.addCase(backButtonPressed.fulfilled, (state, action) => {
            state.plantDetails = action.payload.plant_details;
            state.groupOptions = action.payload.group_options;
        });
        // Reload page if unable to fetch new state when back button pressed
        builder.addCase(backButtonPressed.rejected, () => {
            window.location.reload();
        });
    }
});

// Export individual action creators from slice
export const {
    plantDetailsUpdated,
    plantDefaultPhotoChanged,
    plantRepotted,
    plantAddedToGroup,
    plantRemovedFromGroup
} = plantSlice.actions;
