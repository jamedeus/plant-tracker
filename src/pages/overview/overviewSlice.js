import { createSlice } from '@reduxjs/toolkit';
import { getMostRecent } from 'src/timestampUtils';
import router from 'src/routes';

// Map eventType taken by bulk_add_plant_events to the plantDetails state
// key that should be updated when an event is successfully created
const eventTypeMap = {
    water: "last_watered",
    fertilize: "last_fertilized"
};

// Redux slice to store all state displayed on the overview page
export const overviewSlice = createSlice({
    name: 'overview',
    initialState: {
        plants: {},
        groups: {},
        // True if archived overview, false if main overview
        archivedOverview: false,
        // Controls visibility of archived overview link in top left dropdown
        showArchive: false,
        title: "Plant Overview"
    },
    reducers: {
        // Takes array of UUIDs of deleted or archived plants
        plantsRemoved(state, action) {
            action.payload.forEach(uuid => delete state.plants[uuid]);

            // Archived overview: redirect to overview if no plants or groups left
            if (
                state.archivedOverview &&
                !Object.keys(state.plants).length &&
                !Object.keys(state.groups).length
            ) {
                router.navigate('/');
            }
        },
        // Takes array of UUIDs of deleted or archived groups
        groupsRemoved(state, action) {
            action.payload.forEach(uuid => delete state.groups[uuid]);

            // Archived overview: redirect to overview if no plants or groups left
            if (
                state.archivedOverview &&
                !Object.keys(state.plants).length &&
                !Object.keys(state.groups).length
            ) {
                router.navigate('/');
            }
        },
        // Takes object with eventType, plantIds, and timestamp keys
        updatePlantLastEventTimes(state, action) {
            const { eventType, plantIds, timestamp } = action.payload;
            if (eventType in eventTypeMap) {
                const lastEvent = eventTypeMap[eventType];
                plantIds.forEach(uuid => {
                    state.plants[uuid][lastEvent] = getMostRecent(
                        state.plants[uuid][lastEvent],
                        timestamp
                    );
                });
            }
        },
        // Takes new showArchive bool
        showArchiveChanged(state, action) {
            state.showArchive = action.payload;
        },
        // Takes new title string
        titleChanged(state, action) {
            state.title = action.payload;
        }
    }
});

// Export individual action creators from slice
export const {
    plantsRemoved,
    groupsRemoved,
    updatePlantLastEventTimes,
    showArchiveChanged,
} = overviewSlice.actions;
