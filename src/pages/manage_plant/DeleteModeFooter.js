import React, { memo, useState, useEffect } from 'react';
import FloatingFooter from 'src/components/FloatingFooter';
import { sendPostRequest } from 'src/util';
import { openErrorModal } from 'src/components/ErrorModal';
import { useSelector, useDispatch } from 'react-redux';
import { deleteModeChanged } from './interfaceSlice';
import { eventDeleted, photosDeleted, noteDeleted } from './timelineSlice';
import HoldToConfirm from 'src/components/HoldToConfirm';

const DeleteModeFooter = memo(function DeleteModeFooter() {
    const dispatch = useDispatch();
    const plantID = useSelector((state) => state.plant.plantDetails.uuid);
    const deleteMode = useSelector((state) => state.interface.deleteMode);
    const selectedEvents = useSelector((state) => state.interface.selectedEvents);
    const selectedPhotos = useSelector((state) => state.interface.selectedPhotos);
    const selectedNotes = useSelector((state) => state.interface.selectedNotes);
    // Get user-configured hold to delete delay
    const holdToConfirmDelay = useSelector(
        (state) => state.settings.holdToConfirmDelay
    );
    // Track if user is holding delete (set by onHoldStart and onHoldStop)
    const [holdingDelete, setHoldingDelete] = useState(false);

    // Get number of selected events, photos, and notes
    const totalSelectedEvents = Object.values(selectedEvents).reduce(
        (sum, arr) => sum + arr.length, 0
    );
    const totalSelected = totalSelectedEvents + selectedPhotos.length + selectedNotes.length;

    // Show instructions until something selected, then number of selected items
    const [instructionsText, setInstructionsText] = useState('');
    useEffect(() => {
        setInstructionsText(
            totalSelected > 0 ? (
                `${totalSelected} item${totalSelected !== 1 ? 's' : ''} selected`
            ) : (
                'Select timeline items to delete'
            )
        );
    }, [totalSelected]);

    // Controls whether instruction text fades when changed
    // Should fade when changing from instructions to number selected, or when
    // changing to "Hold to confirm", but not when number of selected changes
    const [fadeText, setFadeText] = useState(false);

    // Fade out current text, fade in "Hold to confirm"
    const handleHoldStart = () => {
        setHoldingDelete(true);
        setFadeText(true);
    };

    // Fade out "Hold to confirm", fade in current text
    const handleHoldStop = () => {
        setHoldingDelete(false);
        // Keep fade enabled until new text fades in
        setTimeout(() => setFadeText(false), 250);
    };

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

        // Delete notes if 1 or more selected
        if (selectedNotes.length) {
            const response = await sendPostRequest('/delete_plant_notes', {
                plant_id: plantID,
                timestamps: selectedNotes
            });

            // If successful remove note from timeline
            if (response.ok) {
                const data = await response.json();
                data.deleted.forEach(timestamp => dispatch(noteDeleted(timestamp)));
            } else {
                const error = await response.json();
                openErrorModal(JSON.stringify(error));
            }
        }

        // Hide footer
        cancelDeleteMode();
    };

    return (
        <FloatingFooter
            visible={deleteMode}
            text={holdingDelete ? 'Hold to confirm' : instructionsText}
            fadeText={totalSelected <= 1 || fadeText}
            onClose={cancelDeleteMode}
        >
            <button
                className="btn btn-neutral w-20"
                onClick={cancelDeleteMode}
            >
                Cancel
            </button>

            <HoldToConfirm
                callback={handleDelete}
                timeout={holdToConfirmDelay}
                buttonText="Delete"
                buttonClass="w-20"
                onHoldStart={handleHoldStart}
                onHoldStop={handleHoldStop}
            />
        </FloatingFooter>
    );
});

export default DeleteModeFooter;
