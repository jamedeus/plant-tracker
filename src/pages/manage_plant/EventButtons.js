import React, { useState, useRef,  memo } from 'react';
import { localToUTC } from 'src/utils/timestampUtils';
import sendPostRequest from 'src/utils/sendPostRequest';
import DatetimeInput from 'src/components/DatetimeInput';
import { showToast } from 'src/components/Toast';
import LastEventTime from 'src/components/LastEventTime';
import { openErrorModal } from 'src/components/ErrorModal';
import { useSelector, useDispatch } from 'react-redux';
import { eventAdded } from './timelineSlice';
import { ChevronDownIcon } from '@heroicons/react/16/solid';
import clsx from 'clsx';

const EventButtons = memo(function EventButtons() {
    // Get state from redux store
    const plantID = useSelector((state) => state.plant.plantDetails.uuid);
    const lastWatered = useSelector((state) => state.timeline.eventsByType.water[0]);
    const lastFertilized = useSelector((state) => state.timeline.eventsByType.fertilize[0]);
    const lastPruned = useSelector((state) => state.timeline.eventsByType.prune[0]);
    const lastRepotted = useSelector((state) => state.timeline.eventsByType.repot[0]);

    // Create ref to access new event datetime input
    const eventTimeInput = useRef(null);

    // Expands/collapses last event times
    // Only shows water when collapsed, shows everything when expanded
    const [showAllEventTimes, setShowAllEventTimes] = useState(false);

    const toggleShowAllEventTimes = () => {
        setShowAllEventTimes(!showAllEventTimes);
    };

    // Used to update redux store
    const dispatch = useDispatch();

    const addEvent = async (eventType, timestamp) => {
        const response = await sendPostRequest('/add_plant_event', {
            plant_id: plantID,
            event_type: eventType,
            timestamp: localToUTC(timestamp)
        });
        if (response.ok) {
            const data = await response.json();
            // Add new event to redux store (updates calendar, timeline, etc)
            dispatch(eventAdded({
                timestamp: data.timestamp,
                type: data.action
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
            {/* Last event times (water always visible, rest in collapse) */}
            <div
                className={clsx(
                    "flex flex-col overflow-hidden",
                    "transition-[height] duration-300",
                    showAllEventTimes ? "h-28" : "h-8"
                )}
                onClick={toggleShowAllEventTimes}
                role="button"
                tabIndex={0}
                aria-label={showAllEventTimes ?
                    "Hide all last event times except water" :
                    "Show last event time for all event types"
                }
                data-testid="last-event-times"
            >
                <span className="text-lg relative w-fit mx-auto">
                    <LastEventTime
                        text="watered"
                        timestamp={lastWatered}
                    />
                    {/* Arrow shows open/close state (whole div clickable) */}
                    <ChevronDownIcon className={clsx(
                        "absolute -right-7 top-1",
                        "min-size-5 size-5 transition-transform duration-200",
                        showAllEventTimes ? "rotate-180" : "rotate-0"
                    )} />
                </span>
                <span className="text-lg">
                    <LastEventTime
                        text="fertilized"
                        timestamp={lastFertilized}
                    />
                </span>
                <span className="text-lg">
                    <LastEventTime
                        text="pruned"
                        timestamp={lastPruned}
                    />
                </span>
                <span className="text-lg">
                    <LastEventTime
                        text="repotted"
                        timestamp={lastRepotted}
                    />
                </span>
            </div>
            {/* New event time input */}
            <div className="mx-auto mt-2">
                <DatetimeInput
                    inputRef={eventTimeInput}
                    ariaLabel="New event timestamp"
                />
            </div>
            {/* Add event buttons */}
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
