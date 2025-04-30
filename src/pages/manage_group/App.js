import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
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
import FloatingFooter from 'src/components/FloatingFooter';
import AddPlantsModal, { openAddPlantsModal } from './AddPlantsModal';
import ChangeQrModal, { openChangeQrModal } from 'src/components/ChangeQrModal';
import { openErrorModal } from 'src/components/ErrorModal';
import { Tab } from '@headlessui/react';
import clsx from 'clsx';

function App() {
    // Load context set by django template
    const [group, setGroup] = useState(() => {
        return parseDomContext("group");
    });
    const [plantDetails, setPlantDetails] = useState(() => {
        return parseDomContext("details");
    });
    // Contains list of objects with details of every plant owned by same user
    // that is not already in a group (AddPlantsModal options state).
    // Should only be mutated by pageshow listener and removePlants callback.
    const [options, setOptions] = useState(() => {
        return parseDomContext("options");
    });

    // Array of plant objects that are not archived
    const addPlantsModalOptions = useMemo(() => {
        return options.filter(plant => !plant.archived);
    }, [options]);

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

    // Buttons add events to all plants if 0, only selected plants if 1
    // Set with tabs above event timestamp input
    const [addEventsMode, setAddEventsMode] = useState(0);

    // Controls whether EditableNodeList checkboxes next to plants are visible
    const [selectingPlants, setSelectingPlants] = useState(false);

    // Show checkboxes next to plants when "Select plants" tab active, hide
    // when "All plants" tab clicked
    useEffect(() => {
        setSelectingPlants(Boolean(addEventsMode));
    }, [addEventsMode]);

    // Controls whether FloatingFooter with remove from group button is visible
    const [removingPlants, setRemovingPlants] = useState(false);

    const startRemovingPlants = () => {
        setRemovingPlants(true);
        setSelectingPlants(true);
        document.activeElement.blur();
    };

    const stopRemovingPlants = () => {
        setRemovingPlants(false);
        setSelectingPlants(false);
    };

    // FormRef for FilterColumn used to add events to subset of plants in group
    const selectedPlantsRef = useRef(null);

    // Returns array of selected plant UUIDs parsed from FilterColumn form
    const getSelectedPlants = () => {
        const selected = new FormData(selectedPlantsRef.current);
        return Array.from(selected.keys());
    };

    // Ref to access timestamp input used by water/fertilize buttons
    const addEventTimeInput = useRef(null);

    // Takes array of plant UUIDs, removes archived plants and returns
    const removeArchivedPlants = (selected) => {
        return selected.filter(uuid => {
            const plant = plantDetails.find(plant => plant.uuid === uuid);
            if (plant && !plant.archived) {
                return uuid;
            }
        });
    };

    // Handler for water and fertilize buttons
    const addEvents = async (eventType) => {
        // If "Select plants" tab active: only add events to selected plants
        if (addEventsMode) {
            await addEventSelected(eventType);
        // If "All plants" tab active: add events to all plants in group
        } else {
            await bulkAddPlantEvents(
                eventType,
                removeArchivedPlants(plantDetails.map(plant => plant.uuid))
            );
        }
    };

    const addEventSelected = async (eventType) => {
        // Prevent adding event to archived plants
        const selected = removeArchivedPlants(getSelectedPlants());
        if (selected.length) {
            await bulkAddPlantEvents(eventType, selected);
        } else {
            showToast('No plants selected!', 'yellow', 3000);
        }
    };

    // Creates event with specified type and timestamp from addEventTimeInput
    // for every plant in selectedIds (array of UUIDs)
    const bulkAddPlantEvents = async (eventType, selectedIds) => {
        const timestamp = localToUTC(addEventTimeInput.current.value);
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
            // Show toast with correct message (All plants or Selected plants)
            const updated = addEventsMode ? "Selected plants" : "All plants";
            showToast(`${updated} ${pastTense(eventType)}!`, 'blue', 5000);
            // Update last watered/fertilized times for all plants in response
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
            // Remove added plants from AddPlantsModal options state
            const addedIds = data.added.map(plant => plant.uuid);
            setOptions(options.filter(
                plant => !addedIds.includes(plant.uuid)
            ));
        } else {
            const error = await response.json();
            openErrorModal(JSON.stringify(error));
        }
    }, [plantDetails]);

    // Handler for remove button in FloatingFooter that appears when remove
    // dropdown option clicked
    const removePlants = useCallback(async () => {
        const payload = {
            group_id: group.uuid,
            plants: getSelectedPlants()
        };
        const response = await sendPostRequest(
            '/bulk_remove_plants_from_group',
            payload
        );
        if (response.ok) {
            const data = await response.json();
            // Add removed plants back to AddPlantsModal options state
            setOptions([ ...options, ...data.removed ]);
            // Remove plants from response from plantDetails state
            const removedIds = data.removed.map(plant => plant.uuid);
            setPlantDetails(plantDetails.filter(
                plant => !removedIds.includes(plant.uuid)
            ));
            // Hide FloatingFooter and checkboxes
            stopRemovingPlants();
        } else {
            const error = await response.json();
            openErrorModal(JSON.stringify(error));
        }
    }, [plantDetails, options]);

    // Top left corner dropdown options
    const DropdownMenuOptions = useMemo(() => (
        <NavbarDropdownOptions>
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
        <div className="container flex flex-col items-center mx-auto mb-28">
            <Navbar
                menuOptions={DropdownMenuOptions}
                title={group.display_name}
                titleOptions={GroupDetailsDropdown}
            />

            <div className={clsx(
                "flex flex-col items-center transition-[height] duration-300",
                removingPlants ? "h-0" : "h-[14.25rem]"
            )}>
                <Tab.Group onChange={(index) => setAddEventsMode(index)}>
                    <Tab.List className="tab-group my-2 w-64">
                        <Tab className={({ selected }) => clsx(
                            'tab-option whitespace-nowrap',
                            selected && 'tab-option-selected'
                        )}>
                            All plants
                        </Tab>
                        <Tab className={({ selected }) => clsx(
                            'tab-option whitespace-nowrap',
                            selected && 'tab-option-selected'
                        )}>
                            Select plants
                        </Tab>
                    </Tab.List>
                </Tab.Group>

                <DatetimeInput inputRef={addEventTimeInput} />
                <div className="flex mb-8">
                    <button
                        className="btn btn-info m-2"
                        onClick={() => addEvents('water')}
                    >
                        Water
                    </button>
                    <button
                        className="btn btn-success m-2"
                        onClick={() => addEvents('fertilize')}
                    >
                        Fertilize
                    </button>
                </div>
            </div>

            <div className="px-4 relative">
                <PlantsCol
                    plants={plantDetails}
                    editing={selectingPlants}
                    formRef={selectedPlantsRef}
                    storageKey={`group-${group.uuid}`}
                    titleOptions={
                        <ul
                            tabIndex={0}
                            className="dropdown-options w-min-content"
                        >
                            <li><a
                                className="flex justify-center"
                                onClick={openAddPlantsModal}
                                data-testid="add_plants_option"
                            >
                                Add
                            </a></li>
                            <li><a
                                className="flex justify-center"
                                onClick={startRemovingPlants}
                                data-testid="remove_plants_option"
                            >
                                Remove
                            </a></li>
                        </ul>
                    }
                >
                </PlantsCol>
            </div>

            <FloatingFooter visible={removingPlants}>
                <button
                    className="btn btn-neutral"
                    onClick={stopRemovingPlants}
                >
                    Cancel
                </button>

                <button
                    className="btn btn-error"
                    onClick={removePlants}
                >
                    Remove
                </button>
            </FloatingFooter>

            <EditGroupModal group={group} setGroup={setGroup} />

            <AddPlantsModal
                options={addPlantsModalOptions}
                addPlants={addPlants}
            />

            <ChangeQrModal
                uuid={group.uuid}
            />
        </div>
    );
}

export default App;
