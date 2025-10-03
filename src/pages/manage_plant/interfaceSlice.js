import { createSlice } from '@reduxjs/toolkit';

// Redux slice to store user interface state
export const interfaceSlice = createSlice({
    name: 'interface',
    initialState: {
        // Navbar title drawer open state
        titleDrawerOpen: false,
        // Fullscreen scanner used to change QR code open state
        changeQrScannerOpen: false,
        // Settings side menu open state
        settingsMenuOpen: false,
        // Fullscreen lightbox gallery open state
        photoGalleryOpen: false,
        // Currently visible photo in lightbox gallery (index of photos state)
        photoGalleryIndex: 0,
        // Can select events/photos/notes to delete by clicking in timeline if true
        deleteMode: false,
        // Tracks events selected by clicking in timeline
        // Uses same format as /bulk_delete_plant_events payload
        selectedEvents: {
            water: [],
            fertilize: [],
            prune: [],
            repot: []
        },
        // Tracks photos selected by clicking in timeline (array of photo keys)
        selectedPhotos: [],
        // Tracks notes selected by clicking in timeline (array of note timestamps)
        selectedNotes: []
    },
    reducers: {
        // Takes true or false
        titleDrawerOpened(state, action) {
            state.titleDrawerOpen = action.payload;
        },

        // Takes true or false
        changeQrScannerOpened(state, action) {
            state.changeQrScannerOpen = action.payload;
            state.titleDrawerOpen = false;
        },

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
        deleteModeChanged(state, action) {
            state.deleteMode = action.payload.editing;
            // Clear selections if no longer deleting
            if (!action.payload.editing) {
                state.selectedEvents = {
                    water: [],
                    fertilize: [],
                    prune: [],
                    repot: []
                };
                state.selectedPhotos = [];
                state.selectedNotes = [];
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

        // Takes { timestamp: <string>, selected: <bool> }
        noteSelected(state, action) {
            if (action.payload.selected) {
                state.selectedNotes.push(action.payload.timestamp);
            } else {
                state.selectedNotes = state.selectedNotes.filter(
                    timestamp => timestamp !== action.payload.timestamp
                );
            }
        },
    }
});

export const {
    titleDrawerOpened,
    changeQrScannerOpened,
    settingsMenuOpened,
    photoGalleryOpened,
    photoGalleryIndexChanged,
    deleteModeChanged,
    eventSelected,
    photoSelected,
    noteSelected,
} = interfaceSlice.actions;
