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

    const cancelDeleting = () => {
        dispatch(deletingEventsChanged({editing: false}));
    };

    const handleDelete = async () => {
        const response = await sendPostRequest('/bulk_delete_plant_events', {
            plant_id: plantID,
            events: selectedEvents
        });

        // If successful remove events from timeline
        if (response.ok) {
            const data = await response.json();
            Object.entries(data.deleted).forEach(([eventType, timestamps]) =>
                timestamps.forEach(timestamp =>
                    dispatch(eventDeleted({
                        timestamp: timestamp,
                        type: eventType
                    }))
                )
            );
            // Hide footer
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
