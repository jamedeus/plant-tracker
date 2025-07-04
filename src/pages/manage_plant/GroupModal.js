import React, { useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { sendPostRequest } from 'src/util';
import Modal from 'src/components/Modal';
import GroupCard from 'src/components/GroupCard';
import { openErrorModal } from 'src/components/ErrorModal';
import { plantAddedToGroup } from './plantSlice';

let modalRef;

export const openGroupModal = () => {
    modalRef.current.open();
};

const GroupModal = () => {
    modalRef = useRef(null);

    const dispatch = useDispatch();
    const plantID = useSelector((state) => state.plant.plantDetails.uuid);
    const groupOptions = useSelector((state) => state.plant.groupOptions);

    const submit = async (groupID) => {
        const payload = {
            plant_id: plantID,
            group_id: groupID
        };
        const response = await sendPostRequest('/add_plant_to_group', payload);
        if (response.ok) {
            // Update plant state with group name and UUID from response
            const data = await response.json();
            dispatch(plantAddedToGroup({
                name: data.group_name,
                uuid: data.group_uuid
            }));
        } else {
            const error = await response.json();
            openErrorModal(JSON.stringify(error));
        }
        modalRef.current.close();
    };

    return (
        <Modal title='Add plant to group' ref={modalRef}>
            <div className="flex flex-col px-4 overflow-y-auto">
                {Object.entries(groupOptions).map(([uuid, group]) => (
                    <div
                        key={uuid}
                        className="flex relative w-full max-w-80 mx-auto mb-4"
                    >
                        <GroupCard key={uuid} {...group} />
                        {/* Cover card with transparent div with listener */}
                        <div
                            className="absolute h-full w-full cursor-pointer"
                            onClick={() => submit(uuid)}
                        ></div>
                    </div>
                ))}
                {!Object.keys(groupOptions).length && (
                    <span className="my-16">
                        No groups
                    </span>
                )}
            </div>
        </Modal>
    );
};

export default GroupModal;
