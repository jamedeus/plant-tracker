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
        groupDetails: {},
        // Contains details about each plant in the group
        plantDetails: {},
    },
    reducers: {
        // Takes updated group details, merges with state
        groupDetailsUpdateed(state, action) {
            state.groupDetails = { ...state.groupDetails, ...action.payload };
        },
        // Takes array of objects with details of each plant added to  group
        plantsAdded(state, action) {
            action.payload.forEach(plant => state.plantDetails[plant.uuid] = plant);
        },
        // Takes array of objects with details of each plant removed from group
        plantsRemoved(state, action) {
            action.payload.forEach(plant => delete state.plantDetails[plant.uuid]);
        },
        // Takes object with eventType, plantIds, and timestamp keys
        // Updates last_watered/last_fertilized times for each plant in plantIds
        // if the timestamp is newer than the current value
        updatePlantLastEventTimes(state, action) {
            const { eventType, plantIds, timestamp } = action.payload;
            if (eventType in eventTypeMap) {
                const lastEvent = eventTypeMap[eventType];
                plantIds.forEach(uuid => {
                    state.plantDetails[uuid][lastEvent] = getMostRecent(
                        state.plantDetails[uuid][lastEvent],
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
