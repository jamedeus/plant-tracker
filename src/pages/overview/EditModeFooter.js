import React, { memo, useState } from 'react';
import PropTypes from 'prop-types';
import { useDispatch } from 'react-redux';
import EditableNodeListActions from 'src/components/EditableNodeListActions';
import sendPostRequest from 'src/utils/sendPostRequest';
import { openErrorModal } from 'src/components/ErrorModal';
import HoldToConfirm from 'src/components/HoldToConfirm';
import { plantsRemoved, groupsRemoved, showArchiveChanged } from './overviewSlice';
import controllerPropTypes from 'src/types/editableNodeListControllerPropTypes';

const EditModeFooter = memo(function EditModeFooter({
    visible,
    selectedPlantsController,
    selectedGroupsController,
    setEditing,
    archivedOverview,
}) {
    const dispatch = useDispatch();
    const [alternateText, setAlternateText] = useState(null);

    // Fade out number of selected items, fade in "Hold to confirm"
    const handleHoldDeleteStart = () => {
        setAlternateText('Hold to confirm');
    };

    // Fade out "Hold to confirm", fade in number of selected items
    const handleHoldDeleteStop = () => {
        setAlternateText(null);
    };

    // Callback fired when delete button held for required interval
    const handleDelete = async () => {
        // Get combined array of selected plant and group uuids
        const selectedPlants = Array.from(selectedPlantsController.getSnapshot());
        const selectedGroups = Array.from(selectedGroupsController.getSnapshot());
        const selectedUuids = selectedPlants.concat(selectedGroups);

        // Don't send empty request if nothing selected
        if (!selectedUuids.length) {
            return;
        }

        // Send /bulk_delete_plants_and_groups request with all selected UUIDs
        const payload = { uuids: selectedUuids };
        const onSuccess = (data) => {
            dispatch(plantsRemoved(data.deleted));
            dispatch(groupsRemoved(data.deleted));
            // Remove deleted uuids from controller selection
            selectedPlantsController.bulkUnselect?.(data.deleted);
            selectedGroupsController.bulkUnselect?.(data.deleted);
        };
        const onError = (data) => openErrorModal(
            `Failed to delete: ${data.failed.join(', ')}`
        );
        await sendPostRequest('/bulk_delete_plants_and_groups', payload, onSuccess, onError);

        // Reset editing state
        setEditing(false);
    };

    // Handler for archive button (main overview) and un-archive button
    // (archive overview). POSTS selected plants and groups to backend then
    // removes from frontend state.
    const handleArchive = async () => {
        // Main overview: set payload arg to true (archive plants)
        // Archived overview: set payload arg to false (un-archive plants)
        const archived = !archivedOverview;

        // Get combined array of selected plant and group uuids
        const selectedPlants = Array.from(selectedPlantsController.getSnapshot());
        const selectedGroups = Array.from(selectedGroupsController.getSnapshot());
        const selectedUuids = selectedPlants.concat(selectedGroups);

        // Don't send empty request if nothing selected
        if (!selectedUuids.length) {
            return;
        }

        // Send /bulk_archive_plants_and_groups request with all selected UUIDs
        const payload = { uuids: selectedUuids, archived: archived };
        const onSuccess = (data) => {
            dispatch(plantsRemoved(data.archived));
            dispatch(groupsRemoved(data.archived));
            // Ensure archive link visible in dropdown menu
            dispatch(showArchiveChanged(archived));
            // Remove archived uuids from controller selection
            selectedPlantsController.bulkUnselect?.(data.archived);
            selectedGroupsController.bulkUnselect?.(data.archived);
        };
        const onError = (data) => openErrorModal(
            `Failed to archive: ${data.failed.join(', ')}`
        );
        await sendPostRequest('/bulk_archive_plants_and_groups', payload, onSuccess, onError);

        // Reset editing state
        setEditing(false);
    };

    return (
        <EditableNodeListActions
            visible={visible}
            controllers={[selectedPlantsController, selectedGroupsController]}
            onClose={() => setEditing(false)}
            itemName="item"
            initialText="Select plants and groups"
            alternateText={alternateText}
            testId="edit-mode-footer"
        >
            <button
                className="btn btn-neutral w-20"
                onClick={() => setEditing(false)}
                aria-label="Exit edit mode"
            >
                Cancel
            </button>

            <button
                className="btn"
                onClick={handleArchive}
                aria-label={archivedOverview ?
                    "Un-archive selected plants and groups" :
                    "Archive selected plants and groups"
                }
            >
                {archivedOverview ? "Un-archive" : "Archive"}
            </button>

            <HoldToConfirm
                callback={handleDelete}
                timeout={2500}
                buttonText="Delete"
                buttonClass="w-20"
                buttonAriaLabel="Press and hold to delete selected plants and groups"
                onHoldStart={handleHoldDeleteStart}
                onHoldStop={handleHoldDeleteStop}
            />
        </EditableNodeListActions>
    );
});

EditModeFooter.propTypes = {
    visible: PropTypes.bool.isRequired,
    selectedPlantsController: controllerPropTypes.isRequired,
    selectedGroupsController: controllerPropTypes.isRequired,
    setEditing: PropTypes.func.isRequired,
    archivedOverview: PropTypes.bool.isRequired,
};

export default EditModeFooter;
