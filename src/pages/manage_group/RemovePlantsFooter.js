import React, { memo, useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { getSelectedItems } from 'src/components/EditableNodeList';
import FloatingFooter from 'src/components/FloatingFooter';

const RemovePlantsFooter = memo(function RemovePlantsFooter({
    visible,
    selectedPlantsRef,
    removePlants,
    stopRemovingPlants
}) {
    // Track total selected items (shown in footer text)
    const [totalSelected, setTotalSelected] = useState(0);
    // Controls text shown in footer (instructions or number selected)
    const [footerText, setFooterText] = useState('');
    // Controls whether there is a fade transition when footer text changes
    // Should fade when changing from instructions to number selected, but not
    // when number of selected changes
    const [shouldFade, setShouldFade] = useState(false);

    // Sets footer text to number of selected plants (or instructions if none)
    const setNumberSelectedText = () => {
        setFooterText(
            totalSelected > 0 ? (
                `${totalSelected} plant${totalSelected !== 1 ? 's' : ''} selected`
            ) : (
                'Select plants to remove'
            )
        );
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

    return (
        <FloatingFooter
            visible={visible}
            text={footerText}
            fadeText={shouldFade}
            onClose={stopRemovingPlants}
        >
            <button
                className="btn btn-neutral w-22"
                onClick={stopRemovingPlants}
            >
                Cancel
            </button>

            <button
                className="btn btn-error"
                onClick={removePlants}
            >
                Remove
            </button>
        </FloatingFooter>
    );
});

RemovePlantsFooter.propTypes = {
    visible: PropTypes.bool.isRequired,
    selectedPlantsRef: PropTypes.oneOfType([
        PropTypes.func,
        PropTypes.shape({ current: PropTypes.instanceOf(Element) }),
    ]).isRequired,
    removePlants: PropTypes.func.isRequired,
    stopRemovingPlants: PropTypes.func.isRequired,
};

export default RemovePlantsFooter;
