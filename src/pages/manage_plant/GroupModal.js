import React, { useState, useEffect, useLayoutEffect } from 'react';
import PropTypes from 'prop-types';
import { v4 as uuidv4 } from 'uuid';
import { useSelector, useDispatch } from 'react-redux';
import sendPostRequest from 'src/utils/sendPostRequest';
import GroupCard from 'src/components/GroupCard';
import FormModal from 'src/components/FormModal';
import GroupDetailsForm from 'src/components/GroupDetailsForm';
import LoadingAnimation from 'src/components/LoadingAnimation';
import { openErrorModal } from 'src/components/ErrorModal';
import Checkmark from 'src/components/Checkmark';
import { FaPlus } from 'react-icons/fa6';
import { plantAddedToGroup } from './plantSlice';
import groupDetailsProptypes from 'src/types/groupDetailsPropTypes';

const RegisterGroup = ({ close, cancel, setTitle, addPlantToGroup }) => {
    // Either "form", "loading", or "success"
    const [modalContents, setModalContents] = useState("form");

    // Update title when contents change
    useLayoutEffect(() => setTitle(
        modalContents ===  "success" ? "Group created!" : "Create new group"
    ), [modalContents]);

    // If group registered successfully make second request to add plant to new
    // group, show success screen (or go back to form if unable to add plant)
    const onSuccess = async (data) => {
        const result = await addPlantToGroup(data.uuid);
        setModalContents(result ? "success" : "form");
    };

    // If group registration failed show error modal and go back to form
    const onError = (data) => {
        openErrorModal(JSON.stringify(data));
        setModalContents("form");
    };

    return (
        <div className="flex flex-col w-full max-w-88 min-h-94 mx-auto">
            {modalContents === "form" && (
                <FormModal
                    close={cancel}
                    FormComponent={GroupDetailsForm}
                    initialValues={{}}
                    endpoint="/register_group"
                    payload={{uuid: uuidv4()}}
                    onSubmit={() => setModalContents("loading")}
                    onSuccess={onSuccess}
                    onError={onError}
                    submitButtonText="Create"
                />
            )}
            {modalContents === "loading" && (
                <LoadingAnimation className="mx-auto mt-28" />
            )}
            {modalContents === "success" && (
                <>
                    <div className="flex flex-col my-auto items-center gap-8">
                        <span className="mt-2 md:mt-5">
                            Your plant has been added to the new group!
                        </span>
                        <Checkmark className="w-16" />
                        <span>
                            You can access the group from the plant details
                            dropdown or overview page.
                        </span>
                    </div>
                    <div className="modal-action">
                        <button className="btn btn-accent" onClick={close}>
                            OK
                        </button>
                    </div>
                </>
            )}
        </div>
    );
};

RegisterGroup.propTypes = {
    close: PropTypes.func.isRequired,
    cancel: PropTypes.func.isRequired,
    setTitle: PropTypes.func.isRequired,
    addPlantToGroup: PropTypes.func.isRequired
};

const Options = ({ options, setTitle, close }) => {
    const dispatch = useDispatch();
    const plantID = useSelector((state) => state.plant.plantDetails.uuid);
    // Replaces options with registration form if true
    const [showGroupForm, setShowGroupForm] = useState(false);

    // Set correct title when loaded
    useLayoutEffect(() => {
        !showGroupForm && setTitle("Add plant to group");
    }, [showGroupForm]);

    // Makes /add_plant_to_group, returns true if successful false if failed
    const addPlantToGroup = async (groupID) => {
        const payload = { plant_id: plantID, group_id: groupID };
        // Update plant state with group name and UUID from response
        const onSuccess = (data) => dispatch(plantAddedToGroup({
            name: data.group_name,
            uuid: data.group_uuid
        }));
        return await sendPostRequest('/add_plant_to_group', payload, onSuccess);
    };

    // Makes /add_plant_to_group request and closes modal when option clicked
    const handleClickOption = async (groupID) => {
        await addPlantToGroup(groupID);
        close();
    };

    // Render registration form if user clicked "Create new group"
    if (showGroupForm) {
        return (
            <RegisterGroup
                close={close}
                cancel={() => setShowGroupForm(false)}
                setTitle={setTitle}
                addPlantToGroup={addPlantToGroup}
            />
        );
    }

    // Render existing options (default)
    return (
        <div className="flex flex-col items-center px-4 overflow-y-auto">
            {Object.entries(options).map(([uuid, group]) => (
                <div
                    key={uuid}
                    className="flex relative w-full max-w-80 mx-auto mb-4"
                >
                    <GroupCard key={uuid} {...group} />
                    {/* Cover card with transparent div with listener */}
                    <div
                        className="absolute h-full w-full cursor-pointer"
                        onClick={() => handleClickOption(uuid)}
                    ></div>
                </div>
            ))}
            {!Object.keys(options).length && (
                <div className="flex flex-col h-36 pb-4 justify-center gap-4">
                    <span>No groups</span>
                </div>
            )}
            <button
                className="btn btn-accent"
                onClick={() => setShowGroupForm(true)}
            >
                <FaPlus className="size-5 mr-1" /> Create new group
            </button>
        </div>
    );
};

Options.propTypes = {
    options: PropTypes.objectOf(groupDetailsProptypes).isRequired,
    setTitle: PropTypes.func.isRequired,
    close: PropTypes.func.isRequired
};

const GroupModal = ({ close, setTitle }) => {
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
    useEffect(() => {loadOptions();}, []);

    return options ? (
        <Options options={options} setTitle={setTitle} close={close} />
    ) : (
        <LoadingAnimation className="mx-auto my-8" />
    );
};

GroupModal.propTypes = {
    close: PropTypes.func.isRequired,
    setTitle: PropTypes.func.isRequired
};

export default GroupModal;
