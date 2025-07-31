import React, { memo, useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { localToUTC } from 'src/timestampUtils';
import { sendPostRequest, pastTense } from 'src/util';
import FloatingFooter from 'src/components/FloatingFooter';
import { openErrorModal } from 'src/components/ErrorModal';
import { showToast } from 'src/components/Toast';

const EditModeFooter = memo(function EditModeFooter({
    visible,
    selectedPlantsRef,
    plants,
    setPlants,
    setAddingEvents,
}) {
    // Returns array of selected plant UUIDs parsed from PlantsCol form
    const getSelectedPlants = () => {
        if (selectedPlantsRef.current) {
            const selected = new FormData(selectedPlantsRef.current);
            return Array.from(selected.keys());
        } else {
            return [];
        }
    };

    // Track total selected items (shown in footer text)
    const [totalSelected, setTotalSelected] = useState(0);

    // Update total selected count when user checks/unchecks checkboxes
    useEffect(() => {
        // Only update when footer is visible
        if (!visible) {
            return;
        }

        // Updates total selected items count
        const updateSelectedCount = () => {
            const selectedPlants = getSelectedPlants();
            setTotalSelected(selectedPlants.length);
        };

        // Add listeners to plant form to update count
        const plantsForm = selectedPlantsRef.current;
        if (plantsForm) {
            plantsForm.addEventListener('change', updateSelectedCount);
        }

        // Remove event listeners when component unmounts (don't stack)
        return () => {
            if (plantsForm) {
                plantsForm.removeEventListener('change', updateSelectedCount);
            }
        };
    }, [selectedPlantsRef, visible]);

    // Show instructions until something selected, then number of selected items
    const [instructionsText, setInstructionsText] = useState('');
    useEffect(() => {
        setInstructionsText(
            totalSelected > 0 ? (
                `${totalSelected} plant${totalSelected !== 1 ? 's' : ''} selected`
            ) : (
                'Select plants to add events'
            )
        );
    }, [totalSelected]);

    const cancelAddEvents = () => {
        setAddingEvents(false);
    };

    // Map eventType taken by bulk_add_plant_events to the plantDetails state
    // key that should be updated when an event is successfully created
    const eventTypeMap = {
        water: "last_watered",
        fertilize: "last_fertilized"
    };

    // Takes 2 ISO 8601 timestamps, returns most recent
    const getMostRecent = (oldTime, newTime) => {
        // Return new if old is null (ie plant had no water events before)
        if (!oldTime) {
            return newTime;
        } else if (newTime > oldTime) {
            return newTime;
        } else {
            return oldTime;
        }
    };

    const handleAddEvents = async (eventType) => {
        const selectedPlants = getSelectedPlants();

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
        // Update last_watered/last_fertilized timestamps for all plants
        if (response.ok) {
            const data = await response.json();

            let newPlants = { ...plants };
            const lastEvent = eventTypeMap[eventType];
            data.plants.forEach(uuid => {
                newPlants[uuid][lastEvent] = getMostRecent(
                    newPlants[uuid][lastEvent],
                    timestamp
                );
            });
            setPlants(newPlants);
            showToast(`Plants ${pastTense(eventType)}!`, 'blue', 5000);
        } else {
            const error = await response.json();
            openErrorModal(JSON.stringify(error));
        }

        // Hide footer
        setAddingEvents(false);
    };

    return (
        <FloatingFooter
            visible={visible}
            text={instructionsText}
            fadeText={totalSelected <= 1}
            onClose={cancelAddEvents}
            testId="add-events-footer"
        >
            <button
                className="btn btn-neutral"
                onClick={cancelAddEvents}
            >
                Done
            </button>

            <button
                className="btn btn-info"
                onClick={() => handleAddEvents('water')}
            >
                Water
            </button>

            <button
                className="btn btn-success"
                onClick={() => handleAddEvents('fertilize')}
            >
                Fertilize
            </button>
        </FloatingFooter>
    );
});

EditModeFooter.propTypes = {
    visible: PropTypes.bool.isRequired,
    selectedPlantsRef: PropTypes.oneOfType([
        PropTypes.func,
        PropTypes.shape({ current: PropTypes.instanceOf(Element) }),
    ]).isRequired,
    plants: PropTypes.object.isRequired,
    setPlants: PropTypes.func.isRequired,
    setAddingEvents: PropTypes.func.isRequired,
};

export default EditModeFooter;
