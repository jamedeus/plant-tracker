import React, { useState, useEffect, useRef } from 'react';
import { DateTime } from 'luxon';
import { sendPostRequest, parseDomContext, localToUTC, timestampToRelative } from 'src/util';
import CollapseCol from 'src/components/CollapseCol';
import EditableNodeList from 'src/components/EditableNodeList';
import EditModal from 'src/components/EditModal';
import PlantDetails from 'src/forms/PlantDetails';

function App() {
    // Load context set by django template
    const [plant, setPlant] = useState(() => {
        return parseDomContext("plant");
    });
    const [trays, setTrays] = useState(() => {
        return parseDomContext("trays");
    });
    const [speciesOptions, setSpeciesOptions] = useState(() => {
        return parseDomContext("species_options");
    });

    // Create states to track whether editing water and fertilize event lists
    const [editingWaterEvents, setEditingWaterEvents] = useState(false);
    const [editingFertilizeEvents, setEditingFertilizeEvents] = useState(false);

    // Track which water and fertilize events are selected when editing
    const selectedWaterEvents = useRef([]);
    const selectedFertilizeEvents = useRef([]);

    const overview = () => {
        window.location.href = "/";
    }

    const openEditModal = () => {
        document.getElementById('editModal').showModal();
    }

    const submitEditModal = async () => {
        const payload = Object.fromEntries(new FormData(document.getElementById('plantDetails')));
        payload["plant_id"] = plant.uuid;
        console.log(payload);

        const response = await sendPostRequest('/edit_plant', payload);
        if (response.ok) {
            // Read new display name from response
            const data = await response.json();

            let oldPlant = {...plant};
            oldPlant.name = payload.name;
            oldPlant.species = payload.species;
            oldPlant.pot_size = payload.pot_size;
            oldPlant.description = payload.description;
            oldPlant.display_name = data.display_name;
            setPlant(oldPlant);
        }
    }

    const waterPlant = async () => {
        const payload = {
            plant_id: plant.uuid,
            event_type: 'water',
            timestamp: localToUTC(document.getElementById("eventTime").value)
        }
        const response = await sendPostRequest('/add_plant_event', payload);
        if (response.ok) {
            let oldPlant = {...plant};
            oldPlant.last_watered = payload.timestamp;
            setPlant(oldPlant);
        }
    }

    const fertilizePlant = async () => {
        const payload = {
            plant_id: plant.uuid,
            event_type: 'fertilize',
            timestamp: localToUTC(document.getElementById("eventTime").value)
        }
        const response = await sendPostRequest('/add_plant_event', payload);
        if (response.ok) {
            let oldPlant = {...plant};
            oldPlant.last_fertilized = payload.timestamp;
            setPlant(oldPlant);
        }
    }

    // Water history delete button handler
    // Removes selected events from database, re-renders history
    const deleteWaterEvents = () => {
        console.log(selectedWaterEvents);
        selectedWaterEvents.current.forEach(async timestamp => {
            await deleteEvent(timestamp, 'water')
        })
        setEditingWaterEvents(false);
    }

    // Fertilize history delete button handler
    // Removes selected events from database, re-renders history
    const deleteFertilizeEvents = () => {
        selectedFertilizeEvents.current.forEach(async timestamp => {
            await deleteEvent(timestamp, 'fertilize')
        })
        setEditingFertilizeEvents(false);
    }

    // Takes event timestamp and types, sends delete request to backend
    // If successful removes timestamp from react state to re-render history
    async function deleteEvent(timestamp, type) {
        const payload = {
            plant_id: plant.uuid,
            event_type: type,
            timestamp: timestamp
        }
        const response = await sendPostRequest('/delete_plant_event', payload);
        if (response.ok) {
            if (type === 'water') {
                removeWaterEvent(timestamp);
            } else if (type === 'fertilize') {
                removeFertilizeEvent(timestamp);
            }
        }
    }

    // Takes WaterEvent timestamp, removes from react state
    function removeWaterEvent(timestamp) {
        let oldPlant = {...plant};
        oldPlant.water_events.splice(oldPlant.water_events.indexOf(timestamp), 1);
        setPlant(oldPlant);
    }

    // Takes FertilizeEvent timestamp, removes from react state
    function removeFertilizeEvent(timestamp) {
        let oldPlant = {...plant};
        oldPlant.fertilize_events.splice(oldPlant.fertilize_events.indexOf(timestamp), 1);
        setPlant(oldPlant);
    }

    // Shown in dropdown when name in nav bar clicked
    const DetailsCard = ({ species, pot_size, description }) => {
        return (
            <div className="card card-compact p-2 shadow bg-neutral text-neutral-content mx-auto mt-2">
                <div className="card-body">
                    <p>Species: {species}</p>
                    <p>Pot size: {pot_size} inches</p>
                    <p>Description: {description}</p>
                    <button className="btn btn-sm mt-4" onClick={openEditModal}>Edit</button>
                </div>
            </div>
        )
    }

    // Displays timestamp and relative time in event history sections
    const EventCard = ({ timestamp }) => {
        return (
            <div className="card card-compact bg-neutral text-neutral-content text-center">
                <div className="card-body">
                    <p className="text-lg font-bold">{timestampToRelative(timestamp)}</p>
                    <p>{DateTime.fromISO(timestamp).toFormat('t MMMM dd, yyyy')}</p>
                </div>
            </div>
        )
    }

    // Takes state bool, function to set state bool, delete button handler
    // Shows edit button when bool is false, cancel and delete buttons when true
    // Rendered at the bottom of water/fertilize event history columns
    const EventHistoryButtons = ({editing, setEditing, handleDelete}) => {
        switch(editing) {
            case(true):
                return (
                    <div className="flex">
                        <button className="btn btn-outline mx-auto" onClick={() => setEditing(false)}>
                            Cancel
                        </button>
                        <button className="btn btn-outline btn-error mx-auto" onClick={() => handleDelete()}>
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

    // Takes plant.tray (state object key) and trays state object
    // Renders dropdown if plant not in tray, link to tray if is in tray
    const PlantTraySection = ({ tray, trayOptions }) => {
        switch(tray) {
            case(null):
                return (
                    <div className="card card-compact mt-8 mx-auto bg-base-200 text-center">
                        <div className="card-body">
                            <p className="text-lg">Add plant to tray</p>
                            <select
                                id="traySelect"
                                defaultValue=""
                                onChange={addToTray}
                                className="select select-bordered w-full"
                            >
                                <option value="" disabled>Select tray</option>
                                {trayOptions.map(tray => {
                                    return <option key={tray.uuid} value={tray.uuid}>{tray.name}</option>
                                })}
                            </select>
                        </div>
                    </div>
                )
            default:
                return (
                    <div className="card card-compact mt-8 mx-auto bg-base-200 text-center px-8 py-2">
                        <div className="card-body">
                            <p>Plant is in tray:</p>
                            <p className="text-xl font-bold"><a href={"/manage/" + tray.uuid}>
                                { tray.name }
                            </a></p>
                            <button
                                className="btn btn-sm btn-outline btn-error mt-4"
                                onClick={removeFromTray}
                            >
                                Remove
                            </button>
                        </div>
                    </div>
                )
        }
    }

    // Called when user selects tray from dropdown
    const addToTray = async () => {
        const payload = {
            plant_id: plant.uuid,
            tray_id: document.getElementById('traySelect').value
        }
        const response = await sendPostRequest('/add_plant_to_tray', payload);
        if (response.ok) {
            {/* TODO improve context, this is ridiculous */}
            trays.forEach(tray => {
                if (tray.uuid === payload.tray_id) {
                    let oldPlant = {...plant};
                    oldPlant.tray = {name: tray.name, uuid: tray.uuid}
                    setPlant(oldPlant);
                }
            })
        }
    }

    // Handler for remove from tray button
    const removeFromTray = async () => {
        const response = await sendPostRequest('/remove_plant_from_tray', {plant_id: plant.uuid});
        if (response.ok) {
            let oldPlant = {...plant};
            oldPlant.tray = null;
            setPlant(oldPlant);
        }
    }

    return (
        <div className="container flex flex-col mx-auto">
            <div className="navbar bg-base-100 mb-4">
                <div className="navbar-start">

                    <div className="dropdown">
                        <div tabIndex={0} role="button" className="btn btn-ghost btn-circle">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-5 w-5"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="2"
                                    d="M4 6h16M4 12h16M4 18h7"
                                />
                            </svg>
                        </div>
                        <ul tabIndex={0} className="menu menu-md dropdown-content mt-3 z-[99] p-2 shadow bg-base-300 rounded-box w-52">
                            <li><a onClick={overview}>Overview</a></li>
                        </ul>
                    </div>

                </div>
                <div className="navbar-center">
                    <div className="dropdown">
                        <a tabIndex={0} role="button" className="btn btn-ghost text-3xl">{plant.display_name}</a>
                        <div tabIndex={0} className="dropdown-content z-[1] flex w-full">
                            <DetailsCard
                                species={plant.species}
                                pot_size={plant.pot_size}
                                description={plant.description}
                            />
                        </div>
                    </div>
                </div>
                <div className="navbar-end">
                </div>
            </div>

            <div className="flex flex-col text-center">
                <span className="text-lg">Last Watered: {timestampToRelative(plant.last_watered)}</span>
                <span className="text-lg">Last Fertilized: {timestampToRelative(plant.last_fertilized)}</span>
                <input
                    id="eventTime"
                    className="input input-bordered mx-auto my-2"
                    type="datetime-local"
                    step="1"
                    defaultValue={DateTime.now().toFormat("yyyy-MM-dd'T'HH:mm:ss")}
                />
                <div className="flex mx-auto">
                    <button className="btn btn-info m-2" onClick={waterPlant}>Water</button>
                    <button className="btn btn-success m-2" onClick={fertilizePlant}>Fertilize</button>
                </div>
            </div>

            <PlantTraySection tray={plant.tray} trayOptions={trays} />

            <div className="grid grid-cols-1 md:grid-cols-2 mx-auto mt-16">
                <div className="md:mr-8 mb-8 md:mb-0">
                    <CollapseCol title="Water History" defaultOpen={false}>
                        <EditableNodeList editing={editingWaterEvents} selected={selectedWaterEvents}>
                            {plant.water_events.map((timestamp) => {
                                return <EventCard key={timestamp} timestamp={timestamp} />
                            })}
                        </EditableNodeList>
                        <EventHistoryButtons
                            editing={editingWaterEvents}
                            setEditing={setEditingWaterEvents}
                            handleDelete={deleteWaterEvents}
                        />
                    </CollapseCol>
                </div>

                <div className="md:ml-8">
                    <CollapseCol title="Fertilize History" defaultOpen={false}>
                        <EditableNodeList editing={editingFertilizeEvents} selected={selectedFertilizeEvents}>
                            {plant.fertilize_events.map((timestamp) => {
                                return <EventCard key={timestamp} timestamp={timestamp} />
                            })}
                        </EditableNodeList>
                        <EventHistoryButtons
                            editing={editingFertilizeEvents}
                            setEditing={setEditingFertilizeEvents}
                            handleDelete={deleteFertilizeEvents}
                        />
                    </CollapseCol>
                </div>
            </div>

            <EditModal title="Edit Details" onSubmit={submitEditModal}>
                <PlantDetails
                    name={plant.name}
                    species={plant.species}
                    pot_size={plant.pot_size}
                    description={plant.description}
                />
            </EditModal>

        </div>
    );
}

export default App;
