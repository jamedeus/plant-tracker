import React, { memo, useState, useRef } from 'react';
import PropTypes from 'prop-types';
import { localToUTC } from 'src/timestampUtils';
import { sendPostRequest, pastTense } from 'src/util';
import { getSelectedItems, filterSelectedItems } from 'src/components/EditableNodeList';
import EditableNodeListActions from 'src/components/EditableNodeListActions';
import { openErrorModal } from 'src/components/ErrorModal';
import { FaDroplet, FaSeedling, FaScissors } from 'react-icons/fa6';

const AddEventsFooter = memo(function AddEventsFooter({
    visible,
    onClose,
    selectedPlantsRef,
    plants,
    updatePlantLastEventTimes
}) {
    const [successMessage, setSuccessMessage] = useState(null);
    const successMessageTimerRef = useRef(null);

    // Replaces number of plants selected with success message for 3 seconds
    const showSuccessMessage = (message) => {
        clearTimeout(successMessageTimerRef.current);
        setSuccessMessage(message);
        successMessageTimerRef.current = setTimeout(() => {
            setSuccessMessage(null);
        }, 3000);
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
            showSuccessMessage(`Plants ${pastTense(eventType)}!`);
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
            alternateText={successMessage}
            closeButton={true}
            testId="add-events-footer"
        >
            <button
                className="btn btn-square btn-info"
                onClick={() => handleAddEvents('water')}
                data-testid="water-button"
            >
                <FaDroplet className="size-5 text-neutral" />
            </button>

            <button
                className="btn btn-square btn-success"
                onClick={() => handleAddEvents('fertilize')}
                data-testid="fertilize-button"
            >
                <FaSeedling className="size-5 text-neutral" />
            </button>

            <button
                className="btn btn-square btn-prune"
                onClick={() => handleAddEvents('prune')}
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
    plants: PropTypes.object.isRequired,
    updatePlantLastEventTimes: PropTypes.func.isRequired,
};

export default AddEventsFooter;
