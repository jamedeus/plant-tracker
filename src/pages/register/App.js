import React, { useState, useRef, memo, useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';
import clsx from 'clsx';
import { Tab } from '@headlessui/react';
import Navbar from 'src/components/Navbar';
import NavbarDropdownOptions from 'src/components/NavbarDropdownOptions';
import { sendPostRequest } from 'src/util';
import GroupDetailsForm from 'src/components/GroupDetailsForm';
import PlantDetailsForm from 'src/components/PlantDetailsForm';
import QrScannerButton from 'src/components/QrScannerButton';
import { openErrorModal } from 'src/components/ErrorModal';
import { FaXmark, FaCheck } from 'react-icons/fa6';
import { DateTime } from 'luxon';
import DetailsCard from './DetailsCard';
import router from 'src/spa/routes';
import 'src/css/index.css';

const Form = memo(function Form({
    visibleForm,
    setVisibleForm,
    plantFormRef,
    groupFormRef,
    showTabs,
    defaultValues
}) {
    return (
        <Tab.Group
            selectedIndex={visibleForm}
            onChange={(index) => setVisibleForm(index)}
        >
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
    visibleForm: PropTypes.number.isRequired,
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
    name,
    photo,
    type,
    detailsParams,
    handleConfirm,
    handleReject,
    confirmButtonTitle,
    rejectButtonTitle
}) => {
    return (
        <div className="flex flex-col text-center gap-4 px-4 mt-2 mb-4">
            <p className="text-lg md:text-xl font-bold">
                {prompt}
            </p>
            <DetailsCard
                name={name}
                photo={photo}
                type={type}
                detailsParams={detailsParams}
            />

            {/* Confirm/cancel buttons */}
            <div className="flex gap-4 mx-auto">
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
    name: PropTypes.string.isRequired,
    photo: PropTypes.string,
    type: PropTypes.oneOf([
        "plant",
        "group"
    ]).isRequired,
    detailsParams: PropTypes.object.isRequired,
    handleConfirm: PropTypes.func.isRequired,
    handleReject: PropTypes.func.isRequired,
    confirmButtonTitle: PropTypes.string.isRequired,
    rejectButtonTitle: PropTypes.string.isRequired
};

function App({ initialState }) {
    // Initialize entirely from SPA-provided state
    const newID = initialState.new_id;
    const dividingFrom = initialState.dividing_from;
    const changingQrCode = initialState.changing_qr_code;

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

    // Track visible form (changed by tabs), 0 for plant form, 1 for group form
    // Set initially visible form based on querystring if present
    const [visibleForm, setVisibleForm] = useState(() => {
        const params = new URL(window.location.href).searchParams;
        return params.get('type') === 'group' ? 1 : 0;
    });
    // Refs used to read FormData
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
        // Build payload by parsing all fields from visible form
        const payload = {
            uuid: newID,
            ...Object.fromEntries(new FormData(
                visibleForm === 0 ? plantFormRef.current : groupFormRef.current
            ))
        };

        // If dividing from existing plant and confirmed new plant was divided:
        // add database keys from context (creates database relations between
        // new plant, parent plant, and division event)
        if (dividingFrom && confirmedDividing) {
            payload.divided_from_id = dividingFrom.plant_key;
            payload.divided_from_event_id = dividingFrom.event_key;
        }

        const endpoint = visibleForm === 0 ? '/register_plant' : '/register_group';
        const response = await sendPostRequest(endpoint, payload);
        // Reload route (switch to manage page) if successful
        if (response.ok) {
            router.navigate(window.location.pathname);
        // Show error modal if registration failed
        } else {
            const data = await response.json();
            openErrorModal(data.error);
        }
    };

    // Makes /change_uuid call to confirm new QR code, reloads if successful
    const handleAcceptNewQrCode = useCallback(async () => {
        const response = await sendPostRequest('/change_uuid', {
            uuid: changingQrCode.instance.uuid,
            new_id: changingQrCode.new_uuid
        });
        // Reload route (switch to manage page) if successful
        if (response.ok) {
            router.navigate(window.location.pathname);
        } else {
            const error = await response.json();
            openErrorModal(JSON.stringify(error));
        }
    });

    // Hides confirm new QR code prompt, shows registration form
    const handleRejectNewQrCode = useCallback(async () => {
        setShowConfirmQr(false);
    });

    // Hides division prompt, shows registration form with pre-filled fields
    const handleAcceptDivision = useCallback(async () => {
        setShowConfirmDivide(false);
        setConfirmedDividing(true);
    });

    // Hides division prompt, shows blank registration form
    const handleRejectDivision = useCallback(async () => {
        setShowConfirmDivide(false);
        setConfirmedDividing(false);
    });

    // Set params for confirmation prompt if either showConfirm state is true
    const confirmPromptParams = useMemo(() => {
        if (showConfirmQr) {
            return {
                prompt: `Is this the new QR code for your ${changingQrCode.type}?`,
                name: changingQrCode.instance.display_name,
                photo: changingQrCode.preview,
                type: changingQrCode.type,
                detailsParams: changingQrCode.instance,
                handleConfirm: handleAcceptNewQrCode,
                handleReject: handleRejectNewQrCode,
                confirmButtonTitle: "Change QR code",
                rejectButtonTitle: "Don't change QR code"
            };
        } else if (showConfirmDivide) {
            const parentPlantName = dividingFrom.plant_details.display_name;
            return {
                prompt: `Was this plant divided from ${parentPlantName}?`,
                name: parentPlantName,
                photo: dividingFrom.default_photo.preview,
                type: "plant",
                detailsParams: dividingFrom.plant_details,
                handleConfirm: handleAcceptDivision,
                handleReject: handleRejectDivision,
                confirmButtonTitle: "Plant was divided",
                rejectButtonTitle: "Plant was NOT divided"
            };
        }
    }, [showConfirmQr, showConfirmDivide]);

    // Top left corner dropdown options
    const DropdownMenuOptions = useMemo(() => <NavbarDropdownOptions />, []);

    return (
        <div className="container flex flex-col mx-auto items-center">
            <Navbar
                menuOptions={DropdownMenuOptions}
                title='Registration'
                topRightButton={<QrScannerButton />}
            />

            {showConfirmQr || showConfirmDivide ? (
                <ConfirmPrompt { ...confirmPromptParams } />
            ) : (
                <div
                    className="flex flex-col w-96 max-w-[100vw] px-4 mb-8"
                    onInput={onInput}
                >
                    <Form
                        visibleForm={visibleForm}
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
            )}
        </div>
    );
}

App.propTypes = {
    initialState: PropTypes.object
};

export default App;
