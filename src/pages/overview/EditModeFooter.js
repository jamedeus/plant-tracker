import React, { memo, useState } from 'react';
import PropTypes from 'prop-types';
import { useDispatch } from 'react-redux';
import { getSelectedItems } from 'src/components/EditableNodeList';
import EditableNodeListActions from 'src/components/EditableNodeListActions';
import { sendPostRequest } from 'src/util';
import { openErrorModal } from 'src/components/ErrorModal';
import HoldToConfirm from 'src/components/HoldToConfirm';
import { plantsRemoved, groupsRemoved, showArchiveChanged } from './overviewSlice';

const EditModeFooter = memo(function EditModeFooter({
    visible,
    selectedPlantsRef,
    selectedGroupsRef,
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
        const selectedPlants = getSelectedItems(selectedPlantsRef);
        const selectedGroups = getSelectedItems(selectedGroupsRef);
        const selectedUuids = selectedPlants.concat(selectedGroups);

        // Don't send empty request if nothing selected
        if (!selectedUuids.length) {
            return;
        }

        // Send /bulk_delete_plants_and_groups request with all selected UUIDs
        const response = await sendPostRequest(
            '/bulk_delete_plants_and_groups',
            {uuids: selectedPlants.concat(selectedGroups)}
        );
        // Remove deleted UUIDs from state
        if (response.ok) {
            const data = await response.json();
            dispatch(plantsRemoved(data.deleted));
            dispatch(groupsRemoved(data.deleted));
        } else {
            const data = await response.json();
            openErrorModal(`Failed to delete: ${data.failed.join(', ')}`);
        }

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
        const selectedPlants = getSelectedItems(selectedPlantsRef);
        const selectedGroups = getSelectedItems(selectedGroupsRef);
        const selectedUuids = selectedPlants.concat(selectedGroups);

        // Don't send empty request if nothing selected
        if (!selectedUuids.length) {
            return;
        }

        // Send /bulk_archive_plants_and_groups request with all selected UUIDs
        const response = await sendPostRequest(
            '/bulk_archive_plants_and_groups',
            {
                uuids: selectedUuids,
                archived: archived
            }
        );
        // Remove archived UUIDs from state
        if (response.ok) {
            const data = await response.json();
            dispatch(plantsRemoved(data.archived));
            dispatch(groupsRemoved(data.archived));
            // Ensure archive link visible in dropdown menu
            dispatch(showArchiveChanged(archived));
        } else {
            const data = await response.json();
            openErrorModal(`Failed to archive: ${data.failed.join(', ')}`);
        }

        // Reset editing state
        setEditing(false);
    };

    return (
        <EditableNodeListActions
            visible={visible}
            formRefs={[selectedPlantsRef, selectedGroupsRef]}
            onClose={() => setEditing(false)}
            itemName="item"
            initialText="Select plants and groups"
            alternateText={alternateText}
            testId="edit-mode-footer"
        >
            <button
                className="btn btn-neutral w-20"
                onClick={() => setEditing(false)}
            >
                Cancel
            </button>

            <button
                className="btn"
                onClick={handleArchive}
            >
                {archivedOverview ? "Un-archive" : "Archive"}
            </button>

            <HoldToConfirm
                callback={handleDelete}
                timeout={2500}
                buttonText="Delete"
                buttonClass="w-20"
                onHoldStart={handleHoldDeleteStart}
                onHoldStop={handleHoldDeleteStop}
            />
        </EditableNodeListActions>
    );
});

EditModeFooter.propTypes = {
    visible: PropTypes.bool.isRequired,
    selectedPlantsRef: PropTypes.oneOfType([
        PropTypes.func,
        PropTypes.shape({ current: PropTypes.instanceOf(Element) }),
    ]).isRequired,
    selectedGroupsRef: PropTypes.oneOfType([
        PropTypes.func,
        PropTypes.shape({ current: PropTypes.instanceOf(Element) }),
    ]).isRequired,
    setEditing: PropTypes.func.isRequired,
    archivedOverview: PropTypes.bool.isRequired,
};

export default EditModeFooter;
