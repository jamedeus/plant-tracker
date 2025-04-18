import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { localToUTC } from 'src/timestampUtils';
import { sendPostRequest, parseDomContext, pastTense } from 'src/util';
import Navbar from 'src/components/Navbar';
import NavbarDropdownOptions from 'src/components/NavbarDropdownOptions';
import DatetimeInput from 'src/components/DatetimeInput';
import { showToast } from 'src/components/Toast';
import DetailsCard from 'src/components/DetailsCard';
import GroupDetails from 'src/components/GroupDetails';
import PlantsCol from 'src/components/PlantsCol';
import EditGroupModal from './EditGroupModal';
import AddPlantsModal, { openAddPlantsModal } from './AddPlantsModal';
import RemovePlantsModal, { openRemovePlantsModal } from './RemovePlantsModal';
import ChangeQrModal, { openChangeQrModal } from 'src/components/ChangeQrModal';
import { openErrorModal } from 'src/components/ErrorModal';

// Buttons used to add events to all selected plants
const PlantEventButtons = ({ editing, setEditing, addEventSelected }) => {
    const addEventTimeInput = useRef(null);

    if (editing) {
        return (
            <>
                <div
                    className="flex flex-col items-center mb-4"
                    data-testid="addEventTimeInput"
                >
                    <DatetimeInput inputRef={addEventTimeInput} />
                </div>
                <div className="flex">
                    <button
                        className="btn btn-outline mx-auto"
                        onClick={() => setEditing(false)}
                    >
                        Cancel
                    </button>
                    <button
                        className="btn btn-outline btn-info mx-auto"
                        onClick={() => addEventSelected(
                            'water',
                            localToUTC(addEventTimeInput.current.value)
                        )}
                    >
                        Water
                    </button>
                    <button
                        className="btn btn-outline btn-success mx-auto"
                        onClick={() => addEventSelected(
                            'fertilize',
                            localToUTC(addEventTimeInput.current.value)
                        )}
                    >
                        Fertilize
                    </button>
                </div>
            </>
        );
    } else {
        return (
            <div className="flex">
                <button
                    className="btn btn-outline mx-auto"
                    onClick={() => setEditing(true)}>
                    Manage
                </button>
            </div>
        );
    }
};

PlantEventButtons.propTypes = {
    editing: PropTypes.bool.isRequired,
    setEditing: PropTypes.func.isRequired,
    addEventSelected: PropTypes.func.isRequired
};

