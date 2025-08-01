import React, { memo } from 'react';
import PropTypes from 'prop-types';
import EditableNodeListActions from 'src/components/EditableNodeListActions';

const RemovePlantsFooter = memo(function RemovePlantsFooter({
    visible,
    selectedPlantsRef,
    removePlants,
    stopRemovingPlants
}) {
    return (
        <EditableNodeListActions
            visible={visible}
            formRefs={[selectedPlantsRef]}
            onClose={stopRemovingPlants}
            itemName="plant"
            initialText="Select plants to remove"
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
        </EditableNodeListActions>
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
