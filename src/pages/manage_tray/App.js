import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { sendPostRequest, parseDomContext, localToUTC } from 'src/util';
import CollapseCol from 'src/components/CollapseCol';
import EditableNodeList from 'src/components/EditableNodeList';
import EditModal from 'src/components/EditModal';
import TrayDetails from 'src/forms/TrayDetails';
import Navbar from 'src/components/Navbar';
import PlantCard from 'src/components/PlantCard';
import DatetimeInput from 'src/components/DatetimeInput';
import { useToast } from 'src/ToastContext';

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
    // Contains list of objects with name and uuid of every plant in database
    // DO NOT mutate (menu options are produced by filtering out plantIds state)
    // As long as plantIds matches the plants in tray options will be correct
    const options = parseDomContext("options");

    // Create state to track whether selecting plants from list
    const [selectingPlants, setSelectingPlants] = useState(false);

    // Track which plants are selected
    const [selectedPlants, setSelectedPlants] = useState([]);

    // Create state to track whether manage modal opened to add or remove
    const [managePlants, setManagePlants] = useState('');

    // Get hook to show toast message
    const { showToast } = useToast();

    const overview = () => {
        window.location.href = "/";
    };

    const openEditModal = () => {
        document.getElementById('editModal').showModal();
    };

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
    };

    // Handler for "Water All" button
    const waterTray = async () => {
        const timestamp = localToUTC(document.getElementById("addEventAllTime").value);
        await bulkAddPlantEvents('water', plantIds, timestamp);
    };

    // Handler for "Fertilize All" button
    const fertilizeTray = async () => {
        const timestamp = localToUTC(document.getElementById("addEventAllTime").value);
        await bulkAddPlantEvents('fertilize', plantIds, timestamp);
    };

    // Creates event with specified type and timestamp for every plant in
    // selectedIds (array of UUIDs)
    const bulkAddPlantEvents = async (eventType, selectedIds, timestamp) => {
        const payload = {
            plants: selectedIds,
            event_type: eventType,
            timestamp: timestamp
        };
        const response = await sendPostRequest('/bulk_add_plant_events', payload);
        if (response.ok) {
            if (eventType.endsWith('e')) {
                showToast(`All plants ${eventType}d!`, 'blue', 5000);
            } else {
                showToast(`All plants ${eventType}ed!`, 'blue', 5000);
            }
        }
    };

    // Opens modal with list of new plant options if arg is 'add'
    // Opens modal with list of existing plants if arg is 'remove'
    const openManagePlantsModal = (action) => {
        setManagePlants(action);
        document.getElementById('managePlantsModal').showModal();
    };

    // Displays plant options in managePlantsModal
    const ManagePlantsCard = ({ name }) => {
        return (
            <div className="card bg-neutral text-neutral-content mx-auto w-full">
                <div className="card-body text-center">
                    <h2 className="card-title mx-auto">{name}</h2>
                </div>
            </div>
        );
    };

    ManagePlantsCard.propTypes = {
        name: PropTypes.string
    };

    // Contents of managePlantsModal when managePlants === 'add'
    const AddPlantsModalContents = () => {
        // State to track selected items
        const [selected, setSelected] = useState([]);

        // Handler for add button in manage plants modal
        const addPlants = async () => {
            const payload = {
                tray_id: tray.uuid,
                plants: selected
            };
            const response = await sendPostRequest('/bulk_add_plants_to_tray', payload);
            if (response.ok) {
                // TODO improve django context to simplify this
                const data = await response.json();
                // Add UUIDS in response to plantIds (used for waterAll, etc)
                setPlantIds([...plantIds, ...data.added]);

                // Parse details for each added plant from options list, add to plantDetails state
                const addedPlants = options.filter(plant => data.added.includes(plant.uuid));
                setPlantDetails([...plantDetails, ...addedPlants]);
            }
        };

        return (
            <>
                <EditableNodeList editing={true} selected={selected} setSelected={setSelected}>
                    {options.filter(plant => !plantIds.includes(plant.uuid)).map((plant) => {
                        return <ManagePlantsCard key={plant.uuid} name={plant.name} />;
                    })}
                </EditableNodeList>

                <div className="modal-action mx-auto">
                    <form method="dialog">
                        <button className="btn mr-2">Cancel</button>
                        <button className="btn btn-success ml-2" onClick={addPlants}>Add</button>
                    </form>
                </div>
            </>
        );
    };

    // Contents of managePlantsModal when managePlants === 'remove'
    const RemovePlantsModalContents = () => {
        // State to track selected items
        const [selected, setSelected] = useState([]);

        // Handler for remove button in manage plants modal
        const removePlants = async () => {
            const payload = {
                tray_id: tray.uuid,
                plants: selected
            };
            const response = await sendPostRequest('/bulk_remove_plants_from_tray', payload);
            if (response.ok) {
                const data = await response.json();
                // Remove UUIDs in response from plantIds (will appear in addPlants options)
                setPlantIds(plantIds.filter(plant => !data.removed.includes(plant)));

                // Remove UUIDs in response from plantDetails
                setPlantDetails(plantDetails.filter(plant => !data.removed.includes(plant.uuid)));
            }
        };

        return (
            <>
                <EditableNodeList editing={true} selected={selected} setSelected={setSelected}>
                    {plantDetails.map((plant) => {
                        return <ManagePlantsCard key={plant.uuid} name={plant.name} />;
                    })}
                </EditableNodeList>

                <div className="modal-action mx-auto">
                    <form method="dialog">
                        <button className="btn mr-2">Cancel</button>
                        <button className="btn btn-error ml-2" onClick={removePlants}>Remove</button>
                    </form>
                </div>
            </>
        );
    };

    // Shown in dropdown when name in nav bar clicked
    const DetailsCard = ({ location }) => {
        return (
            <div className="card card-compact p-2 shadow bg-neutral text-neutral-content mx-auto mt-2">
                <div className="card-body">
                    <p>Location: {location}</p>
                    <button className="btn btn-sm mt-4" onClick={openEditModal}>Edit</button>
                </div>
            </div>
        );
    };

    DetailsCard.propTypes = {
        location: PropTypes.string
    };

    // Buttons used to add bulk events to plants in tray
    const PlantEventButtons = ({editing, setEditing}) => {
        switch(editing) {
            case(true):
                // Handler for water button (only used in this case scope)
                // eslint-disable-next-line no-case-declarations
                const water = async () => {
                    const timestamp = localToUTC(document.getElementById("addEventTime").value);
                    await bulkAddPlantEvents('water', selectedPlants, timestamp);
                    setEditing(false);
                };

                // Handler for fertilize button (only used in this case scope)
                // eslint-disable-next-line no-case-declarations
                const fertilize = async () => {
                    const timestamp = localToUTC(document.getElementById("addEventTime").value);
                    await bulkAddPlantEvents('fertilize', selectedPlants, timestamp);
                    setEditing(false);
                };

                return (
                    <>
                        <div className="flex mx-auto mb-4">
                            <DatetimeInput id="addEventTime" />
                        </div>
                        <div className="flex">
                            <button className="btn btn-outline mx-auto" onClick={() => setEditing(false)}>
                                Cancel
                            </button>
                            <button className="btn btn-outline btn-info mx-auto" onClick={water}>
                                Water
                            </button>
                            <button className="btn btn-outline btn-success mx-auto" onClick={fertilize}>
                                Fertilize
                            </button>
                        </div>
                    </>
                );
            case(false):
                return (
                    <div className="flex">
                        <button className="btn btn-outline mx-auto" onClick={() => setEditing(true)}>
                            Manage
                        </button>
                    </div>
                );
        }
    };

    PlantEventButtons.propTypes = {
        editing: PropTypes.bool,
        setEditing: PropTypes.func
    };

    return (
        <div className="container flex flex-col mx-auto mb-8">
            <Navbar
                dropdownOptions={
                    <>
                        <li><a onClick={overview}>Overview</a></li>
                        <li><a onClick={() => openManagePlantsModal('add')}>Add plants</a></li>
                        <li><a onClick={() => openManagePlantsModal('remove')}>Remove plants</a></li>
                    </>
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

            <DatetimeInput id="addEventAllTime" />
            <div className="flex mx-auto mb-8">
                <button className="btn btn-info m-2" onClick={waterTray}>
                    Water All
                </button>
                <button className="btn btn-success m-2" onClick={fertilizeTray}>
                    Fertilize All
                </button>
            </div>

            <CollapseCol title="Plants" defaultOpen={true}>
                <EditableNodeList
                    editing={selectingPlants}
                    selected={selectedPlants}
                    setSelected={setSelectedPlants}
                >
                    {plantDetails.map((plant) => {
                        return <PlantCard key={plant.uuid} name={plant.name} uuid={plant.uuid} />;
                    })}
                </EditableNodeList>
                <PlantEventButtons editing={selectingPlants} setEditing={setSelectingPlants} />
            </CollapseCol>

            <EditModal title="Edit Details" onSubmit={submitEditModal}>
                <TrayDetails
                    name={tray.name}
                    location={tray.location}
                />
            </EditModal>

            {/* Shown when user selects 'Add plants' or 'Remove plants' from dropdown */}
            <dialog id="managePlantsModal" className="modal">
                <div className="modal-box text-center flex flex-col">
                    <form method="dialog">
                        <button className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
                    </form>
                    <h3 className="font-bold text-lg mb-8">Add Plants to Tray</h3>

                    {(() => {
                        switch(managePlants) {
                            case('add'):
                                return <AddPlantsModalContents />;
                            case('remove'):
                                return <RemovePlantsModalContents />;
                        }
                    })()}
                </div>
                <form method="dialog" className="modal-backdrop">
                    <button>close</button>
                </form>
            </dialog>
        </div>
    );
}

export default App;
