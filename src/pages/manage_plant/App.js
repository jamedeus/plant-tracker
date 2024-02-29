import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { DateTime } from 'luxon';
import { sendPostRequest, parseDomContext, localToUTC, timestampToRelative } from 'src/util';
import CollapseCol from 'src/components/CollapseCol';
import EditableNodeList from 'src/components/EditableNodeList';
import EditModal from 'src/components/EditModal';
import PlantDetails from 'src/forms/PlantDetails';
import Navbar from 'src/components/Navbar';
import DatetimeInput from 'src/components/DatetimeInput';
import { useToast } from 'src/ToastContext';
import DetailsCard from 'src/components/DetailsCard';
import Modal from 'src/components/Modal';

function App() {
    // Load context set by django template
    const [plant, setPlant] = useState(() => {
        return parseDomContext("plant");
    });
    const trays = parseDomContext("trays");
    const speciesOptions = parseDomContext("species_options");

    // Get hook to show toast message
    const { showToast } = useToast();

    const submitEditModal = async () => {
        const payload = Object.fromEntries(
            new FormData(document.getElementById('plantDetails'))
        );
        payload["plant_id"] = plant.uuid;

        const response = await sendPostRequest('/edit_plant', payload);
        if (response.ok) {
            // Update plant state with new values from response
            const data = await response.json();
            setPlant({...plant, ...data});
        }
    };

    // Handler for water and fertilize buttons
    // Takes event type, creates event in database, adds timestamp to state
    const addEvent = async (eventType) => {
        const payload = {
            plant_id: plant.uuid,
            event_type: eventType,
            timestamp: localToUTC(document.getElementById("eventTime").value)
        };
        const response = await sendPostRequest('/add_plant_event', payload);
        if (response.ok) {
            // Add new event to correct history column, sort chronologically
            let oldPlant = {...plant};
            oldPlant.events[eventType].push(payload.timestamp);
            oldPlant.events[eventType].sort().reverse();
            setPlant(oldPlant);
        } else {
            // Duplicate event timestamp: show error toast for 5 seconds
            if (response.status === 409) {
                showToast(
                    `Error: ${eventType} event with same timestamp already exists`,
                    'red',
                    5000
                );
            // Other error (unexpected): show in alert
            } else {
                const data = await response.json();
                alert(data);
            }
        }
    };

    // Takes event timestamp and types, sends delete request to backend
    // If successful removes timestamp from react state to re-render history
    const deleteEvent = async (timestamp, type) => {
        const payload = {
            plant_id: plant.uuid,
            event_type: type,
            timestamp: timestamp
        };
        const response = await sendPostRequest('/delete_plant_event', payload);
        // If successful remove event from history column
        if (response.ok) {
            removeEvent(timestamp, type);
        }
    };

    // Takes timestamp and eventType, removes timestamp from plant.events state
    const removeEvent = (timestamp, eventType) => {
        let oldPlant = {...plant};
        oldPlant.events[eventType].splice(
            oldPlant.events[eventType].indexOf(timestamp),
            1
        );
        setPlant(oldPlant);
    };

    // Displays timestamp and relative time in event history sections
    const EventCard = ({ timestamp }) => {
        return (
            <div className="card card-compact bg-neutral text-neutral-content text-center">
                <div className="card-body">
                    <p className="text-lg font-bold">{timestampToRelative(timestamp)}</p>
                    <p>{DateTime.fromISO(timestamp).toFormat('t MMMM dd, yyyy')}</p>
                </div>
            </div>
        );
    };

    EventCard.propTypes = {
        timestamp: PropTypes.string
    };

    // Takes state bool, function to set state bool, delete button handler
    // Shows edit button when bool is false, cancel and delete buttons when true
    // Rendered at the bottom of water/fertilize event history columns
    const EventHistoryButtons = ({editing, setEditing, handleDelete}) => {
        switch(editing) {
            case(true):
                return (
                    <div className="flex mt-4">
                        <button className="btn btn-outline mx-auto" onClick={() => setEditing(false)}>
                            Cancel
                        </button>
                        <button className="btn btn-outline btn-error mx-auto" onClick={() => handleDelete()}>
                            Delete
                        </button>
                    </div>
                );
            case(false):
                return (
                    <div className="flex mt-4">
                        <button className="btn btn-outline mx-auto" onClick={() => setEditing(true)}>
                            Edit
                        </button>
                    </div>
                );
        }
    };

    EventHistoryButtons.propTypes = {
        editing: PropTypes.bool,
        setEditing: PropTypes.func,
        handleDelete: PropTypes.func,
    };

    // Takes events array (eg plant.water_events) and type (water or fertilize)
    // Renders EditableNodeList with edit + delete button and handlers
    const EventsCol = ({ events, type }) => {
        // Create states for editing state, selected events
        const [editing, setEditing] = useState(false);
        const [selected, setSelected] = useState([]);

        // Delete button handler
        const onDelete = () => {
            selected.forEach(async timestamp => {
                await deleteEvent(timestamp, type);
            });
            setEditing(false);
        };

        return (
            <>
                <div className="max-h-half-screen overflow-scroll no-scrollbar">
                    <EditableNodeList editing={editing} selected={selected} setSelected={setSelected}>
                        {events.map((timestamp) => {
                            return <EventCard key={timestamp} timestamp={timestamp} />;
                        })}
                    </EditableNodeList>
                </div>
                <EventHistoryButtons
                    editing={editing}
                    setEditing={setEditing}
                    handleDelete={onDelete}
                />
            </>
        );
    };

    EventsCol.propTypes = {
        events: PropTypes.array,
        type: PropTypes.string
    };

    const DropdownOptions = () => {
        const overview = () => {
            window.location.href = "/";
        };

        const openTrayModal = () => {
            document.getElementById('addToTrayModal').showModal();
        };

        const removeFromTray = async () => {
            const response = await sendPostRequest(
                '/remove_plant_from_tray',
                {plant_id: plant.uuid}
            );
            if (response.ok) {
                // Remove tray details from plant state
                setPlant({...plant, tray: null});
            }
        };

        switch(plant.tray) {
            case(null):
                return (
                    <>
                        <li><a onClick={overview}>Overview</a></li>
                        <li><a onClick={openTrayModal}>Add to tray</a></li>
                    </>
                )
            default:
                return (
                    <>
                        <li><a onClick={overview}>Overview</a></li>
                        <li><a href={"/manage/" + plant.tray.uuid}>Go to tray</a></li>
                        <li><a onClick={removeFromTray}>Remove from tray</a></li>
                    </>
                )
        }
    };

    // Renders div with link to tray if plant is in tray
    const PlantTraySection = () => {
        switch(plant.tray) {
            case(null):
                return null;
            default:
                return (
                    <div className="card card-compact mb-8 mx-auto bg-base-200 text-center px-8">
                        <div className="card-body">
                            <p className="text-sm">Plant is in tray:</p>
                            <p className="text-xl font-bold"><a href={"/manage/" + plant.tray.uuid}>
                                { plant.tray.name }
                            </a></p>
                        </div>
                    </div>
                );
        }
    };

    const AddToTrayModal = () => {
        // Handler for confirm button
        const addToTray = async () => {
            const payload = {
                plant_id: plant.uuid,
                tray_id: document.getElementById('traySelect').value
            };
            const response = await sendPostRequest('/add_plant_to_tray', payload);
            if (response.ok) {
                // Update plant state with tray name and UUID from response
                const data = await response.json();
                setPlant({...plant,
                    tray: {
                        name: data.tray_name,
                        uuid: data.tray_uuid
                    }
                });
            }
            // Close modal
            document.getElementById('addToTrayModal').close();
        };

        return (
            <Modal id="addToTrayModal">
                <p className="text-lg">Add plant to tray</p>
                <select
                    id="traySelect"
                    defaultValue=""
                    className="select select-bordered m-8"
                >
                    <option value="" disabled>Select tray</option>
                    {trays.map(tray => {
                        return <option key={tray.uuid} value={tray.uuid}>{tray.name}</option>;
                    })}
                </select>
                <button
                    className="btn btn-success mx-auto"
                    onClick={addToTray}
                >
                    Confirm
                </button>
            </Modal>
        );
    };

    return (
        <div className="container flex flex-col mx-auto mb-8">
            <Navbar
                dropdownOptions={
                    <DropdownOptions />
                }
                title={
                    <div className="dropdown">
                        <a tabIndex={0} role="button" className="btn btn-ghost text-3xl">{plant.display_name}</a>
                        <div tabIndex={0} className="dropdown-content z-[1] flex w-full">
                            <DetailsCard>
                                <p>Species: {plant.species}</p>
                                <p>Pot size: {plant.pot_size} inches</p>
                                <p>Description: {plant.description}</p>
                            </DetailsCard>
                        </div>
                    </div>
                }
            />

            <PlantTraySection />

            <div className="flex flex-col text-center">
                <span className="text-lg">
                    Last Watered: {timestampToRelative(plant.events.water[0])}
                </span>
                <span className="text-lg">
                    Last Fertilized: {timestampToRelative(plant.events.fertilize[0])}
                </span>
                <DatetimeInput id="eventTime" />
                <div className="flex mx-auto">
                    <button
                        className="btn btn-info m-2"
                        onClick={() => addEvent('water')}
                    >
                        Water
                    </button>
                    <button
                        className="btn btn-success m-2"
                        onClick={() => addEvent('fertilize')}
                    >
                        Fertilize
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 mx-auto mt-16">
                <div className="md:mr-8 mb-8 md:mb-0">
                    <CollapseCol title="Water History" defaultOpen={false}>
                        <EventsCol events={plant.events.water} type="water" />
                    </CollapseCol>
                </div>

                <div className="md:ml-8">
                    <CollapseCol title="Fertilize History" defaultOpen={false}>
                        <EventsCol events={plant.events.fertilize} type="fertilize" />
                    </CollapseCol>
                </div>
            </div>

            <EditModal title="Edit Details" onSubmit={submitEditModal}>
                <PlantDetails
                    name={plant.name}
                    species={plant.species}
                    pot_size={plant.pot_size}
                    description={plant.description}
                    species_options={speciesOptions}
                />
            </EditModal>

            <AddToTrayModal />
        </div>
    );
}

export default App;
