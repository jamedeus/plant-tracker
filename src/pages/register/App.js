import React, { useState, useRef, useEffect, memo, useMemo } from 'react';
import PropTypes from 'prop-types';
import clsx from 'clsx';
import { Tab } from '@headlessui/react';
import Navbar from 'src/components/Navbar';
import NavbarDropdownOptions from 'src/components/NavbarDropdownOptions';
import { sendPostRequest, parseDomContext } from 'src/util';
import GroupDetailsForm from 'src/components/GroupDetailsForm';
import PlantDetailsForm from 'src/components/PlantDetailsForm';
import { openErrorModal } from 'src/components/ErrorModal';
import { FaXmark, FaCheck } from 'react-icons/fa6';

const Form = memo(function Form({ setVisibleForm, plantFormRef, groupFormRef, showTabs }) {
    return (
        <Tab.Group onChange={(index) => setVisibleForm(index)}>
            {showTabs &&
                <Tab.List className="tab-group">
                    <Tab className={({ selected }) => clsx(
                        'tab-option',
                        selected && 'tab-option-selected'
                    )}>
                        Plant
                    </Tab>
                    <Tab className={({ selected }) => clsx(
                        'tab-option',
                        selected && 'tab-option-selected'
                    )}>
                        Group
                    </Tab>
                </Tab.List>
            }

            <Tab.Panels className="my-4 md:my-8">
                <Tab.Panel>
                    <PlantDetailsForm
                        formRef={plantFormRef}
                        name=""
                        species=""
                        pot_size=""
                        description=""
                    />
                </Tab.Panel>
                <Tab.Panel>
                    <GroupDetailsForm
                        formRef={groupFormRef}
                    />
                </Tab.Panel>
            </Tab.Panels>
        </Tab.Group>
    );
});

Form.propTypes = {
    setVisibleForm: PropTypes.func.isRequired,
    plantFormRef: PropTypes.oneOfType([
        PropTypes.func,
        PropTypes.shape({ current: PropTypes.instanceOf(Element) }),
    ]).isRequired,
    groupFormRef: PropTypes.oneOfType([
        PropTypes.func,
        PropTypes.shape({ current: PropTypes.instanceOf(Element) }),
    ]).isRequired,
    showTabs: PropTypes.bool.isRequired
};

const ConfirmDividingFrom = ({ plantDetails, handleConfirm, handleReject }) => {
    return (
        <div className="flex flex-col full-screen justify-center text-center gap-8 px-4">
            <p className="text-lg font-bold mt-auto mb-8">
                Was this plant divided from {plantDetails.display_name}?
            </p>
            {plantDetails.thumbnail && (
                <div className="mx-auto p-4 bg-base-200 rounded-3xl">
                    <img
                        className="max-h-[50vh] rounded-xl object-contain"
                        src={plantDetails.thumbnail}
                        alt={`${plantDetails.display_name} image`}
                        draggable={false}
                    />
                </div>
            )}

            {/* Confirm/cancel buttons */}
            <div className="flex gap-4 mx-auto mt-8 mb-auto">
                <button
                    className="btn h-12 btn-error btn-square text-white"
                    onClick={handleReject}
                    title="Plant was NOT divided"
                >
                    <FaXmark className="size-6" />
                </button>
                <button
                    className="btn h-12 btn-success btn-square text-white"
                    onClick={handleConfirm}
                    title="Plant was divided"
                >
                    <FaCheck className="size-6" />
                </button>
            </div>
        </div>
    );
};

ConfirmDividingFrom.propTypes = {
    plantDetails: PropTypes.object.isRequired,
    handleConfirm: PropTypes.func.isRequired,
    handleReject: PropTypes.func.isRequired
};

function App() {
    // Load context set by django template
    const newID = parseDomContext("new_id");
    const dividingFrom = parseDomContext("dividing_from");

    const [showConfirm, setShowConfirm] = useState(dividingFrom ? true : false);
    const [showTabs, setShowTabs] = useState(dividingFrom ? false : true);

    // Reload if user navigates to page by pressing back button (uuid may now
    // be registered, refresh will replace with manage plant/group page if so)
    useEffect(() => {
        const handleBackButton = async (event) => {
            if (event.persisted) {
                window.location.reload();
            }
        };

        // Add listener on mount, remove on unmount
        window.addEventListener('pageshow', handleBackButton);
        return () => {
            window.removeEventListener('pageshow', handleBackButton);
        };
    }, []);

    // Track visible form (changed by tabs, used to get correct endpoint)
    // Set to 0 for plant form, 1 for group form
    const [visibleForm, setVisibleForm] = useState(0);

    const plantFormRef = useRef(null);
    const groupFormRef = useRef(null);

    // Disable save button if form invalid (field exceeded length limit)
    const [formIsValid, setFormIsValid] = useState(true);
    const onInput = () => {
        const form = visibleForm === 0 ? plantFormRef : groupFormRef;
        setFormIsValid(form.current.checkValidity());
    };

    // Change form and re-enable save button (fields clear when form changes)
    const handleFormChange = (index) => {
        setVisibleForm(index);
        setFormIsValid(true);
    };

    const submit = async () => {
        // Parse all fields from visible form, set correct endpoint
        let payload, endpoint;
        if (visibleForm === 0) {
            payload = Object.fromEntries(
                new FormData(plantFormRef.current)
            );
            endpoint = '/register_plant';
        } else {
            payload = Object.fromEntries(
                new FormData(groupFormRef.current)
            );
            endpoint = '/register_group';
        }

        // If dividing from existing plant and confirmed new plant was divided:
        // add database keys from context (creates database relations between
        // new plant, parent plant, and division event)
        if (dividingFrom && !showTabs) {
            payload.divided_from_id = dividingFrom.plant_key;
            payload.divided_from_event_id = dividingFrom.event_key;
        }

        // Add UUID, post to backend
        payload.uuid = newID;
        const response = await sendPostRequest(endpoint, payload);
        // Show error modal if registration failed
        if (!response.ok) {
            const data = await response.json();
            openErrorModal(data.error);
        // Redirect to manage page if successfully registered
        } else if (response.redirected) {
            window.location.href = response.url;
        } else {
            const responseData = await response.json();
            openErrorModal(responseData);
        }
    };

    // Top left corner dropdown options
    const DropdownMenuOptions = useMemo(() => <NavbarDropdownOptions />, []);

    return (
        <div className="container flex flex-col mx-auto items-center mb-8">
            <Navbar
                menuOptions={DropdownMenuOptions}
                title='Registration'
            />

            <div
                className="flex flex-col w-96 max-w-[100vw] px-4"
                onInput={onInput}
            >
                {showConfirm ? (
                    <ConfirmDividingFrom
                        plantDetails={dividingFrom.plant_details}
                        handleConfirm={() => setShowConfirm(false)}
                        handleReject={() => {
                            setShowTabs(true);
                            setShowConfirm(false);
                        }}
                    />
                ) : (
                    <>
                        <Form
                            setVisibleForm={handleFormChange}
                            plantFormRef={plantFormRef}
                            groupFormRef={groupFormRef}
                            showTabs={showTabs}
                        />

                        <button
                            className="btn btn-accent mx-auto"
                            disabled={!formIsValid}
                            onClick={submit}
                        >
                            Save
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}

export default App;
