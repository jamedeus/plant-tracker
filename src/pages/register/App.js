import React, { useState, useEffect, useRef } from 'react';
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

    // State object to track which form is visible
    const [plantForm, setPlantForm] = useState(true);

    const submit = async () => {
        // Parse all fields from visible form, add type param
        let payload;
        if (plantForm) {
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

    const Buttons = () => {
        switch(plantForm) {
            case(true):
                return (
                    <div className="mx-auto">
                        <button
                            className="btn btn-accent mr-2"
                            onClick={() => setPlantForm(true)}
                        >
                            Plant
                        </button>
                        <button
                            className="btn btn-accent btn-outline ml-2"
                            onClick={() => setPlantForm(false)}
                        >
                            Tray
                        </button>
                    </div>
                )
            case(false):
                return (
                    <div className="mx-auto">
                        <button
                            className="btn btn-accent btn-outline mr-2"
                            onClick={() => setPlantForm(true)}
                        >
                            Plant
                        </button>
                        <button
                            className="btn btn-accent ml-2"
                            onClick={() => setPlantForm(false)}
                        >
                            Tray
                        </button>
                    </div>
                )
        }
    }

    const Forms = () => {
        switch(plantForm) {
            case(true):
                return <PlantDetails species_options={speciesOptions} />
            case(false):
                return <TrayDetails />
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

            <div className="flex">
                <Buttons />
            </div>

            <div className="m-8 md:w-1/2 md:mx-auto">
                <Forms />
            </div>

            <div className="mx-auto">
                <button className="btn btn-accent" onClick={submit}>
                    Save
                </button>
            </div>
        </div>
    );
}

export default App;
