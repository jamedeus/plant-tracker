import React, { memo } from 'react';
import FloatingFooter from 'src/components/FloatingFooter';
import { sendPostRequest } from 'src/util';
import { openErrorModal } from 'src/components/ErrorModal';
import { useSelector, useDispatch } from 'react-redux';
import { deleteModeChanged } from './interfaceSlice';
import { eventDeleted, photosDeleted } from './timelineSlice';

const DeleteModeFooter = memo(function DeleteModeFooter() {
    const dispatch = useDispatch();
    const plantID = useSelector((state) => state.plant.plantDetails.uuid);
    const deleteMode = useSelector((state) => state.interface.deleteMode);
    const selectedEvents = useSelector((state) => state.interface.selectedEvents);
    const selectedPhotos = useSelector((state) => state.interface.selectedPhotos);

    const cancelDeleteMode = () => {
        dispatch(deleteModeChanged({editing: false}));
    };

    const handleDelete = async () => {
        // Delete events if 1 or more selected
        if (Object.values(selectedEvents).some(arr => arr.length > 0)) {
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
            } else {
                const error = await response.json();
                openErrorModal(JSON.stringify(error));
            }
        }

        // Delete photos if 1 or more selected
        if (selectedPhotos.length) {
            const response = await sendPostRequest('/delete_plant_photos', {
                plant_id: plantID,
                delete_photos: selectedPhotos
            });

            // If successful remove photos from timeline
            if (response.ok) {
                const data = await response.json();
                dispatch(photosDeleted(data.deleted));
            } else {
                const error = await response.json();
                openErrorModal(JSON.stringify(error));
            }
        }

        // Hide footer
        cancelDeleteMode();
    };

    return (
        <FloatingFooter visible={deleteMode}>
            <button
                className="btn btn-neutral"
                onClick={cancelDeleteMode}
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

export default DeleteModeFooter;
