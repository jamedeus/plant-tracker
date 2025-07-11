import React, { memo } from 'react';
import FloatingFooter from 'src/components/FloatingFooter';
import { sendPostRequest } from 'src/util';
import { openErrorModal } from 'src/components/ErrorModal';
import { useSelector, useDispatch } from 'react-redux';
import { deleteModeChanged } from './interfaceSlice';
import { eventDeleted, photosDeleted } from './timelineSlice';
import clsx from 'clsx';

const DeleteModeFooter = memo(function DeleteModeFooter() {
    const dispatch = useDispatch();
    const plantID = useSelector((state) => state.plant.plantDetails.uuid);
    const deleteMode = useSelector((state) => state.interface.deleteMode);
    const selectedEvents = useSelector((state) => state.interface.selectedEvents);
    const selectedPhotos = useSelector((state) => state.interface.selectedPhotos);

    // Get number of selected events and photos
    const totalSelectedEvents = Object.values(selectedEvents).reduce(
        (sum, arr) => sum + arr.length, 0
    );
    const totalSelected = totalSelectedEvents + selectedPhotos.length;

    // Show instructions until something selected, then number of selected items
    const instructionsText = totalSelected > 0 ? (
        `${totalSelected} item${totalSelected !== 1 ? 's' : ''} selected`
    ) : (
        'Select events and photos in the timeline'
    );

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
            <div className="flex flex-col items-center gap-4 w-full">
                {/* Instructions text, changes to number of selected items */}
                <div className={clsx(
                    "w-70 md:w-82 text-center",
                    "text-sm md:text-base font-semibold text-base-content"
                )}>
                    {instructionsText}
                </div>

                <div className="flex flex-row justify-center gap-8">
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
                </div>
            </div>
        </FloatingFooter>
    );
});

export default DeleteModeFooter;
