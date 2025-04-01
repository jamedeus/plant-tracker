import React, { useRef } from 'react';
import { useSelector } from 'react-redux';
import PropTypes from 'prop-types';
import Modal from 'src/components/Modal';
import GroupCard from 'src/components/GroupCard';

let modalRef;

export const openGroupModal = () => {
    modalRef.current.open();
};

export const closeGroupModal = () => {
    modalRef.current.close();
};

const GroupModal = ({ handleAddGroup }) => {
    modalRef = useRef(null);

    const groupOptions = useSelector((state) => state.plant.groupOptions);

    return (
        <Modal title='Add plant to group' ref={modalRef}>
            <div className="flex flex-col px-4 overflow-y-scroll">
                {groupOptions.map(group => (
                    <div
                        key={group.uuid}
                        className="max-w-80 w-full mx-auto mb-4 cursor-pointer"
                        onClick={() => handleAddGroup(group.uuid)}
                    >
                        <GroupCard key={group.uuid} linkPage={false} {...group} />
                    </div>
                ))}
            </div>
        </Modal>
    );
};

GroupModal.propTypes = {
    handleAddGroup: PropTypes.func.isRequired
};

export default GroupModal;
