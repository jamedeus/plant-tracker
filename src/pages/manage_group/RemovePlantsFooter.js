import React, { memo } from 'react';
import PropTypes from 'prop-types';
import { useDispatch, useSelector } from 'react-redux';
import { sendPostRequest } from 'src/util';
import { plantsRemoved } from './groupSlice';
import { openErrorModal } from 'src/components/ErrorModal';
import { getSelectedItems } from 'src/components/EditableNodeList';
import EditableNodeListActions from 'src/components/EditableNodeListActions';

const RemovePlantsFooter = memo(function RemovePlantsFooter({
    visible,
    selectedPlantsRef,
    stopRemovingPlants
}) {
    const dispatch = useDispatch();
    const groupId = useSelector((state) => state.group.group.uuid);

    // Handler for remove button in FloatingFooter that appears when remove
    // dropdown option clicked
    const removePlants = async () => {
        const response = await sendPostRequest('/bulk_remove_plants_from_group', {
            group_id: groupId,
            plants: getSelectedItems(selectedPlantsRef)
        });
        if (response.ok) {
            const data = await response.json();
            dispatch(plantsRemoved(data.removed));
            // Hide FloatingFooter and checkboxes
            stopRemovingPlants();
        } else {
            const error = await response.json();
            openErrorModal(JSON.stringify(error));
        }
    };

    return (
        <EditableNodeListActions
            visible={visible}
            formRefs={[selectedPlantsRef]}
            onClose={stopRemovingPlants}
            itemName="plant"
            initialText="Select plants to remove"
            testId="remove-plants-footer"
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
    stopRemovingPlants: PropTypes.func.isRequired,
};

export default RemovePlantsFooter;
