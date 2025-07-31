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

    // Get number of selected events, photos, and notes
    const totalSelectedEvents = Object.values(selectedEvents).reduce(
        (sum, arr) => sum + arr.length, 0
    );
    const totalSelected = totalSelectedEvents + selectedPhotos.length + selectedNotes.length;

    // Controls text shown in footer (instructions or number selected)
    const [footerText, setFooterText] = useState('');
    // Controls whether there is a fade transition when footer text changes
    // Should fade when changing from instructions to number selected, or when
    // changing to "Hold to confirm", but not when number of selected changes
    const [shouldFade, setShouldFade] = useState(false);

    // Sets footer text to number of selected items (or instructions if none)
    const setNumberSelectedText = () => {
        setFooterText(
            totalSelected > 0 ? (
                `${totalSelected} item${totalSelected !== 1 ? 's' : ''} selected`
            ) : (
                'Select timeline items to delete'
            )
        );
    };

    // Update instructions text when total selected changes
    useEffect(() => {
        setNumberSelectedText();
    }, [totalSelected]);

    // Fade out number of selected items, fade in "Hold to confirm"
    const handleHoldDeleteStart = () => {
        setFooterText('Hold to confirm');
        setShouldFade(true);
    };

    // Fade out "Hold to confirm", fade in number of selected items
    const handleHoldDeleteStop = () => {
        setNumberSelectedText();
        // Keep fade enabled until new text fades in
        setTimeout(() => setShouldFade(false), 250);
    };

    const cancelDeleteMode = () => {
        dispatch(deleteModeChanged({editing: false}));
    };

    // Callback fired when delete button held for required interval
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
            text={footerText}
            fadeText={totalSelected <= 1 || shouldFade}
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
                onHoldStart={handleHoldDeleteStart}
                onHoldStop={handleHoldDeleteStop}
            />
        </FloatingFooter>
    );
});

export default DeleteModeFooter;
