import { createSlice } from '@reduxjs/toolkit';
import { getMostRecent } from 'src/util';

// Map eventType taken by bulk_add_plant_events to the plantDetails state
// key that should be updated when an event is successfully created
const eventTypeMap = {
    water: "last_watered",
    fertilize: "last_fertilized"
};

// Redux slice to store all state displayed on the manage_group page
export const groupSlice = createSlice({
    name: 'group',
    initialState: {
        // Contains details about the group itself
        group: {},
        // Contains details about each plant in the group
        plants: {},
    },
    reducers: {
        // Takes updated group details
        groupDetailsUpdateed(state, action) {
            state.group = { ...state.group, ...action.payload };
        },
        // Takes array of plant objects for each new plant added to the group
        plantsAdded(state, action) {
            action.payload.forEach(plant => state.plants[plant.uuid] = plant);
        },
        // Takes array of plant details objects of removed plants
        plantsRemoved(state, action) {
            action.payload.forEach(plant => delete state.plants[plant.uuid]);
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
    }
});

// Export individual action creators from slice
export const {
    groupDetailsUpdateed,
    plantsAdded,
    plantsRemoved,
    updatePlantLastEventTimes,
} = groupSlice.actions;
