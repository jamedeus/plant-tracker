import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useSelector, useDispatch } from 'react-redux';
import sendPostRequest from 'src/utils/sendPostRequest';
import GroupCard from 'src/components/GroupCard';
import LoadingAnimation from 'src/components/LoadingAnimation';
import RegisterPageLink from 'src/components/RegisterPageLink';
import { plantAddedToGroup } from './plantSlice';
import groupDetailsProptypes from 'src/types/groupDetailsPropTypes';

const Options = ({ options, close }) => {
    const dispatch = useDispatch();
    const plantID = useSelector((state) => state.plant.plantDetails.uuid);

    const submit = async (groupID) => {
        const payload = { plant_id: plantID, group_id: groupID };
        // Update plant state with group name and UUID from response
        const onSuccess = (data) => dispatch(plantAddedToGroup({
            name: data.group_name,
            uuid: data.group_uuid
        }));
        await sendPostRequest('/add_plant_to_group', payload, onSuccess);
        close();
    };

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
                <div className="flex flex-col h-36 pb-4 justify-center gap-4">
                    <span>No groups</span>
                    <RegisterPageLink type="group" />
                </div>
            )}
        </>
    );
};

Options.propTypes = {
    options: PropTypes.objectOf(groupDetailsProptypes).isRequired,
    close: PropTypes.func.isRequired
};

const GroupModal = ({ close }) => {
    // Stores options queried from backend
    const [options, setOptions] = useState(null);

    // Request options from backend, set state (called when modal opens)
    const loadOptions = async () => {
        const response = await fetch('/get_add_to_group_options');
        if (response.ok) {
            const data = await response.json();
            setOptions(data.options);
        } else {
            setOptions({});
        }
    };

    // Get options from backend on first load
    useEffect(() => {
        loadOptions();
    }, []);

    return (
        <div className="flex flex-col items-center px-4 overflow-y-auto">
            {options ? (
                <Options options={options} close={close} />
            ) : (
                <LoadingAnimation />
            )}
        </div>
    );
};

GroupModal.propTypes = {
    close: PropTypes.func.isRequired
};

export default GroupModal;
