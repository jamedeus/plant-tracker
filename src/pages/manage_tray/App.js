import React, { useState, useRef } from 'react';
import PropTypes from 'prop-types';
import { sendPostRequest, parseDomContext, localToUTC, pastTense } from 'src/util';
import EditableNodeList from 'src/components/EditableNodeList';
import EditModal from 'src/components/EditModal';
import TrayDetailsForm from 'src/forms/TrayDetailsForm';
import Navbar from 'src/components/Navbar';
import PlantCard from 'src/components/PlantCard';
import DatetimeInput from 'src/components/DatetimeInput';
import FilterColumn from 'src/components/FilterColumn';
import { useToast } from 'src/context/ToastContext';
import { useTheme } from 'src/context/ThemeContext';
import DetailsCard from 'src/components/DetailsCard';
import Modal from 'src/components/Modal';
import TrayDetails from 'src/components/TrayDetails';

function App() {
    // Load context set by django template
    const [tray, setTray] = useState(() => {
        return parseDomContext("tray");
    });
    const [plantDetails, setPlantDetails] = useState(() => {
        return parseDomContext("details");
    });
    // Contains list of objects with name and uuid of every plant in database
    // DO NOT mutate (used to generate add/remove plant menu options)
    const options = parseDomContext("options");

    // Create state to track whether selecting plants from list
    const [selectingPlants, setSelectingPlants] = useState(false);

    // Track which plants are selected (after clicking manage button)
    const selectedPlants = useRef([]);

    // Track plants column open/close state between re-renders
    const plantsOpenRef = useRef(true);

    // Create state to track whether manage modal opened to add or remove
    const [managePlants, setManagePlants] = useState('');

    // Get hook to show toast message
    const { showToast } = useToast();

    // Create ref for modal used to add/remove plants to/from tray
    const managePlantsModalRef = useRef(null);

    // Get toggle theme option from context
    const { ToggleThemeOption } = useTheme();

    const overview = () => {
        window.location.href = "/";
    };

    const submitEditModal = async () => {
        const payload = Object.fromEntries(
            new FormData(document.getElementById('trayDetails'))
        );
        payload["tray_id"] = tray.uuid;
        console.log(payload);

        const response = await sendPostRequest('/edit_tray', payload);
        if (response.ok) {
            // Update plant state with new values from response
            const data = await response.json();
            setTray({...tray, ...data});
        }
    };

    // Handler for "Water All" and "Fertilize All" buttons
    const addEventAll = async (eventType) => {
        const timestamp = localToUTC(
            document.getElementById("addEventAllTime").value
        );
        // Post eventType, all plant UUIDs, and timestamp to backend endpoint
        await bulkAddPlantEvents(
            eventType,
            plantDetails.map(plant => plant.uuid),
            timestamp
        );
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
            showToast(`All plants ${pastTense(eventType)}!`, 'blue', 5000);
            const data = await response.json();
            updatePlantTimestamps(data.plants, timestamp, eventType);
        }
    };

    // Map eventType taken by bulk_add_plant_events to the plantDetails state
    // key that should be updated when an event is successfully created
    const eventTypeMap = {
        water: "last_watered",
        fertilize: "last_fertilized"
    };

    // Called by bulkAddPlantEvents to update plant water/fertilize timestamps
    const updatePlantTimestamps = (updatedPlants, timestamp, eventType) => {
        let newPlantDetails = [];
        plantDetails.forEach(plant => {
            // Overwrite last_watered if UUID in JSON response
            if (updatedPlants.includes(plant.uuid)) {
                plant[eventTypeMap[eventType]] = timestamp;
            }
            newPlantDetails.push(plant);
        });
        setPlantDetails(newPlantDetails);
    };

    // Opens modal with list of new plant options if arg is 'add'
    // Opens modal with list of existing plants if arg is 'remove'
    const openManagePlantsModal = (action) => {
        setManagePlants(action);
        managePlantsModalRef.current.showModal();
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
        // Ref to track selected items
        const selected = useRef([]);

        // Handler for add button in manage plants modal
        const addPlants = async () => {
            const payload = {
                tray_id: tray.uuid,
                plants: selected.current
            };
            const response = await sendPostRequest('/bulk_add_plants_to_tray', payload);
            if (response.ok) {
                // Add objects in response to plantDetails state
                const data = await response.json();
                setPlantDetails([...plantDetails, ...data.added]);
            }
        };

        // Get object with name and UUID of all plants not already in tray
        const existing = plantDetails.map(plant => plant.uuid);
        const plantOptions = options.filter(plant => !existing.includes(plant.uuid));

        return (
            <>
                <EditableNodeList editing={true} selected={selected}>
                    {plantOptions.map((plant) => {
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
        // Ref to track selected items
        const selected = useRef([]);

        // Handler for remove button in manage plants modal
        const removePlants = async () => {
            const payload = {
                tray_id: tray.uuid,
                plants: selected.current
            };
            const response = await sendPostRequest('/bulk_remove_plants_from_tray', payload);
            if (response.ok) {
                // Remove UUIDs in response from plantDetails
                const data = await response.json();
                setPlantDetails(plantDetails.filter(plant => !data.removed.includes(plant.uuid)));
            }
        };

        return (
            <>
                <EditableNodeList editing={true} selected={selected}>
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

    // Buttons used to add bulk events to plants in tray
    const PlantEventButtons = ({editing, setEditing}) => {
        switch(editing) {
            case(true):
                // Handler for water button (only used in this case scope)
                // eslint-disable-next-line no-case-declarations
                const water = async () => {
                    const timestamp = localToUTC(document.getElementById("addEventTime").value);
                    await bulkAddPlantEvents('water', selectedPlants.current, timestamp);
                    setEditing(false);
                };

                // Handler for fertilize button (only used in this case scope)
                // eslint-disable-next-line no-case-declarations
                const fertilize = async () => {
                    const timestamp = localToUTC(document.getElementById("addEventTime").value);
                    await bulkAddPlantEvents('fertilize', selectedPlants.current, timestamp);
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
                menuOptions={
                    <>
                        <li><a onClick={overview}>Overview</a></li>
                        <li><a onClick={() => openManagePlantsModal('add')}>Add plants</a></li>
                        <li><a onClick={() => openManagePlantsModal('remove')}>Remove plants</a></li>
                        <ToggleThemeOption />
                    </>
                }
                title={tray.display_name}
                titleOptions={
                    <DetailsCard>
                        <TrayDetails
                            location={tray.location}
                            description={tray.description}
                        />
                    </DetailsCard>
                }
            />

            <DatetimeInput id="addEventAllTime" />
            <div className="flex mx-auto mb-8">
                <button className="btn btn-info m-2" onClick={() => addEventAll('water')}>
                    Water All
                </button>
                <button className="btn btn-success m-2" onClick={() => addEventAll('fertilize')}>
                    Fertilize All
                </button>
            </div>

            <FilterColumn
                title="Plants"
                contents={plantDetails}
                cardComponent={PlantCard}
                editing={selectingPlants}
                selected={selectedPlants}
                openRef={plantsOpenRef}
            >
                <PlantEventButtons editing={selectingPlants} setEditing={setSelectingPlants} />
            </FilterColumn>

            <EditModal title="Edit Details" onSubmit={submitEditModal}>
                <TrayDetailsForm
                    name={tray.name}
                    location={tray.location}
                    description={tray.description}
                />
            </EditModal>

            {/* Shown when 'Add plants' or 'Remove plants' clicked in dropdown */}
            <Modal dialogRef={managePlantsModalRef}>
                {(() => {
                    switch(managePlants) {
                        case('add'):
                            return (
                                <>
                                    <p className="font-bold text-2xl mb-8">
                                        Add Plants
                                    </p>
                                    <AddPlantsModalContents />
                                </>
                            );
                        case('remove'):
                            return (
                                <>
                                    <p className="font-bold text-2xl mb-8">
                                        Remove Plants
                                    </p>
                                    <RemovePlantsModalContents />
                                </>
                            );
                    }
                })()}
            </Modal>
        </div>
    );
}

export default App;
