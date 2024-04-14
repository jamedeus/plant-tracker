import React, { useState, useRef } from 'react';
import PropTypes from 'prop-types';
import { DateTime } from 'luxon';
import { sendPostRequest, parseDomContext, localToUTC, timestampToRelative } from 'src/util';
import CollapseCol from 'src/components/CollapseCol';
import EditableNodeList from 'src/components/EditableNodeList';
import EditModal from 'src/components/EditModal';
import PlantDetailsForm from 'src/forms/PlantDetailsForm';
import Navbar from 'src/components/Navbar';
import DatetimeInput from 'src/components/DatetimeInput';
import { useToast } from 'src/context/ToastContext';
import { useTheme } from 'src/context/ThemeContext';
import DetailsCard from 'src/components/DetailsCard';
import LastEventTime from 'src/components/LastEventTime';
import PlantDetails from 'src/components/PlantDetails';
import EventCalendar from './EventCalendar';
import PhotoCard from './PhotoCard';
import TrayModal, { openTrayModal } from './TrayModal';
import PhotoModal, { openPhotoModal } from './PhotoModal';
import RepotModal, { openRepotModal } from './RepotModal';

function App() {
    // Load context set by django template
    const [plant, setPlant] = useState(() => {
        return parseDomContext("plant");
    });
    const [photoUrls, setPhotoUrls] = useState(() => {
        return parseDomContext("photo_urls");
    });
    const trays = parseDomContext("trays");
    const speciesOptions = parseDomContext("species_options");

    // Get hook to show toast message
    const { showToast } = useToast();

    // Create refs to track event history collapse open state between re-renders
    const waterHistoryOpen = useRef(false);
    const fertilizeHistoryOpen = useRef(false);
    const photoHistoryOpen = useRef(false);

    // Create ref to access new event datetime input
    const eventTimeInput = useRef(null);

    // Create ref to access edit details form
    const editDetailsRef = useRef(null);

    // Takes photo URLs from API response when new photos are uploaded
    const addPlantPhotoUrls = (newUrls) => {
        // Add new URLs to photoUrl state, sort chronologically, re-render
        const newPhotoUrls = photoUrls.concat(newUrls);
        newPhotoUrls.sort((a, b) => {
            return a.created.localeCompare(b.created);
        }).reverse();
        setPhotoUrls(newPhotoUrls);
    };

    // Called after successful repot_plant API call, takes RepotEvent params
    const handleRepot = (newPotSize, repotTimestamp) => {
        // Update state with new pot_size and event timestamp
        let newPlant = {...plant, pot_size: newPotSize};
        newPlant.events['repot'].push(repotTimestamp);
        newPlant.events['repot'].sort().reverse();
        setPlant(newPlant);
    };

    // Called after successful add_plant_to_tray API call, takes name and UUID
    const handleAddTray = (newTrayName, newTrayID) => {
        setPlant({...plant,
            tray: {
                name: newTrayName,
                uuid: newTrayID
            }
        });
    };

    const submitEditModal = async () => {
        const payload = Object.fromEntries(
            new FormData(editDetailsRef.current)
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
            timestamp: localToUTC(eventTimeInput.current.value)
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
            <div className="card card-compact bg-neutral text-neutral-content">
                <div className="card-body text-center">
                    <p className="text-lg font-bold">
                        {timestampToRelative(timestamp)}
                    </p>
                    <p>
                        {DateTime.fromISO(
                            timestamp
                        ).toFormat("h:mm\u202Fa MMMM dd, yyyy")}
                    </p>
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
                        <button
                            className="btn btn-outline mx-auto"
                            onClick={() => setEditing(false)}
                        >
                            Cancel
                        </button>
                        <button
                            className="btn btn-outline btn-error mx-auto"
                            onClick={() => handleDelete()}
                        >
                            Delete
                        </button>
                    </div>
                );
            case(false):
                return (
                    <div className="flex mt-4">
                        <button
                            className="btn btn-outline mx-auto"
                            onClick={() => setEditing(true)}
                        >
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
    const EventsCol = ({ title, events, type, openRef }) => {
        // Create edit mode state + ref to track selected events while editing
        const [editing, setEditing] = useState(false);
        const selected = useRef([]);

        // Delete button handler
        const onDelete = () => {
            selected.current.forEach(async timestamp => {
                await deleteEvent(timestamp, type);
            });
            setEditing(false);
        };

        return (
            <CollapseCol title={title} openRef={openRef} scroll={true}>
                <div className="max-h-half-screen overflow-scroll no-scrollbar">
                    <EditableNodeList
                        editing={editing}
                        selected={selected}
                    >
                        {events.map((timestamp) => {
                            return (
                                <EventCard
                                    key={timestamp}
                                    timestamp={timestamp}
                                />
                            );
                        })}
                    </EditableNodeList>
                </div>
                <EventHistoryButtons
                    editing={editing}
                    setEditing={setEditing}
                    handleDelete={onDelete}
                />
            </CollapseCol>
        );
    };

    EventsCol.propTypes = {
        title: PropTypes.string,
        events: PropTypes.array,
        type: PropTypes.string,
        openRef: PropTypes.object
    };

    const PhotoHistory = () => {
        // Create edit mode state + ref to track selected photos while editing
        const [editing, setEditing] = useState(false);
        const selected = useRef([]);

        // Delete button handler
        const onDelete = async () => {
            // Build payload with plant UUID and array of selected photo IDs
            const payload = {
                plant_id: plant.uuid,
                delete_photos: selected.current.map(key => parseInt(key))
            };
            const response = await sendPostRequest('/delete_plant_photos', payload);
            // If successful remove photos from history column
            if (response.ok) {
                const data = await response.json();
                let oldPhotoUrls = [...photoUrls];
                setPhotoUrls(oldPhotoUrls.filter(
                    photo => !data.deleted.includes(photo.key)
                ));
            }
        };

        return (
            <CollapseCol title={"Photos"} openRef={photoHistoryOpen}>
                <EditableNodeList
                    editing={editing}
                    selected={selected}
                >
                    {photoUrls.map((photo) => {
                        return (
                            <PhotoCard
                                key={photo.key}
                                image_url={photo.image}
                                thumbnail_url={photo.thumbnail}
                                created={photo.created}
                            />
                        );
                    })}
                </EditableNodeList>
                <EventHistoryButtons
                    editing={editing}
                    setEditing={setEditing}
                    handleDelete={onDelete}
                />
            </CollapseCol>
        );
    };

    const DropdownOptions = () => {
        // Get toggle theme option from context
        const { ToggleThemeOption } = useTheme();

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

        // Options shown when plant is not in tray
        const AddTray = () => {
            return (
                <li><a onClick={openTrayModal}>
                    Add to tray
                </a></li>
            );
        };

        // Options shown when plant is in tray
        const RemoveTray = () => {
            return (
                <>
                    <li><a href={"/manage/" + plant.tray.uuid}>
                        Go to tray
                    </a></li>
                    <li><a onClick={removeFromTray}>
                        Remove from tray
                    </a></li>
                </>
            );
        };

        return (
            <>
                <li><a onClick={() => window.location.href = "/"}>
                    Overview
                </a></li>
                {(() => {
                    switch(plant.tray) {
                        case(null):
                            return <AddTray />;
                        default:
                            return <RemoveTray />;
                    }
                })()}
                <li><a onClick={openRepotModal}>
                    Repot plant
                </a></li>
                <li><a onClick={openPhotoModal}>
                    Upload photos
                </a></li>
                <ToggleThemeOption />
            </>
        );
    };

    // Renders div with link to tray if plant is in tray
    const PlantTraySection = () => {
        switch(plant.tray) {
            case(null):
                return null;
            default:
                return (
                    <div className={`card card-compact mb-8 mx-auto bg-base-200
                                     text-center px-8`}
                    >
                        <div className="card-body">
                            <p className="text-sm">Plant is in tray:</p>
                            <p className="text-xl font-bold">
                                <a href={"/manage/" + plant.tray.uuid}>
                                    { plant.tray.name }
                                </a>
                            </p>
                        </div>
                    </div>
                );
        }
    };

    return (
        <div className="container flex flex-col mx-auto mb-8">
            <Navbar
                menuOptions={
                    <DropdownOptions />
                }
                title={plant.display_name}
                titleOptions={
                    <DetailsCard>
                        <PlantDetails
                            species={plant.species}
                            pot_size={plant.pot_size}
                            description={plant.description}
                        />
                    </DetailsCard>
                }
            />

            <PlantTraySection />

            <div className="flex flex-col text-center">
                <span className="text-lg">
                    <LastEventTime
                        text="watered"
                        timestamp={plant.events.water[0]}
                    />
                </span>
                <span className="text-lg">
                    <LastEventTime
                        text="fertilized"
                        timestamp={plant.events.fertilize[0]}
                    />
                </span>
                <DatetimeInput inputRef={eventTimeInput} />
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
                    <button
                        className="btn btn-prune m-2"
                        onClick={() => addEvent('prune')}
                    >
                        Prune
                    </button>
                </div>
            </div>

            <div className="mx-auto my-16">
                <EventCalendar events={plant.events} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 mx-auto">
                <div className="md:mr-8 mb-8">
                    <EventsCol
                        title="Water History"
                        events={plant.events.water}
                        type="water"
                        openRef={waterHistoryOpen}
                    />
                </div>

                <div className="md:ml-8 mb-8">
                    <EventsCol
                        title="Fertilize History"
                        events={plant.events.fertilize}
                        type="fertilize"
                        openRef={fertilizeHistoryOpen}
                    />
                </div>
            </div>

            <PhotoHistory />

            <EditModal title="Edit Details" onSubmit={submitEditModal}>
                <PlantDetailsForm
                    formRef={editDetailsRef}
                    name={plant.name}
                    species={plant.species}
                    pot_size={plant.pot_size}
                    description={plant.description}
                    species_options={speciesOptions}
                />
            </EditModal>

            <TrayModal
                plantID={plant.uuid}
                trayOptions={trays}
                handleAddTray={handleAddTray}
            />

            <RepotModal
                plantID={plant.uuid}
                currentPotSize={plant.pot_size}
                handleRepot={handleRepot}
            />

            <PhotoModal
                plantID={plant.uuid}
                addPlantPhotoUrls={addPlantPhotoUrls}
            />
        </div>
    );
}

export default App;
