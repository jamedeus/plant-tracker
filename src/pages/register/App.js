import React, { useState, useRef } from 'react';
import { Tab } from '@headlessui/react';
import Navbar from 'src/components/Navbar';
import { useTheme } from 'src/context/ThemeContext';
import { sendPostRequest, parseDomContext } from 'src/util';
import GroupDetailsForm from 'src/forms/GroupDetailsForm';
import PlantDetailsForm from 'src/forms/PlantDetailsForm';
import { useErrorModal } from 'src/context/ErrorModalContext';

function App() {
    // Load context set by django template
    const newID = parseDomContext("new_id");

    const overview = () => {
        window.location.href = "/";
    };

    // Track visible form (changed by tabs, used to get correct endpoint)
    // Set to 0 for plant form, 1 for group form
    const [plantForm, setPlantForm] = useState(0);

    // Get toggle theme option from context
    const { ToggleThemeOption } = useTheme();

    // Get hook to show error modal
    const { showErrorModal } = useErrorModal();

    const plantDetailsRef = useRef(null);
    const groupDetailsRef = useRef(null);

    const submit = async () => {
        // Parse all fields from visible form, set correct endpoint
        let payload, endpoint;
        if (plantForm === 0) {
            payload = Object.fromEntries(
                new FormData(plantDetailsRef.current)
            );
            endpoint = '/register_plant';
        } else {
            payload = Object.fromEntries(
                new FormData(groupDetailsRef.current)
            );
            endpoint = '/register_group';
        }

        // Add UUID, post to backend
        payload.uuid = newID;
        const response = await sendPostRequest(endpoint, payload);
        // Show error modal if registration failed
        if (!response.ok) {
            const data = await response.json();
            showErrorModal(data.error);
        // Redirect to manage page if successfully registered
        } else if (response.redirected) {
            window.location.href = response.url;
        } else {
            const responseData = await response.json();
            showErrorModal(responseData);
        }
    };

    return (
        <div className="container flex flex-col mx-auto mb-8">
            <Navbar
                menuOptions={
                    <>
                        <li><a onClick={overview}>Overview</a></li>
                        <ToggleThemeOption />
                    </>
                }
                title={"Registration"}
            />

            <div className="flex flex-col mx-8 md:w-1/2 md:mx-auto">
                <Tab.Group onChange={(index) => setPlantForm(index)}>
                    <Tab.List className="tab-group">
                        <Tab className={({ selected }) =>
                            `tab-option ${
                                selected ? 'tab-option-selected' : ''
                            }`
                        }>
                            Plant
                        </Tab>
                        <Tab className={({ selected }) =>
                            `tab-option ${
                                selected ? 'tab-option-selected' : ''
                            }`
                        }>
                            Group
                        </Tab>
                    </Tab.List>

                    <Tab.Panels className="my-8">
                        <Tab.Panel>
                            <PlantDetailsForm
                                formRef={plantDetailsRef}
                                name=""
                                species=""
                                pot_size=""
                                description=""
                            />
                        </Tab.Panel>
                        <Tab.Panel>
                            <GroupDetailsForm
                                formRef={groupDetailsRef}
                            />
                        </Tab.Panel>
                    </Tab.Panels>
                </Tab.Group>

                <button className="btn btn-accent mx-auto" onClick={submit}>
                    Save
                </button>
            </div>
        </div>
    );
}

export default App;
