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
        }
    }
});

export const {
    settingsMenuOpened,
    photoGalleryOpened,
    photoGalleryIndexChanged
} = interfaceSlice.actions;
