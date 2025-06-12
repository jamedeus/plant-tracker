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
import { DateTime } from 'luxon';

const Form = memo(function Form({ setVisibleForm, plantFormRef, groupFormRef, showTabs, defaultValues }) {
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
                        name={defaultValues.name || ""}
                        species={defaultValues.species || ""}
                        pot_size={defaultValues.pot_size || ""}
                        description={defaultValues.description || ""}
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
    showTabs: PropTypes.bool.isRequired,
    defaultValues: PropTypes.object.isRequired
};

const ConfirmPrompt = ({
    prompt,
    photo,
    photoAltText,
    handleConfirm,
    handleReject,
    confirmButtonTitle,
    rejectButtonTitle
}) => {
    return (
        <div className="flex flex-col full-screen justify-center text-center gap-8 px-4">
            <p className="text-lg font-bold mt-auto mb-8">
                {prompt}
            </p>
            {photo && (
                <div className="mx-auto p-4 bg-base-200 rounded-3xl">
                    <img
                        className="max-h-[50vh] rounded-xl object-contain"
                        src={photo}
                        alt={photoAltText}
                        draggable={false}
                    />
                </div>
            )}

            {/* Confirm/cancel buttons */}
            <div className="flex gap-4 mx-auto mt-8 mb-auto">
                <button
                    className="btn h-12 btn-error btn-square text-white"
                    onClick={handleReject}
                    title={rejectButtonTitle}
                >
                    <FaXmark className="size-6" />
                </button>
                <button
                    className="btn h-12 btn-success btn-square text-white"
                    onClick={handleConfirm}
                    title={confirmButtonTitle}
                >
                    <FaCheck className="size-6" />
                </button>
            </div>
        </div>
    );
};

ConfirmPrompt.propTypes = {
    prompt: PropTypes.string.isRequired,
    photo: PropTypes.string,
    photoAltText: PropTypes.string,
    handleConfirm: PropTypes.func.isRequired,
    handleReject: PropTypes.func.isRequired,
    confirmButtonTitle: PropTypes.string.isRequired,
    rejectButtonTitle: PropTypes.string.isRequired
};

function App() {
    // Load context set by django template
    const newID = parseDomContext("new_id");
    const dividingFrom = parseDomContext("dividing_from");
    const changingQrCode = parseDomContext("changing_qr_code");

    // Default form values (only used when dividing existing plant)
    const defaultValues = useMemo(() => {
        if (dividingFrom) {
            const parentName = dividingFrom.plant_details.display_name;
            const today = DateTime.now().toFormat('MMMM d, yyyy');
            return {
                name: `${dividingFrom.plant_details.display_name} prop`,
                species: dividingFrom.plant_details.species,
                pot_size: dividingFrom.plant_details.pot_size,
                description: `Divided from ${parentName} on ${today}`,
            };
        } else {
            // No defaults if registering new plant with no parent
            return {};
        }
    }, []);

    // Show confirmation screen if changing QR code for existing plant
    const [showConfirmQr, setShowConfirmQr] = useState(changingQrCode ? true : false);
    // Show confirmation screen if dividing from existing plant
    const [showConfirmDivide, setShowConfirmDivide] = useState(dividingFrom ? true : false);
    // Tracks user response at confirmation screen
    const [confirmedDividing, setConfirmedDividing] = useState(false);

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

    const handleRegister = async () => {
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
        if (dividingFrom && confirmedDividing) {
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

    const handleConfirmNewQrCode = async () => {
        const response = await sendPostRequest(
            '/change_uuid',
            {
                uuid: changingQrCode.instance.uuid,
                new_id: changingQrCode.new_uuid
            }
        );
        // Reload page if changed successfully
        if (response.ok) {
            window.location.reload();
        } else {
            const error = await response.json();
            openErrorModal(JSON.stringify(error));
        }
    };

    // Top left corner dropdown options
    const DropdownMenuOptions = useMemo(() => <NavbarDropdownOptions />, []);

    return (
        <div className="container flex flex-col mx-auto items-center">
            <Navbar
                menuOptions={DropdownMenuOptions}
                title='Registration'
            />

            {(() => {
                if (showConfirmQr) {
                    return (
                        <ConfirmPrompt
                            prompt={`Is this the new QR code for your ${changingQrCode.type}?`}
                            photo={changingQrCode.preview}
                            photoAltText={`${changingQrCode.instance.display_name} photo`}
                            handleConfirm={handleConfirmNewQrCode}
                            handleReject={() => setShowConfirmQr(false)}
                            confirmButtonTitle={"Change QR code"}
                            rejectButtonTitle={"Don't change QR code"}
                        />
                    );

                } else if (showConfirmDivide) {
                    return (
                        <ConfirmPrompt
                            prompt={`Was this plant divided from ${dividingFrom.plant_details.display_name}?`}
                            photo={dividingFrom.default_photo.preview}
                            photoAltText={`${dividingFrom.plant_details.display_name} photo`}
                            handleConfirm={() => {
                                setShowConfirmDivide(false);
                                setConfirmedDividing(true);
                            }}
                            handleReject={() => {
                                setShowConfirmDivide(false);
                                setConfirmedDividing(false);
                            }}
                            confirmButtonTitle={"Plant was divided"}
                            rejectButtonTitle={"Plant was NOT divided"}
                        />
                    );

                } else {
                    return (
                        <div
                            className="flex flex-col w-96 max-w-[100vw] px-4 mb-8"
                            onInput={onInput}
                        >
                            <Form
                                setVisibleForm={handleFormChange}
                                plantFormRef={plantFormRef}
                                groupFormRef={groupFormRef}
                                showTabs={confirmedDividing ? false : true}
                                defaultValues={confirmedDividing ? defaultValues : {}}
                            />

                            <button
                                className="btn btn-accent mx-auto"
                                disabled={!formIsValid}
                                onClick={handleRegister}
                            >
                                Save
                            </button>
                        </div>
                    );
                }
            })()}
        </div>
    );
}

export default App;
