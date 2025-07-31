import React, { memo, useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { localToUTC } from 'src/timestampUtils';
import { sendPostRequest, pastTense, getMostRecent } from 'src/util';
import { getSelectedItems } from 'src/components/EditableNodeList';
import FloatingFooter from 'src/components/FloatingFooter';
import { openErrorModal } from 'src/components/ErrorModal';
import { FaDroplet, FaSeedling, FaScissors } from 'react-icons/fa6';

const AddEventsFooter = memo(function AddEventsFooter({
    visible,
    selectedPlantsRef,
    plants,
    setPlants,
    setAddingEvents,
}) {
    // Track total selected items (shown in footer text)
    const [totalSelected, setTotalSelected] = useState(0);
    // Controls text shown in footer (instructions, number selected, or success)
    const [footerText, setFooterText] = useState('');
    // Controls whether there is a fade transition when footer text changes
    // Should fade when changing from instructions to number selected, or when
    // changing to success message, but not when number of selected changes
    const [shouldFade, setShouldFade] = useState(false);
    // Used to keep shouldFade true while success message shown/hidden
    const successTimerRef = useRef(null);

    // Sets footer text to number of selected plants (or instructions if none)
    const setNumberSelectedText = () => {
        setFooterText(
            totalSelected > 0 ? (
                `${totalSelected} plant${totalSelected !== 1 ? 's' : ''} selected`
            ) : (
                'Select plants to add events'
            )
        );
    };

    // Sets footer text to success message, changes back after 3 seconds
    const showSuccessMessage = (message) => {
        clearTimeout(successTimerRef.current);

        // Fade to success message
        setShouldFade(true);
        setFooterText(message);

        // Fade back to instructions text in 3 seconds
        successTimerRef.current = setTimeout(() => {
            setNumberSelectedText();
            setTimeout(() => {
                setShouldFade(false);
            }, 200);
        }, 3000);
    };

    // Update total selected count when user checks/unchecks checkboxes
    useEffect(() => {
        // Only update when footer is visible
        if (!visible) {
            return;
        }

        // Updates total selected items count
        const updateSelectedCount = () => {
            const newTotalSelected = getSelectedItems(selectedPlantsRef).length;
            // Fade text when first plant selected or last plant unselected
            // (first selected: total=0 new=1, last unselected: total=1 new=0)
            setShouldFade(totalSelected + newTotalSelected === 1);
            setTotalSelected(newTotalSelected);
        };

        // Add listeners to plant form to update count
        selectedPlantsRef.current?.addEventListener('change', updateSelectedCount);

        // Remove event listeners when component unmounts (don't stack)
        return () => {
            selectedPlantsRef.current?.removeEventListener('change', updateSelectedCount);
        };
    }, [selectedPlantsRef, totalSelected, visible]);

    // Update instructions text when total selected changes
    useEffect(() => {
        setNumberSelectedText();
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

    const handleAddEvents = async (eventType) => {
        const selectedPlants = getSelectedItems(selectedPlantsRef);

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
        <FloatingFooter
            visible={visible}
            text={footerText}
            fadeText={shouldFade}
            onClose={cancelAddEvents}
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
        </FloatingFooter>
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
