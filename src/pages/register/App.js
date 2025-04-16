import React, { useState, useRef, useEffect, memo, useMemo } from 'react';
import PropTypes from 'prop-types';
import clsx from 'clsx';
import { Tab } from '@headlessui/react';
import Navbar from 'src/components/Navbar';
import NavbarDropdownOptions from 'src/components/NavbarDropdownOptions';
import { sendPostRequest, parseDomContext } from 'src/util';
import GroupDetailsForm from 'src/forms/GroupDetailsForm';
import PlantDetailsForm from 'src/forms/PlantDetailsForm';
import { openErrorModal } from 'src/components/ErrorModal';

const Form = memo(function Form({ setVisibleForm, plantFormRef, groupFormRef }) {
    return (
        <Tab.Group onChange={(index) => setVisibleForm(index)}>
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

            <Tab.Panels className="my-8">
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
    ]).isRequired
};

function App() {
    // Load context set by django template
    const newID = parseDomContext("new_id");

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
        <div className="container flex flex-col mx-auto mb-8">
            <Navbar
                menuOptions={DropdownMenuOptions}
                title='Registration'
            />

            <div className="flex flex-col mx-8 md:w-1/2 md:mx-auto">
                <Form
                    setVisibleForm={setVisibleForm}
                    plantFormRef={plantFormRef}
                    groupFormRef={groupFormRef}
                />

                <button className="btn btn-accent mx-auto" onClick={submit}>
                    Save
                </button>
            </div>
        </div>
    );
}

export default App;
