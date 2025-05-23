import { createSlice } from '@reduxjs/toolkit';
import { getDefaultSettingValue } from './Settings';

// Redux slice to store all user configurable settings
export const settingsSlice = createSlice({
    name: 'settings',
    initialState: {
        settingsMenuOpen: false,
        // Either 1, 2, 3, 4, or 'All
        collapsedNoteLines: 1,
        // True = show, False = tooltip
        timelineFullDate: true,
        // Number of milliseconds to hold delete button (0 for no delay)
        holdToConfirmDelay: 1500,
        // Number of milliseconds each photo is shown in gallery slideshow
        gallerySlideshowDelay: 3000,
        // Whether date captions are rendered in photo gallery
        galleryShowPhotoDate: true,
        // Whether timeline scrolls to last-viewed photo when gallery closed
        galleryScrollToPhoto: true
    },
    reducers: {
        // Takes true or false
        settingsMenuOpened(state, action) {
            state.settingsMenuOpen = action.payload;
        },
        // Takes {setting: name, value: value}
        settingChanged(state, action) {
            state[action.payload.setting] = action.payload.value;
            localStorage.setItem("manage_plant_settings", JSON.stringify({
                ...state,
                [action.payload.setting]: action.payload.value
            }));
        },
        // Takes {layout: ['mobile'||'desktop']}
        settingsReset(state, action) {
            Object.keys(state).forEach(key => (
                state[key] = getDefaultSettingValue(key, action.payload.layout)
            ));
            // Clear localStorage (go back to breakpoint-based values)
            localStorage.removeItem('manage_plant_settings');
        }
    }
});

export const {
    settingsMenuOpened,
    settingChanged,
    settingsReset
} = settingsSlice.actions;
