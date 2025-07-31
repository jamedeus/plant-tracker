import React, { memo, useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { getSelectedItems } from 'src/components/EditableNodeList';
import FloatingFooter from 'src/components/FloatingFooter';
import { sendPostRequest } from 'src/util';
import { openErrorModal } from 'src/components/ErrorModal';
import HoldToConfirm from 'src/components/HoldToConfirm';

const EditModeFooter = memo(function EditModeFooter({
    visible,
    selectedPlantsRef,
    selectedGroupsRef,
    plants,
    groups,
    setPlants,
    setGroups,
    setEditing,
    archivedOverview,
    setShowArchive
}) {
    // Track if user is holding delete (set by onHoldStart and onHoldStop)
    const [holdingDelete, setHoldingDelete] = useState(false);

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
            const selectedPlants = getSelectedItems(selectedPlantsRef);
            const selectedGroups = getSelectedItems(selectedGroupsRef);
            setTotalSelected(selectedPlants.length + selectedGroups.length);
        };

        // Add listeners to both forms to update count
        const plantsForm = selectedPlantsRef.current;
        const groupsForm = selectedGroupsRef.current;
        if (plantsForm) {
            plantsForm.addEventListener('change', updateSelectedCount);
        }
        if (groupsForm) {
            groupsForm.addEventListener('change', updateSelectedCount);
        }

        // Remove event listeners when component unmounts (don't stack)
        return () => {
            if (plantsForm) {
                plantsForm.removeEventListener('change', updateSelectedCount);
            }
            if (groupsForm) {
                groupsForm.removeEventListener('change', updateSelectedCount);
            }
        };
    }, [selectedPlantsRef, selectedGroupsRef, visible]);

    // Show instructions until something selected, then number of selected items
    const [instructionsText, setInstructionsText] = useState('');
    useEffect(() => {
        setInstructionsText(
            totalSelected > 0 ? (
                `${totalSelected} item${totalSelected !== 1 ? 's' : ''} selected`
            ) : (
                'Select plants and groups'
            )
        );
    }, [totalSelected]);

    // Controls whether instruction text fades when changed
    // Should fade when changing from instructions to number selected, or when
    // changing to "Hold to confirm", but not when number of selected changes
    const [fadeText, setFadeText] = useState(false);

    // Fade out current text, fade in "Hold to confirm"
    const handleHoldStart = () => {
        setHoldingDelete(true);
        setFadeText(true);
    };

    // Fade out "Hold to confirm", fade in current text
    const handleHoldStop = () => {
        setHoldingDelete(false);
        // Keep fade enabled until new text fades in
        setTimeout(() => setFadeText(false), 250);
    };

    const cancelEditing = () => {
        setEditing(false);
    };

    // Handler for delete button that appears while editing
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
            const newPlants = { ...plants };
            data.deleted.forEach(uuid => delete newPlants[uuid]);
            setPlants(newPlants);
            const newGroups = { ...groups };
            data.deleted.forEach(uuid => delete newGroups[uuid]);
            setGroups(newGroups);
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
        // Remove deleted UUIDs from state
        if (response.ok) {
            const data = await response.json();
            const newPlants = { ...plants };
            data.archived.forEach(uuid => delete newPlants[uuid]);
            setPlants(newPlants);
            const newGroups = { ...groups };
            data.archived.forEach(uuid => delete newGroups[uuid]);
            setGroups(newGroups);

            // Ensure archive link visible in dropdown menu
            setShowArchive(archived);

            // Archived overview: redirect to overview if no plants or groups left
            if (
                archivedOverview &&
                !Object.keys(newPlants).length &&
                !Object.keys(newGroups).length
            ) {
                window.location.href = "/";
            }
        } else {
            const data = await response.json();
            openErrorModal(`Failed to archive: ${data.failed.join(', ')}`);
        }

        // Reset editing state
        setEditing(false);
    };

    return (
        <FloatingFooter
            visible={visible}
            text={holdingDelete ? 'Hold to confirm' : instructionsText}
            fadeText={totalSelected <= 1 || fadeText}
            onClose={cancelEditing}
            testId="edit-mode-footer"
        >
            <button
                className="btn btn-neutral w-20"
                onClick={cancelEditing}
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
                onHoldStart={handleHoldStart}
                onHoldStop={handleHoldStop}
            />
        </FloatingFooter>
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
    plants: PropTypes.object.isRequired,
    groups: PropTypes.object.isRequired,
    setPlants: PropTypes.func.isRequired,
    setGroups: PropTypes.func.isRequired,
    setEditing: PropTypes.func.isRequired,
    archivedOverview: PropTypes.bool.isRequired,
    setShowArchive: PropTypes.func.isRequired
};

export default EditModeFooter;
