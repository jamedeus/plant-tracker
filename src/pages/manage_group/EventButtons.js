import React, { useRef,  memo } from 'react';
import { pastTense } from 'src/utils/stringUtils';
import { localToUTC } from 'src/utils/timestampUtils';
import sendPostRequest from 'src/utils/sendPostRequest';
import DatetimeInput from 'src/components/DatetimeInput';
import { showToast } from 'src/components/Toast';
import { filterSelectedItems } from 'src/components/EditableNodeList';
import { useSelector, useDispatch } from 'react-redux';
import { updatePlantLastEventTimes } from './groupSlice';

const EventButtons = memo(function EventButtons() {
    // Get state from redux store
    const plantDetails = useSelector((state) => state.group.plantDetails);

    // Used to update redux store
    const dispatch = useDispatch();

    // Ref to access timestamp input used by water/fertilize buttons
    const addEventTimeInput = useRef(null);

    // Handler for water and fertilize buttons
    const addEvents = async (eventType) => {
        // Get all plants in group that are not archived
        const payload = {
            plants: filterSelectedItems(
                Object.keys(plantDetails),
                plantDetails,
                { archived: false }
            ),
            event_type: eventType,
            timestamp: localToUTC(addEventTimeInput.current.value)
        };
        const onSuccess = (data) => {
            // Show toast with success message
            showToast(`All plants ${pastTense(eventType)}!`, 'blue', 5000);
            // Update last watered/fertilized times for all plants in response
            dispatch(updatePlantLastEventTimes({
                eventType: data.action,
                plantIds: data.plants,
                timestamp: data.timestamp
            }));
        };
        await sendPostRequest('/bulk_add_plant_events', payload, onSuccess);
    };

    return (
        <>
            <DatetimeInput inputRef={addEventTimeInput} />
            <div className="flex mb-8">
                <button
                    className="btn btn-info m-2"
                    onClick={() => addEvents('water')}
                >
                    Water
                </button>
                <button
                    className="btn btn-success m-2"
                    onClick={() => addEvents('fertilize')}
                >
                    Fertilize
                </button>
            </div>
        </>
    );
});

export default EventButtons;
