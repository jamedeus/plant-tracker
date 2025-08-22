import React, { useRef,  memo } from 'react';
import { localToUTC } from 'src/timestampUtils';
import { sendPostRequest, pastTense } from 'src/util';
import DatetimeInput from 'src/components/DatetimeInput';
import { showToast } from 'src/components/Toast';
import { openErrorModal } from 'src/components/ErrorModal';
import { filterSelectedItems } from 'src/components/EditableNodeList';
import { useSelector, useDispatch } from 'react-redux';
import { updatePlantLastEventTimes } from './groupSlice';

const EventButtons = memo(function EventButtons() {
    // Get state from redux store
    const plantDetails = useSelector((state) => state.group.plants);

    // Used to update redux store
    const dispatch = useDispatch();

    // Ref to access timestamp input used by water/fertilize buttons
    const addEventTimeInput = useRef(null);

    // Handler for water and fertilize buttons
    const addEvents = async (eventType) => {
        // Get all plants in group that are not archived
        const selected = filterSelectedItems(
            Object.keys(plantDetails),
            plantDetails,
            { archived: false }
        );
        const timestamp = localToUTC(addEventTimeInput.current.value);
        const response = await sendPostRequest('/bulk_add_plant_events', {
            plants: selected,
            event_type: eventType,
            timestamp: timestamp
        });
        if (response.ok) {
            // Show toast with success message
            showToast(`All plants ${pastTense(eventType)}!`, 'blue', 5000);
            // Update last watered/fertilized times for all plants in response
            const data = await response.json();
            dispatch(updatePlantLastEventTimes({
                eventType: data.action,
                plantIds: data.plants,
                timestamp: data.timestamp
            }));
        } else {
            const error = await response.json();
            openErrorModal(JSON.stringify(error));
        }
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
