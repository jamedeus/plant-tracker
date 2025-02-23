import React, { useRef } from 'react';
import PropTypes from 'prop-types';
import Modal from 'src/components/Modal';
import GroupCard from 'src/components/GroupCard';
import { sendPostRequest } from 'src/util';
import { showErrorModal } from 'src/components/ErrorModal';

let groupModalRef;

export const openGroupModal = () => {
    groupModalRef.current.showModal();
};

const GroupModal = ({ plantID, groupOptions, handleAddGroup }) => {
    groupModalRef = useRef(null);

    // Handler for confirm button
    const addToGroup = async (groupID) => {
        const payload = {
            plant_id: plantID,
            group_id: groupID
        };
        const response = await sendPostRequest('/add_plant_to_group', payload);
        if (response.ok) {
            // Update plant state with group name and UUID from response
            const data = await response.json();
            handleAddGroup(data.group_name, data.group_uuid);
        } else {
            const error = await response.json();
            showErrorModal(JSON.stringify(error));
        }
        // Close modal
        groupModalRef.current.close();
    };

    return (
        <Modal dialogRef={groupModalRef} title='Add plant to group'>
            <div className="flex flex-col px-4 overflow-scroll">
                {groupOptions.map(group => (
                    <div
                        key={group.uuid}
                        className="max-w-80 w-full mx-auto mb-4 cursor-pointer"
                        onClick={() => addToGroup(group.uuid)}
                    >
                        <GroupCard key={group.uuid} linkPage={false} {...group} />
                    </div>
                ))}
            </div>
        </Modal>
    );
};

GroupModal.propTypes = {
    plantID: PropTypes.string.isRequired,
    groupOptions: PropTypes.array.isRequired,
    handleAddGroup: PropTypes.func.isRequired
};

export default GroupModal;
