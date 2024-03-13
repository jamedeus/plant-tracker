import React, { useState, useRef } from 'react';
import { Tab } from '@headlessui/react';
import Navbar from 'src/components/Navbar';
import { useTheme } from 'src/ThemeContext';
import { sendPostRequest, parseDomContext } from 'src/util';
import TrayDetailsForm from 'src/forms/TrayDetailsForm';
import PlantDetailsForm from 'src/forms/PlantDetailsForm';
import Modal from 'src/components/Modal';

function App() {
    // Load context set by django template
    const newID = parseDomContext("new_id");
    const speciesOptions = parseDomContext("species_options");

    const overview = () => {
        window.location.href = "/";
    };

    // Track visible form (changed by tabs, used to get correct endpoint)
    // Set to 0 for plant form, 1 for tray form
    const [plantForm, setPlantForm] = useState(0);

    // Get toggle theme option from context
    const { ToggleThemeOption } = useTheme();

    const errorModalRef = useRef(null);
    const [errorModalMessage, setErrorModalMessage] = useState('');

    const submit = async () => {
        // Parse all fields from visible form, add type param
        let payload;
        if (plantForm === 0) {
            payload = Object.fromEntries(
                new FormData(document.getElementById('plantDetails'))
            );
            payload.type = 'plant';
        } else {
            payload = Object.fromEntries(
                new FormData(document.getElementById('trayDetails'))
            );
            payload.type = 'tray';
        }

        // Add UUID, post to backend
        payload.uuid = newID;
        const response = await sendPostRequest('/register', payload);
        // Show error modal if registration failed
        if (!response.ok) {
            const data = await response.json();
            setErrorModalMessage(data.error);
            errorModalRef.current.showModal();
        // Redirect to manage page if successfully registered
        } else if (response.redirected) {
            window.location.href = response.url;
        } else {
            const responseData = await response.json();
            console.log(responseData);
        }
    };

    return (
        <div className="container flex flex-col mx-auto mb-8">
            <Navbar
                dropdownOptions={
                    <>
                        <li><a onClick={overview}>Overview</a></li>
                        <ToggleThemeOption />
                    </>
                }
                title={
                    <a className="btn btn-ghost text-3xl">Registration</a>
                }
            />

            <div className="flex flex-col mx-8 md:w-1/2 md:mx-auto">
                <Tab.Group onChange={(index) => setPlantForm(index)}>
                    <Tab.List className="tab-group">
                        <Tab className={({ selected }) =>
                            `tab-option ${
                                selected ? 'bg-teal-600' : ''
                            }`
                        }>
                            Plant
                        </Tab>
                        <Tab className={({ selected }) =>
                            `tab-option ${
                                selected ? 'bg-teal-600' : ''
                            }`
                        }>
                            Tray
                        </Tab>
                    </Tab.List>

                    <Tab.Panels className="my-8">
                        <Tab.Panel>
                            <PlantDetailsForm
                                name=""
                                species=""
                                pot_size=""
                                description=""
                                species_options={speciesOptions}
                            />
                        </Tab.Panel>
                        <Tab.Panel>
                            <TrayDetailsForm />
                        </Tab.Panel>
                    </Tab.Panels>
                </Tab.Group>

                <button className="btn btn-accent mx-auto" onClick={submit}>
                    Save
                </button>
            </div>

            <Modal dialogRef={errorModalRef}>
                <h3 className="font-bold text-lg">Error</h3>
                <p className="text-center mt-8 mb-4">{errorModalMessage}</p>
                <div className="modal-action mx-auto">
                    <form method="dialog">
                        <button className="btn">OK</button>
                    </form>
                </div>
            </Modal>
        </div>
    );
}

export default App;
