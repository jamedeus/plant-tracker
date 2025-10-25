import React, { memo } from 'react';
import PropTypes from 'prop-types';
import { useDispatch, useSelector } from 'react-redux';
import sendPostRequest from 'src/utils/sendPostRequest';
import { plantsRemoved } from './groupSlice';
import EditableNodeListActions from 'src/components/EditableNodeListActions';
import controllerPropTypes from 'src/types/editableNodeListControllerPropTypes';

const RemovePlantsFooter = memo(function RemovePlantsFooter({
    visible,
    selectedPlantsController,
    stopRemovingPlants
}) {
    const dispatch = useDispatch();
    const groupId = useSelector((state) => state.group.groupDetails.uuid);

    const removePlants = async () => {
        const payload = {
            group_id: groupId,
            plants: Array.from(selectedPlantsController.getSnapshot())
        };
        const onSuccess = (data) => {
            dispatch(plantsRemoved(data.removed));
            // Remove plants from selection
            selectedPlantsController.bulkUnselect?.(
                data.removed?.map((plant) => plant.uuid)
            );
            // Hide RemovePlantsFooter and checkboxes
            stopRemovingPlants();
        };
        await sendPostRequest('/bulk_remove_plants_from_group', payload, onSuccess);
    };

    return (
        <EditableNodeListActions
            visible={visible}
            controllers={[selectedPlantsController]}
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
    selectedPlantsController: controllerPropTypes.isRequired,
    stopRemovingPlants: PropTypes.func.isRequired,
};

export default RemovePlantsFooter;
