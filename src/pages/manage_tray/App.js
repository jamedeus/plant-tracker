import React, { useState, useEffect, useRef } from 'react';
import { DateTime } from 'luxon';
import { sendPostRequest, parseDomContext, localToUTC, timestampToRelative } from 'src/util';
import CollapseCol from 'src/components/CollapseCol';
import EditableNodeList from 'src/components/EditableNodeList';
import EditModal from 'src/components/EditModal';
import TrayDetails from 'src/forms/TrayDetails';
import Navbar from 'src/components/Navbar';
import PlantCard from 'src/components/PlantCard';

function App() {
    // Load context set by django template
    const [tray, setTray] = useState(() => {
        return parseDomContext("tray");
    });
    const [plantIds, setPlantIds] = useState(() => {
        return parseDomContext("plant_ids");
    });
    const [plantDetails, setPlantDetails] = useState(() => {
        return parseDomContext("details");
    });
    const [options, setOptions] = useState(() => {
        return parseDomContext("options");
    });

    // Create state to track whether selecting plants from list
    const [selectingPlants, setSelectingPlants] = useState(false);

    // Track which plants are selected
    const selectedPlants = useRef([]);

    const overview = () => {
        window.location.href = "/";
    }

    const openEditModal = () => {
        document.getElementById('editModal').showModal();
    }

    const submitEditModal = async () => {
        const payload = Object.fromEntries(new FormData(document.getElementById('trayDetails')));
        payload["tray_id"] = tray.uuid;
        console.log(payload);

        const response = await sendPostRequest('/edit_tray', payload);
        if (response.ok) {
            // Read new display name from response
            const data = await response.json();

            let oldTray = {...tray};
            oldTray.name = payload.name;
            oldTray.location = payload.location;
            oldTray.display_name = data.display_name;
            setTray(oldTray);
        }
    }

    // Shown in dropdown when name in nav bar clicked
    const DetailsCard = ({ location }) => {
        return (
            <div className="card card-compact p-2 shadow bg-neutral text-neutral-content mx-auto mt-2">
                <div className="card-body">
                    <p>Location: {location}</p>
                    <button className="btn btn-sm mt-4" onClick={openEditModal}>Edit</button>
                </div>
            </div>
        )
    }

    const ManagePlantsButtons = ({editing, setEditing, handleDelete}) => {
        switch(editing) {
            case(true):
                return (
                    <div className="flex">
                        <button className="btn btn-sm btn-outline mx-auto" onClick={() => setEditing(false)}>
                            Cancel
                        </button>
                        <button className="btn btn-sm btn-outline btn-info mx-auto" onClick={() => handleDelete()}>
                            Water
                        </button>
                        <button className="btn btn-sm btn-outline btn-success mx-auto" onClick={() => handleDelete()}>
                            Fertilize
                        </button>
                        <button className="btn btn-sm btn-outline btn-error mx-auto" onClick={() => handleDelete()}>
                            Delete
                        </button>
                    </div>
                )
            case(false):
                return (
                    <div className="flex">
                        <button className="btn btn-outline mx-auto" onClick={() => setEditing(true)}>
                            Edit
                        </button>
                    </div>
                )
        }
    }

    return (
        <div className="container flex flex-col mx-auto">
            <Navbar
                dropdownOptions={
                    <li><a onClick={overview}>Overview</a></li>
                }
                title={
                    <div className="dropdown">
                        <a tabIndex={0} role="button" className="btn btn-ghost text-3xl">{tray.display_name}</a>
                        <div tabIndex={0} className="dropdown-content z-[1] flex w-full">
                            <DetailsCard location={tray.location} />
                        </div>
                    </div>
                }
            />

            <CollapseCol title="Plants" defaultOpen={true}>
                <EditableNodeList editing={selectingPlants} selected={selectedPlants}>
                    {plantDetails.map((plant) => {
                        return <PlantCard key={plant.uuid} name={plant.name} uuid={plant.uuid} />
                    })}
                </EditableNodeList>
                <ManagePlantsButtons
                    editing={selectingPlants}
                    setEditing={setSelectingPlants}
                    handleDelete={() => console.log('delete')}
                />
            </CollapseCol>

            <EditModal title="Edit Details" onSubmit={submitEditModal}>
                <TrayDetails
                    name={tray.name}
                    location={tray.location}
                />
            </EditModal>

        </div>
    )
};

export default App;
