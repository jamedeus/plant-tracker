import React, { memo, useState, useRef } from 'react';
import PropTypes from 'prop-types';
import { localToUTC } from 'src/timestampUtils';
import { sendPostRequest, pastTense, getMostRecent } from 'src/util';
import { getSelectedItems, filterSelectedItems } from 'src/components/EditableNodeList';
import EditableNodeListActions from 'src/components/EditableNodeListActions';
import { openErrorModal } from 'src/components/ErrorModal';
import { FaDroplet, FaSeedling, FaScissors } from 'react-icons/fa6';

const AddEventsFooter = memo(function AddEventsFooter({
    visible,
    selectedPlantsRef,
    plants,
    setPlants,
    setAddingEvents,
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

    // Map eventType taken by bulk_add_plant_events to the plantDetails state
    // key that should be updated when an event is successfully created
    const eventTypeMap = {
        water: "last_watered",
        fertilize: "last_fertilized"
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
            if (eventType in eventTypeMap) {
                let newPlants = { ...plants };
                const lastEvent = eventTypeMap[eventType];
                data.plants.forEach(uuid => {
                    newPlants[uuid][lastEvent] = getMostRecent(
                        newPlants[uuid][lastEvent],
                        timestamp
                    );
                });
                setPlants(newPlants);
            }
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
            onClose={() => setAddingEvents(false)}
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
    selectedPlantsRef: PropTypes.oneOfType([
        PropTypes.func,
        PropTypes.shape({ current: PropTypes.instanceOf(Element) }),
    ]).isRequired,
    plants: PropTypes.object.isRequired,
    setPlants: PropTypes.func.isRequired,
    setAddingEvents: PropTypes.func.isRequired,
};

export default AddEventsFooter;
