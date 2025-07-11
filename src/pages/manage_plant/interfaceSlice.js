import { createSlice } from '@reduxjs/toolkit';

// Redux slice to store user interface state
export const interfaceSlice = createSlice({
    name: 'interface',
    initialState: {
        // Settings side menu open state
        settingsMenuOpen: false,
        // Fullscreen lightbox gallery open state
        photoGalleryOpen: false,
        // Currently visible photo in lightbox gallery (index of photos state)
        photoGalleryIndex: 0,
        // Allows selecting events to delete by clicking in timeline if true
        deletingEvents: false,
        // Tracks events selected by clicking in timeline
        // Uses same format as /bulk_delete_plant_events payload
        selectedEvents: {
            water: [],
            fertilize: [],
            prune: [],
            repot: []
        },
        // Allows selecting photos to delete by clicking in timeline if true
        deletingPhotos: false,
        // Tracks photos selected by clicking in timeline (array of photo keys)
        selectedPhotos: []
    },
    reducers: {
        // Takes true or false
        settingsMenuOpened(state, action) {
            state.settingsMenuOpen = action.payload;
            // Close dropdown (visible through transparent settings menu)
            document.activeElement.blur();
        },

        // Takes { open: <bool> }
        photoGalleryOpened(state, action) {
            state.photoGalleryOpen = action.payload.open;
        },

        // Takes { index: <int> }
        photoGalleryIndexChanged(state, action) {
            state.photoGalleryIndex = action.payload.index;
        },

        // Takes { editing: <bool> }
        deletingEventsChanged(state, action) {
            state.deletingEvents = action.payload.editing;
            // Clear selection if no longer deleting
            if (!action.payload.editing) {
                state.selectedEvents = {
                    water: [],
                    fertilize: [],
                    prune: [],
                    repot: []
                };
            }
        },

        // Takes { type: <eventType, timestamps: <array>, selected: <bool> }
        // Timestamps must be ISO format (UTC, not user timezone)
        eventSelected(state, action) {
            // Add timestamps to selectedEvents if selected bool is true
            if (action.payload.selected){
                state.selectedEvents[action.payload.type] = [
                    ...state.selectedEvents[action.payload.type],
                    ...action.payload.timestamps
                ];
            // Remove timestamps from selectedEvents if selected bool is false
            } else {
                state.selectedEvents[action.payload.type] =
                    state.selectedEvents[action.payload.type].filter(
                        timestamp => !action.payload.timestamps.includes(timestamp)
                    );
            }
        },

        // Takes { editing: <bool> }
        deletingPhotosChanged(state, action) {
            state.deletingPhotos = action.payload.editing;
            // Clear selection if no longer deleting
            if (!action.payload.editing) {
                state.selectedPhotos = [];
            }
        },

        // Takes { key: <int>, selected: <bool> }
        photoSelected(state, action) {
            if (action.payload.selected) {
                state.selectedPhotos.push(action.payload.key);
            } else {
                state.selectedPhotos = state.selectedPhotos.filter(
                    key => key !== action.payload.key
                );
            }
        },
    }
});

export const {
    settingsMenuOpened,
    photoGalleryOpened,
    photoGalleryIndexChanged,
    deletingEventsChanged,
    eventSelected,
    deletingPhotosChanged,
    photoSelected,
} = interfaceSlice.actions;
