import React, { useState, useRef } from 'react';
import PropTypes from 'prop-types';
import { useSelector, useDispatch } from 'react-redux';
import { sendPostRequest } from 'src/util';
import Modal from 'src/components/Modal';
import GroupCard from 'src/components/GroupCard';
import { openErrorModal } from 'src/components/ErrorModal';
import LoadingAnimation from 'src/components/LoadingAnimation';
import { plantAddedToGroup } from './plantSlice';
import groupDetailsProptypes from 'src/types/groupDetailsPropTypes';

let modalRef, loadOptions;

export const openGroupModal = () => {
    modalRef.current.open();
};

const Options = ({ options }) => {
    const dispatch = useDispatch();
    const plantID = useSelector((state) => state.plant.plantDetails.uuid);

    const submit = async (groupID) => {
        const response = await sendPostRequest('/add_plant_to_group', {
            plant_id: plantID,
            group_id: groupID
        });
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

    if (options) {
        return (
            <>
                {Object.entries(options).map(([uuid, group]) => (
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
                {!Object.keys(options).length && (
                    <span className="my-16">
                        No groups
                    </span>
                )}
            </>
        );
    } else {
        return <LoadingAnimation />;
    }
};

Options.propTypes = {
    options: PropTypes.objectOf(groupDetailsProptypes)
};

const GroupModal = () => {
    modalRef = useRef(null);

    // Stores options queried from backend
    const [options, setOptions] = useState(null);

    // Request options from backend, set state (called when modal opens)
    loadOptions = async () => {
        const response = await fetch('/get_add_to_group_options');
        if (response.ok) {
            const data = await response.json();
            setOptions(data.options);
        } else {
            setOptions({});
        }
    };

    // Clear options after close animation completes
    const clearOptions = () => {
        setTimeout(() => {
            setOptions(null);
        }, 200);
    };

    return (
        <Modal
            title='Add plant to group'
            ref={modalRef}
            onOpen={loadOptions}
            onClose={clearOptions}
        >
            <div className="flex flex-col items-center px-4 overflow-y-auto">
                <Options options={options} />
            </div>
        </Modal>
    );
};

export default GroupModal;
