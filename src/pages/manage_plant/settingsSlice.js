import { createSlice } from '@reduxjs/toolkit';

// Redux slice to store all user configurable settings
export const settingsSlice = createSlice({
    name: 'settings',
    initialState: {
        // Either 1, 2, 3, 4, or 'All
        collapsedNoteLines: 1
    },
    reducers: {
        // Takes {setting: name, value: value}
        settingChanged(state, action) {
            state[action.payload.setting] = action.payload.value;
            localStorage.setItem("manage_plant_settings", JSON.stringify({
                ...state,
                [action.payload.setting]: action.payload.value
            }));
        },
    }
});

export const {
    collapsedNoteLines,
    settingChanged,
} = settingsSlice.actions;
