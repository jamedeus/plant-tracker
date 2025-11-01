import React, { memo, useState, useMemo, useRef } from 'react';
import FloatingFooter from 'src/components/FloatingFooter';
import sendPostRequest from 'src/utils/sendPostRequest';
import { useSelector, useDispatch } from 'react-redux';
import { deleteModeChanged } from './interfaceSlice';
import { eventsDeleted, photosDeleted, notesDeleted } from './timelineSlice';
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

    // Tracks number selected in previous render
    // Used to detect when first selected/last unselected
    const previousTotalRef = useRef(totalSelected);

    // Alternate text shown while holding button and shortly after
    // Replaces number selected when non-null, always has fade transition
    const [alternateText, setAlternateText] = useState(null);

    // Controls whether there is a fade transition when footer text changes
    // Should fade when all text changes but not when number of selected changes
    const shouldFade = useMemo(() => {
        // Read total from previous run, overwrite with current for next run
        const prevTotal = previousTotalRef.current;
        previousTotalRef.current = totalSelected;

        // Fade if alternateText set
        if (alternateText) return true;

        // Fade text when first item selected or last item unselected
        // (first selected: total=0 new=1, last unselected: total=1 new=0)
        // Also fade when number did not change (text manually changed)
        return prevTotal + totalSelected === 1 || prevTotal === totalSelected;
    }, [alternateText, totalSelected, deleteMode]);

    // Controls text shown in footer
    const footerText = alternateText || (
        totalSelected > 0
            ? `${totalSelected} item${totalSelected !== 1 ? 's' : ''} selected`
            : 'Select timeline items to delete'
    );

    // Fade out number of selected items, fade in "Hold to confirm"
    const handleHoldDeleteStart = () => setAlternateText('Hold to confirm');

    // Fade out "Hold to confirm", fade in number of selected items
    const handleHoldDeleteStop = () => setAlternateText(null);

    const cancelDeleteMode = () => {
        dispatch(deleteModeChanged({editing: false}));
    };

    // Callback fired when delete button held for required interval
    const handleDelete = async () => {
        // Delete events if 1 or more selected
        if (Object.values(selectedEvents).some(arr => arr.length > 0)) {
            const payload = { plant_id: plantID, events: selectedEvents };
            // Remove events from timeline if successful
            const onSuccess = (data) => dispatch(eventsDeleted(data.deleted));
            await sendPostRequest('/delete_plant_events', payload, onSuccess);
        }

        // Delete photos if 1 or more selected
        if (selectedPhotos.length) {
            const payload = { plant_id: plantID, photos: selectedPhotos };
            // Remove photos from timeline if successful
            const onSuccess = (data) => dispatch(photosDeleted(data.deleted));
            await sendPostRequest('/delete_plant_photos', payload, onSuccess);
        }

        // Delete notes if 1 or more selected
        if (selectedNotes.length) {
            const payload = { plant_id: plantID, timestamps: selectedNotes };
            // Remove notes from timeline if successful
            const onSuccess = (data) => dispatch(notesDeleted(data.deleted));
            await sendPostRequest('/delete_plant_notes', payload, onSuccess);
        }

        // Hide footer
        cancelDeleteMode();
    };

    return (
        <FloatingFooter
            visible={deleteMode}
            text={footerText}
            fadeText={shouldFade}
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
