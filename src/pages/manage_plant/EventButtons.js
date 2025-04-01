import React, { useRef,  memo } from 'react';
import { localToUTC } from 'src/timestampUtils';
import { sendPostRequest } from 'src/util';
import DatetimeInput from 'src/components/DatetimeInput';
import { showToast } from 'src/components/Toast';
import LastEventTime from 'src/components/LastEventTime';
import { openErrorModal } from 'src/components/ErrorModal';
import { useSelector, useDispatch } from 'react-redux';
import { eventAdded } from './plantSlice';

const EventButtons = memo(function EventButtons() {
    // Get state from redux store
    const plantID = useSelector((state) => state.plant.plantDetails.uuid);
    const lastWatered = useSelector((state) => state.plant.events.water[0]);
    const lastFertilized = useSelector((state) => state.plant.events.fertilize[0]);

    // Create ref to access new event datetime input
    const eventTimeInput = useRef(null);

    // Used to update redux store
    const dispatch = useDispatch();

    const addEvent = async (eventType, timestamp) => {
        const payload = {
            plant_id: plantID,
            event_type: eventType,
            timestamp: localToUTC(timestamp)
        };
        const response = await sendPostRequest('/add_plant_event', payload);
        if (response.ok) {
            // Add new event to redux store (updates calendar, timeline, etc)
            dispatch(eventAdded({
                timestamp: payload.timestamp,
                type: eventType
            }));
        } else {
            // Duplicate event timestamp: show error toast for 5 seconds
            if (response.status === 409) {
                showToast(
                    `Error: ${eventType} event with same timestamp already exists`,
                    'red',
                    5000
                );
            // Other error (unexpected): show in error modal
            } else {
                const error = await response.json();
                openErrorModal(JSON.stringify(error));
            }
        }
    };

    return (
        <div className="flex flex-col text-center">
            <span className="text-lg">
                <LastEventTime
                    text="watered"
                    timestamp={lastWatered}
                />
            </span>
            <span className="text-lg">
                <LastEventTime
                    text="fertilized"
                    timestamp={lastFertilized}
                />
            </span>
            <DatetimeInput inputRef={eventTimeInput} />
            <div className="flex mx-auto">
                <button
                    className="btn btn-info m-2"
                    onClick={() => addEvent('water', eventTimeInput.current.value)}
                >
                    Water
                </button>
                <button
                    className="btn btn-success m-2"
                    onClick={() => addEvent('fertilize', eventTimeInput.current.value)}
                >
                    Fertilize
                </button>
                <button
                    className="btn btn-prune m-2"
                    onClick={() => addEvent('prune', eventTimeInput.current.value)}
                >
                    Prune
                </button>
            </div>
        </div>
    );
});

export default EventButtons;
