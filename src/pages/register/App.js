import React, { useState, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import PropTypes from 'prop-types';
import clsx from 'clsx';
import { Tab } from '@headlessui/react';
import Navbar from 'src/components/Navbar';
import NavbarDropdownOptions from 'src/components/NavbarDropdownOptions';
import sendPostRequest from 'src/utils/sendPostRequest';
import GroupDetailsForm from 'src/components/GroupDetailsForm';
import PlantDetailsForm from 'src/components/PlantDetailsForm';
import QrScannerButton from 'src/components/QrScannerButton';
import { openErrorModal } from 'src/components/ErrorModal';
import 'src/css/index.css';
import uuidPropType from 'src/types/uuidPropType';

function App({ initialState }) {
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

    // Used to change page after successful registration
    const navigate = useNavigate();

    const handleRegister = async () => {
        // Build payload by parsing all fields from visible form
        const payload = {
            uuid: initialState.new_id,
            ...Object.fromEntries(new FormData(
                visibleForm === 0 ? plantFormRef.current : groupFormRef.current
            ))
        };

        const endpoint = visibleForm === 0 ? '/register_plant' : '/register_group';
        const response = await sendPostRequest(endpoint, payload);
        // Reload route (switch to manage page) if successful
        if (response.ok) {
            navigate(window.location.pathname);
        // Show error modal if registration failed
        } else {
            const data = await response.json();
            openErrorModal(data.error);
        }
    };

    // Top left corner dropdown options
    const DropdownMenuOptions = useMemo(() => <NavbarDropdownOptions />, []);

    return (
        <div
            className="container flex flex-col mx-auto items-center"
            data-testid="register-layout"
        >
            <Navbar
                menuOptions={DropdownMenuOptions}
                title='Registration'
                topRightButton={<QrScannerButton />}
            />

            <div
                className="flex flex-col w-96 max-w-[100vw] px-4 mb-8"
                onInput={onInput}
            >
                <Tab.Group
                    selectedIndex={visibleForm}
                    onChange={(index) => handleFormChange(index)}
                >
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

                    <Tab.Panels className="my-4 md:my-8">
                        <Tab.Panel>
                            <PlantDetailsForm formRef={plantFormRef} />
                        </Tab.Panel>
                        <Tab.Panel>
                            <GroupDetailsForm formRef={groupFormRef} />
                        </Tab.Panel>
                    </Tab.Panels>
                </Tab.Group>

                <button
                    className="btn btn-accent mx-auto"
                    disabled={!formIsValid}
                    onClick={handleRegister}
                >
                    Save
                </button>
            </div>
        </div>
    );
}

App.propTypes = {
    initialState: PropTypes.shape({
        new_id: uuidPropType.isRequired
    }).isRequired
};

export default App;
