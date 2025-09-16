import React, { memo, useState, useRef } from 'react';
import PropTypes from 'prop-types';
import { pastTense } from 'src/utils/stringUtils';
import { localToUTC } from 'src/utils/timestampUtils';
import sendPostRequest from 'src/utils/sendPostRequest';
import { getSelectedItems, filterSelectedItems } from 'src/components/EditableNodeList';
import EditableNodeListActions from 'src/components/EditableNodeListActions';
import { openErrorModal } from 'src/components/ErrorModal';
import { FaDroplet, FaSeedling, FaScissors } from 'react-icons/fa6';
import plantDetailsProptypes from 'src/types/plantDetailsPropTypes';

const AddEventsFooter = memo(function AddEventsFooter({
    visible,
    onClose,
    selectedPlantsRef,
    plants,
    updatePlantLastEventTimes
}) {
    const [alternateText, setAlternateText] = useState(null);
    const alternateTextTimerRef = useRef(null);

    // Replaces number of plants selected with message for timeout milliseconds
    const showAlternateTextMessage = (message, timeout) => {
        clearTimeout(alternateTextTimerRef.current);
        setAlternateText(message);
        alternateTextTimerRef.current = setTimeout(() => {
            setAlternateText(null);
        }, timeout);
    };

    const handleAddEvents = async (eventType) => {
        // Get all selected plants that are not archived
        const selectedPlants = filterSelectedItems(
            getSelectedItems(selectedPlantsRef),
            plants,
            { archived: false }
        );

        // Don't send empty request if nothing selected
        if (!selectedPlants.length) {
            showAlternateTextMessage('No plants selected', 1500);
            return;
        }

        // Send /bulk_add_plant_events request with all selected UUIDs
        const timestamp = localToUTC(new Date().toISOString());
        const response = await sendPostRequest('/bulk_add_plant_events', {
            plants: selectedPlants,
            event_type: eventType,
            timestamp: timestamp
        });
        if (response.ok) {
            const data = await response.json();
            // Update last_watered/last_fertilized times for selected plants
            updatePlantLastEventTimes({
                eventType: eventType,
                plantIds: data.plants,
                timestamp: data.timestamp
            });
            // Show success message in footer
            showAlternateTextMessage(`Plants ${pastTense(eventType)}!`, 3000);
        } else {
            const error = await response.json();
            openErrorModal(JSON.stringify(error));
        }
    };

    return (
        <EditableNodeListActions
            visible={visible}
            formRefs={[selectedPlantsRef]}
            onClose={onClose}
            itemName="plant"
            initialText="Select plants to add events"
            alternateText={alternateText}
            closeButton={true}
            closeButtonAriaLabel="Stop adding events"
            testId="add-events-footer"
        >
            <button
                className="btn btn-square btn-info"
                onClick={() => handleAddEvents('water')}
                aria-label="Water selected plants"
                data-testid="water-button"
            >
                <FaDroplet className="size-5 text-neutral" />
            </button>

            <button
                className="btn btn-square btn-success"
                onClick={() => handleAddEvents('fertilize')}
                aria-label="Fertilize selected plants"
                data-testid="fertilize-button"
            >
                <FaSeedling className="size-5 text-neutral" />
            </button>

            <button
                className="btn btn-square btn-prune"
                onClick={() => handleAddEvents('prune')}
                aria-label="Prune selected plants"
                data-testid="prune-button"
            >
                <FaScissors className="size-5 text-neutral" />
            </button>
        </EditableNodeListActions>
    );
});

AddEventsFooter.propTypes = {
    visible: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    selectedPlantsRef: PropTypes.oneOfType([
        PropTypes.func,
        PropTypes.shape({ current: PropTypes.instanceOf(Element) }),
    ]).isRequired,
    plants: PropTypes.objectOf(plantDetailsProptypes).isRequired,
    updatePlantLastEventTimes: PropTypes.func.isRequired,
};

export default AddEventsFooter;
