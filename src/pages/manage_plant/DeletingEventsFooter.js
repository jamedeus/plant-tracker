import React, { memo } from 'react';
import FloatingFooter from 'src/components/FloatingFooter';
import { sendPostRequest } from 'src/util';
import { openErrorModal } from 'src/components/ErrorModal';
import { useSelector, useDispatch } from 'react-redux';
import { deletingEventsChanged } from './interfaceSlice';
import { eventDeleted } from './timelineSlice';

const DeletingEventsFooter = memo(function DeletingEventsFooter() {
    const dispatch = useDispatch();
    const plantID = useSelector((state) => state.plant.plantDetails.uuid);
    const deletingEvents = useSelector((state) => state.interface.deletingEvents);
    const selectedEvents = useSelector((state) => state.interface.selectedEvents);
    console.log(selectedEvents)
    const eventsByType = useSelector((state) => state.timeline.eventsByType);
    console.log(eventsByType)

    const cancelDeleting = () => {
        dispatch(deletingEventsChanged({editing: false}));
    };

    const handleDelete = async () => {
        const payload = {
            plant_id: plantID,
            events: []
        };

        selectedEvents.forEach(event => {
            const [dateKey, type] = event.split('_');
            eventsByType[type].forEach(timestamp => {
                if (timestamp.startsWith(dateKey)) {
                    payload.events.push({type: type, timestamp: timestamp});
                }
            });
        });
        console.log(payload)

        const response = await sendPostRequest('/bulk_delete_plant_events',
            payload
        );

        // If successful remove events from timeline, hide footer
        if (response.ok) {
            payload.events.forEach(event => {
                dispatch(eventDeleted({
                    timestamp: event.timestamp,
                    type: event.type
                }));
            });
            cancelDeleting();
        } else {
            const error = await response.json();
            openErrorModal(JSON.stringify(error));
        }
    };

    return (
        <FloatingFooter visible={deletingEvents}>
            <button
                className="btn btn-neutral"
                onClick={cancelDeleting}
            >
                Cancel
            </button>

            <button
                className="btn btn-error"
                onClick={handleDelete}
            >
                Delete
            </button>
        </FloatingFooter>
    );
});

export default DeletingEventsFooter;
