import React, { useState, useEffect, useRef } from 'react';
import { Tab } from '@headlessui/react'
import Navbar from 'src/components/Navbar';
import { sendPostRequest, parseDomContext } from 'src/util';
import TrayDetails from 'src/forms/TrayDetails';
import PlantDetails from 'src/forms/PlantDetails';

function App() {
    // Load context set by django template
    const [newID, setNewID] = useState(() => {
        return parseDomContext("new_id");
    });
    const [speciesOptions, setSpeciesOptions] = useState(() => {
        return parseDomContext("species_options");
    });

    const overview = () => {
        window.location.href = "/";
    }

    // Track visible form (changed by tabs, used to get correct endpoint)
    // Set to 0 for plant form, 1 for tray form
    const [plantForm, setPlantForm] = useState(0);

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
        const response = await sendPostRequest('/register', payload)
        if (!response.ok) {
            throw new Error('Network response error');
        } else if (response.redirected) {
            window.location.href = response.url;
        } else {
            const responseData = await response.json();
            console.log(responseData);
        }
    }

    return (
        <div className="container flex flex-col mx-auto mb-8">
            <Navbar
                dropdownOptions={
                    <li><a onClick={overview}>Overview</a></li>
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
                            <PlantDetails
                                name=""
                                species=""
                                pot_size=""
                                description=""
                                species_options={speciesOptions}
                            />
                        </Tab.Panel>
                        <Tab.Panel>
                            <TrayDetails />
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
