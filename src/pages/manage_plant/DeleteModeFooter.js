import React, { memo, useState, useEffect, useRef } from 'react';
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
    // Store total in ref so setNumberSelectedText always gets current value
    // (even when called from closure created when passed to onHoldStop)
    const totalSelectedRef = useRef(
        totalSelectedEvents + selectedPhotos.length + selectedNotes.length
    );

    // Controls text shown in footer (instructions or number selected)
    const [footerText, setFooterText] = useState('');
    // Alternate text shown while holding button and shortly after
    const [alternateText, setAlternateText] = useState(null);
    // Controls whether there is a fade transition when footer text changes
    // Should fade when changing from instructions to number selected, or when
    // changing to "Hold to confirm", but not when number of selected changes
    const [shouldFade, setShouldFade] = useState(false);

    // Sets footer text to number of selected items (or instructions if none)
    const setNumberSelectedText = () => {
        const count = totalSelectedRef.current;
        setFooterText(count > 0 ? (
            `${count} item${count !== 1 ? 's' : ''} selected`
        ) : (
            'Select timeline items to delete'
        ));
    };

    // Update instructions text when total selected changes
    useEffect(() => {
        // Read total from previous run, overwrite with current for next run
        const prevTotal = totalSelectedRef.current;
        const newTotal = totalSelectedEvents + selectedPhotos.length + selectedNotes.length;
        totalSelectedRef.current = newTotal;
        // Fade text when first item selected or last item unselected
        // (first selected: total=0 new=1, last unselected: total=1 new=0)
        setShouldFade(prevTotal + newTotal === 1 || newTotal === 0);
        // Update footer text
        setNumberSelectedText();
    }, [totalSelectedEvents, selectedPhotos, selectedNotes]);

    // Fade out number of selected items, fade in "Hold to confirm"
    const handleHoldDeleteStart = () => {
        setAlternateText('Hold to confirm');
        setShouldFade(true);
    };

    // Fade out "Hold to confirm", fade in number of selected items
    const handleHoldDeleteStop = () => {
        setAlternateText(null);
        setShouldFade(true);
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
            text={alternateText || footerText}
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
