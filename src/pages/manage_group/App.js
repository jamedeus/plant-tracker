import React, { useState, useRef } from 'react';
import PropTypes from 'prop-types';
import { localToUTC } from 'src/timestampUtils';
import { sendPostRequest, parseDomContext, pastTense } from 'src/util';
import EditModal from 'src/components/EditModal';
import GroupDetailsForm from 'src/forms/GroupDetailsForm';
import Navbar from 'src/components/Navbar';
import PlantCard from 'src/components/PlantCard';
import DatetimeInput from 'src/components/DatetimeInput';
import FilterColumn from 'src/components/FilterColumn';
import { useToast } from 'src/context/ToastContext';
import { useTheme } from 'src/context/ThemeContext';
import DetailsCard from 'src/components/DetailsCard';
import GroupDetails from 'src/components/GroupDetails';
import AddPlantsModal, { openAddPlantsModal } from './AddPlantsModal';
import RemovePlantsModal, { openRemovePlantsModal } from './RemovePlantsModal';
import ChangeQrModal, { openChangeQrModal } from 'src/components/ChangeQrModal';
import { useErrorModal } from 'src/context/ErrorModalContext';

function App() {
    // Load context set by django template
    const [group, setGroup] = useState(() => {
        return parseDomContext("group");
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

    // Ref to access timestamp input used by water all/fertilize all
    const addEventAllTimeInput = useRef(null);

    // Create ref to access edit details form
    const editDetailsRef = useRef(null);

    // Get hooks to show toast message, error modal
    const { showToast } = useToast();
    const { showErrorModal } = useErrorModal();

    // Get toggle theme option from context
    const { ToggleThemeOption } = useTheme();

    const submitEditModal = async () => {
        const payload = Object.fromEntries(
            new FormData(editDetailsRef.current)
        );
        payload["group_id"] = group.uuid;
        console.log(payload);

        const response = await sendPostRequest('/edit_group', payload);
        if (response.ok) {
            // Update plant state with new values from response
            const data = await response.json();
            setGroup({...group, ...data});
        } else {
            const error = await response.json();
            showErrorModal(JSON.stringify(error));
        }
    };

    // Handler for "Water All" and "Fertilize All" buttons
    const addEventAll = async (eventType) => {
        const timestamp = localToUTC(addEventAllTimeInput.current.value);
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
        } else {
            const error = await response.json();
            showErrorModal(JSON.stringify(error));
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

    // Buttons used to add bulk events to plants in group
    const PlantEventButtons = ({editing, setEditing}) => {
        const addEventTimeInput = useRef(null);

        // Handler for water button (only used in this case scope)
        const water = async () => {
            const timestamp = localToUTC(addEventTimeInput.current.value);
            await bulkAddPlantEvents('water', selectedPlants.current, timestamp);
            setEditing(false);
        };

        // Handler for fertilize button (only used in this case scope)
        const fertilize = async () => {
            const timestamp = localToUTC(addEventTimeInput.current.value);
            await bulkAddPlantEvents('fertilize', selectedPlants.current, timestamp);
            setEditing(false);
        };

        switch(editing) {
            case(true):
                return (
                    <>
                        <div
                            className="flex mx-auto mb-4"
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
                                onClick={water}
                            >
                                Water
                            </button>
                            <button
                                className="btn btn-outline btn-success mx-auto"
                                onClick={fertilize}
                            >
                                Fertilize
                            </button>
                        </div>
                    </>
                );
            case(false):
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
        editing: PropTypes.bool,
        setEditing: PropTypes.func
    };

    return (
        <div className="container flex flex-col mx-auto mb-8">
            <Navbar
                menuOptions={
                    <>
                        <li><a onClick={() => window.location.href = "/"}>
                            Overview
                        </a></li>
                        <li><a onClick={openAddPlantsModal}>
                            Add plants
                        </a></li>
                        <li><a onClick={openRemovePlantsModal}>
                            Remove plants
                        </a></li>
                        <li><a onClick={openChangeQrModal}>
                            Change QR code
                        </a></li>
                        <ToggleThemeOption />
                    </>
                }
                title={group.display_name}
                titleOptions={
                    <DetailsCard>
                        <GroupDetails
                            location={group.location}
                            description={group.description}
                        />
                    </DetailsCard>
                }
            />

            <DatetimeInput inputRef={addEventAllTimeInput} />
            <div className="flex mx-auto mb-8">
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

            <FilterColumn
                title="Plants"
                contents={plantDetails}
                CardComponent={PlantCard}
                editing={selectingPlants}
                selected={selectedPlants}
                openRef={plantsOpenRef}
                ignoreKeys={[
                    'uuid',
                    'created',
                    'last_watered',
                    'last_fertilized',
                    'thumbnail'
                ]}
                sortByKeys={[
                    {key: 'created', display: 'Added'},
                    {key: 'display_name', display: 'Name'},
                    {key: 'species', display: 'Species'},
                    {key: 'last_watered', display: 'Watered'}
                ]}
                defaultSortKey={'created'}
            >
                <PlantEventButtons
                    editing={selectingPlants}
                    setEditing={setSelectingPlants}
                />
            </FilterColumn>

            <EditModal title="Edit Details" onSubmit={submitEditModal}>
                <GroupDetailsForm
                    formRef={editDetailsRef}
                    name={group.name}
                    location={group.location}
                    description={group.description}
                />
            </EditModal>

            <AddPlantsModal
                groupID={group.uuid}
                options={options}
                plantDetails={plantDetails}
                setPlantDetails={setPlantDetails}
            />

            <RemovePlantsModal
                groupID={group.uuid}
                plantDetails={plantDetails}
                setPlantDetails={setPlantDetails}
            />

            <ChangeQrModal
                uuid={group.uuid}
            />
        </div>
    );
}

export default App;
