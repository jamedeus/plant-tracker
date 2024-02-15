import React, { useState, useEffect, useRef } from 'react';
import { sendPostRequest, parseDomContext, localToUTC, timestampToRelative } from 'src/util';
import { DateTime } from 'luxon';

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

            <dialog id="editModal" className="modal">
                <div className="modal-box text-center flex flex-col">
                    <form method="dialog">
                        {/* if there is a button in form, it will close the modal */}
                        <button className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
                    </form>
                    <h3 className="font-bold text-lg">Edit Details</h3>

                    <form id="plantDetails">
                        <label className="form-control w-full">
                            <div className="label">
                                <span className="label-text-alt">Plant name</span>
                            </div>
                            <input
                                name="name"
                                type="text"
                                className="input w-full input-bordered"
                                defaultValue={plant.name}
                            />
                        </label>
                        <label className="form-control w-full">
                            <div className="label">
                                <span className="label-text-alt">Plant species</span>
                            </div>
                            <input
                                name="species"
                                type="text"
                                className="input w-full input-bordered"
                                defaultValue={plant.species}
                            />
                        </label>
                        <label className="form-control w-full">
                            <div className="label">
                                <span className="label-text-alt">Pot size</span>
                            </div>
                            <input
                                name="pot_size"
                                type="number"
                                className="input w-full input-bordered"
                                min="1"
                                max="36"
                                defaultValue={plant.pot_size}
                            />
                        </label>
                        <label className="form-control w-full">
                            <div className="label">
                                <span className="label-text-alt">Description</span>
                            </div>
                            <textarea
                                name="description"
                                className="textarea textarea-bordered"
                                defaultValue={plant.description}
                            />
                        </label>
                    </form>

                    <div className="modal-action mx-auto">
                        <form method="dialog">
                            {/* if there is a button in form, it will close the modal */}
                            <button className="btn mr-2">Cancel</button>
                            <button className="btn ml-2" onClick={submitEditModal}>Edit</button>
                        </form>
                    </div>
                </div>
                <form method="dialog" className="modal-backdrop">
                    <button>close</button>
                </form>
            </dialog>

        </div>
    );
}

export default App;