function App() {
    // Load context set by django template
    const [group, setGroup] = useState(() => {
        return parseDomContext("group");
    });
    const [plantDetails, setPlantDetails] = useState(() => {
        return parseDomContext("details");
    });
    // Contains list of objects with name and uuid of every plant in database
    // Should NOT be mutated except by pageshow listener below
    const [options, setOptions] = useState(() => {
        return parseDomContext("options");
    });

    // Array of plant objects that are not archived or already in group
    const addPlantsModalOptions = useMemo(() => {
        const existing = plantDetails.map(plant => plant.uuid);
        return options.filter(
            plant => !existing.includes(plant.uuid) && !plant.archived
        );
    }, [plantDetails, options]);

    // Request new state from backend if user navigates to page by pressing
    // back button (may be outdated if user clicked plant and made changes)
    useEffect(() => {
        const handleBackButton = async (event) => {
            if (event.persisted) {
                const response = await fetch(`/get_group_state/${group.uuid}`);
                if (response.ok) {
                    const data = await response.json();
                    setGroup(data['group']);
                    setPlantDetails(data['details']);
                    setOptions(data['options']);
                } else {
                    // Reload page if failed to get new state (group deleted)
                    window.location.reload();
                }
            }
        };

        window.addEventListener('pageshow', handleBackButton);

        return () => {
            window.removeEventListener('pageshow', handleBackButton);
        };
    }, []);

    // Create state to track whether selecting plants from list
    const [selectingPlants, setSelectingPlants] = useState(false);

    // FormRef for FilterColumn used to add events to subset of plants in group
    const selectedPlantsRef = useRef(null);

    // Returns array of selected plant UUIDs parsed from FilterColumn form
    const getSelectedPlants = () => {
        const selected = new FormData(selectedPlantsRef.current);
        return Array.from(selected.keys());
    };

    // Ref to access timestamp input used by water all/fertilize all
    const addEventAllTimeInput = useRef(null);

    // Takes array of plant UUIDs, removes archived plants and returns
    const removeArchivedPlants = (selected) => {
        return selected.filter(uuid => {
            const plant = plantDetails.find(plant => plant.uuid === uuid);
            if (plant && !plant.archived) {
                return uuid;
            }
        });
    };

    // Handler for "Water All" and "Fertilize All" buttons
    const addEventAll = async (eventType) => {
        const timestamp = localToUTC(addEventAllTimeInput.current.value);
        // Post eventType, UUIDs of all plants that aren't archived, and
        // timestamp to backend endpoint
        await bulkAddPlantEvents(
            eventType,
            removeArchivedPlants(plantDetails.map(plant => plant.uuid)),
            timestamp
        );
    };

    // Handler for water and fertilize buttons under plant cards
    const addEventSelected = async (eventType, timestamp) => {
        // Prevent adding event to archived plants
        const selected = removeArchivedPlants(getSelectedPlants());
        if (selected.length) {
            await bulkAddPlantEvents(eventType, selected, timestamp);
            setSelectingPlants(false);
        } else {
            showToast('No plants selected!', 'yellow', 3000);
        }
    };

    // Creates event with specified type and timestamp for every plant in
    // selectedIds (array of UUIDs)
    const bulkAddPlantEvents = async (eventType, selectedIds, timestamp) => {
        const payload = {
            plants: selectedIds,
            event_type: eventType,
            timestamp: timestamp
        };
        const response = await sendPostRequest(
            '/bulk_add_plant_events',
            payload
        );
        if (response.ok) {
            showToast(`All plants ${pastTense(eventType)}!`, 'blue', 5000);
            const data = await response.json();
            updatePlantTimestamps(data.plants, timestamp, eventType);
        } else {
            const error = await response.json();
            openErrorModal(JSON.stringify(error));
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
        const lastEvent = eventTypeMap[eventType];
        plantDetails.forEach(plant => {
            // Update lastEvent timestamp if UUID in JSON response
            if (updatedPlants.includes(plant.uuid)) {
                plant[lastEvent] = getMostRecent(plant[lastEvent], timestamp);
            }
            newPlantDetails.push(plant);
        });
        setPlantDetails(newPlantDetails);
    };

    // Takes 2 ISO 8601 timestamps, returns most recent
    const getMostRecent = (oldTime, newTime) => {
        // Return new if old is null (ie plant had no water events before)
        if (!oldTime) {
            return newTime;
        } else if (newTime > oldTime) {
            return newTime;
        } else {
            return oldTime;
        }
    };

    // Handler for add button in AddPlantsModal, takes array of UUIDs
    const addPlants = useCallback(async (selected) => {
        const payload = {
            group_id: group.uuid,
            plants: selected
        };
        const response = await sendPostRequest(
            '/bulk_add_plants_to_group',
            payload
        );
        if (response.ok) {
            // Add objects in response to plantDetails state
            const data = await response.json();
            setPlantDetails([...plantDetails, ...data.added]);
        } else {
            const error = await response.json();
            openErrorModal(JSON.stringify(error));
        }
    }, [plantDetails]);

    // Handler for remove button in RemovePlantsModal, takes array of UUIDs
    const removePlants = useCallback(async (selected) => {
        const payload = {
            group_id: group.uuid,
            plants: selected
        };
        const response = await sendPostRequest(
            '/bulk_remove_plants_from_group',
            payload
        );
        if (response.ok) {
            // Remove UUIDs in response from plantDetails
            const data = await response.json();
            setPlantDetails(plantDetails.filter(
                plant => !data.removed.includes(plant.uuid)
            ));
        } else {
            const error = await response.json();
            openErrorModal(JSON.stringify(error));
        }
    }, [plantDetails]);

    // Top left corner dropdown options
    const DropdownMenuOptions = useMemo(() => (
        <NavbarDropdownOptions>
            <li><a onClick={openAddPlantsModal}>
                Add plants
            </a></li>
            <li><a onClick={openRemovePlantsModal}>
                Remove plants
            </a></li>
            <li><a onClick={openChangeQrModal}>
                Change QR code
            </a></li>
        </NavbarDropdownOptions>
    ), []);

    // Group details card shown when title is clicked
    const GroupDetailsDropdown = useMemo(() => (
        <DetailsCard>
            <GroupDetails
                location={group.location}
                description={group.description}
            />
        </DetailsCard>
    ), [group]);

    return (
        <div className="container flex flex-col items-center mx-auto mb-8">
            <Navbar
                menuOptions={DropdownMenuOptions}
                title={group.display_name}
                titleOptions={GroupDetailsDropdown}
            />

            <DatetimeInput inputRef={addEventAllTimeInput} />
            <div className="flex mb-8">
                <button
                    className="btn btn-info m-2"
                    onClick={() => addEventAll('water')}
                >
                    Water All
                </button>
                <button
                    className="btn btn-success m-2"
                    onClick={() => addEventAll('fertilize')}
                >
                    Fertilize All
                </button>
            </div>

            <div className="px-4">
                <PlantsCol
                    plants={plantDetails}
                    editing={selectingPlants}
                    formRef={selectedPlantsRef}
                    storageKey={`group-${group.uuid}`}
                >
                    <PlantEventButtons
                        editing={selectingPlants}
                        setEditing={setSelectingPlants}
                        addEventSelected={addEventSelected}
                    />
                </PlantsCol>
            </div>

            <EditGroupModal group={group} setGroup={setGroup} />

            <AddPlantsModal
                options={addPlantsModalOptions}
                addPlants={addPlants}
            />

            <RemovePlantsModal
                plantDetails={plantDetails}
                removePlants={removePlants}
            />

            <ChangeQrModal
                uuid={group.uuid}
            />
        </div>
    );
}

export default App;
