import React, { useState, useRef, Fragment } from 'react';
import PropTypes from 'prop-types';
import Cookies from 'js-cookie';
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
import Modal from 'src/components/Modal';
import { RadioGroup } from '@headlessui/react';
import LastEventTime from 'src/components/LastEventTime';
import PlantDetails from 'src/components/PlantDetails';
import EventCalendar from './EventCalendar';

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

    // Create ref for modal used to add plant to tray
    const trayModalRef = useRef(null);
    // Create ref for modal used to create RepotEvent
    const repotModalRef = useRef(null);
    // Create ref for modal used to upload photos
    const photoModalRef = useRef(null);

    // Create refs to track event history collapse open state between re-renders
    const waterHistoryOpen = useRef(false);
    const fertilizeHistoryOpen = useRef(false);
    const photoHistoryOpen = useRef(false);

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
                    <p>{DateTime.fromISO(timestamp).toFormat("h:mm\u202Fa MMMM dd, yyyy")}</p>
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
                            return <EventCard key={timestamp} timestamp={timestamp} />;
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
        const PhotoCard = ({url, created}) => {
            return (
                <div className="card card-compact bg-neutral text-neutral-content mb-4 p-2">
                    <a href={url}>
                        <p className="text-lg text-center font-bold mb-2" title={created}>
                            {timestampToRelative(
                                DateTime.fromFormat(created, 'yyyy:MM:dd HH:mm:ss').toISO()
                            )}
                        </p>
                        <img className="rounded-2xl" src={url} alt={created} />
                    </a>
                </div>
            );
        };

        PhotoCard.propTypes = {
            url: PropTypes.string,
            created: PropTypes.string
        };

        return (
            <CollapseCol title={"Photos"} openRef={photoHistoryOpen}>
                {photoUrls.map((photo, index) => {
                    return <PhotoCard key={index} url={photo.url} created={photo.created} />;
                })}
            </CollapseCol>
        );
    };

    const DropdownOptions = () => {
        // Get toggle theme option from context
        const { ToggleThemeOption } = useTheme();

        const overview = () => {
            window.location.href = "/";
        };

        const openTrayModal = () => {
            trayModalRef.current.showModal();
        };

        const openRepotModal = () => {
            repotModalRef.current.showModal();
        };

        const openPhotoModal = () => {
            photoModalRef.current.showModal();
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

        // Options shown when plant is not in tray
        const AddTray = () => {
            return <li><a onClick={openTrayModal}>Add to tray</a></li>;
        };

        // Options shown when plant is in tray
        const RemoveTray = () => {
            return (
                <>
                    <li><a href={"/manage/" + plant.tray.uuid}>Go to tray</a></li>
                    <li><a onClick={removeFromTray}>Remove from tray</a></li>
                </>
            );
        };

        return (
            <>
                <li><a onClick={overview}>Overview</a></li>
                {(() => {
                    switch(plant.tray) {
                        case(null):
                            return <AddTray />;
                        default:
                            return <RemoveTray />;
                    }
                })()}
                <li><a onClick={openRepotModal}>Repot plant</a></li>
                <li><a onClick={openPhotoModal}>Upload photos</a></li>
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
                    <div className="card card-compact mb-8 mx-auto bg-base-200 text-center px-8">
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
            trayModalRef.current.close();
        };

        return (
            <Modal dialogRef={trayModalRef}>
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

    const RepotModal = () => {
        const potSizes = [2, 3, 4, 6, 8, 10, 12, 14, 18, 21];

        // Default to next size if plant.pot_size set, otherwise default to 2in
        const [selected, setSelected] = useState((() => {
            if (plant.pot_size && potSizes.includes(plant.pot_size)) {
                return potSizes[potSizes.indexOf(plant.pot_size) + 1];
            } else {
                return 2;
            }
        })());

        // Access custom pot size input value
        const customPotRef = useRef(null);

        // Takes integer pot size, renders round div with number centered
        const PotSizeOption = ({ option }) => {
            return (
                <RadioGroup.Option value={option} as={Fragment}>
                    {({ checked }) => (
                        <div
                            className={`pot-size w-10 h-10 md:w-12 md:h-12 ${
                                checked ? 'pot-size-selected' : 'bg-base-300'
                            }`}
                        >
                            <span className="m-auto">{option}</span>
                        </div>
                    )}
                </RadioGroup.Option>
            );
        };

        PotSizeOption.propTypes = {
            option: PropTypes.number
        };

        const isInt = (value) => {
            return !isNaN(value) &&
            parseInt(Number(value)) == value &&
            !isNaN(parseInt(value, 10));
        };

        // Post user selection to backend, create RepotEvent in database
        const submit = async () => {
            const payload = {
                plant_id: plant.uuid,
                new_pot_size: null,
                timestamp: document.getElementById("repotTime").value
            };

            // Selected will be integer value of chosen option, or "custom" if
            // the custom pot size input is selected
            if (isInt(selected)) {
                payload.new_pot_size = parseInt(selected);
            } else {
                payload.new_pot_size = parseInt(customPotRef.current.value);
            }

            const response = await sendPostRequest('/repot_plant', payload);
            if (response.ok) {
                // Update plant state pot_size
                setPlant({...plant, pot_size: payload.new_pot_size});

                // Add repot event to history state, sort chronologically
                let oldPlant = {...plant};
                oldPlant.events['repot'].push(payload.timestamp);
                oldPlant.events['repot'].sort().reverse();
                setPlant(oldPlant);
            } else {
                const data = await response.json();
                alert(data);
            }
        };

        return (
            <Modal dialogRef={repotModalRef}>
                <p className="text-lg mb-8">Repot plant</p>

                <div>
                    <p>Repot time</p>
                    <DatetimeInput id="repotTime" />
                </div>

                <div className="my-8">
                    <p className="text-md">New pot size</p>
                    <RadioGroup
                        value={selected}
                        onChange={setSelected}
                        className="flex flex-col"
                    >
                        <div className="flex justify-center mx-auto">
                            {potSizes.slice(0, 5).map((option) => (
                                <PotSizeOption key={option} option={option} />
                            ))}
                        </div>
                        <div className="flex justify-center mx-auto">
                            {potSizes.slice(5).map((option) => (
                                <PotSizeOption key={option} option={option} />
                            ))}
                        </div>
                        <div className="flex justify-center mx-auto">
                            <RadioGroup.Option value="custom" as={Fragment}>
                                {({ checked }) => (
                                    <input
                                        ref={customPotRef}
                                        className={`pot-size w-32 ${checked ?
                                            'pot-size-selected' : 'bg-base-300'
                                        }`}
                                        placeholder="custom"
                                    />
                                )}
                            </RadioGroup.Option>
                        </div>
                    </RadioGroup>
                </div>

                <button className="btn btn-success mx-auto" onClick={submit}>
                    Repot
                </button>
            </Modal>
        );
    };

    const PhotoModal = () => {
        const [selectedFiles, setSelectedFiles] = useState([]);

        const handleSelect = (event) => {
            setSelectedFiles(Array.from(event.target.files));
        };

        const handleSubmit = async () => {
            // Create FormData containing all photos + plant UUID
            const formData = new FormData();
            selectedFiles.forEach((file, index) => {
                formData.append(`photo_${index}`, file);
            });
            formData.append('plant_id', plant.uuid);

            // Post FormData to backend
            const response = await fetch('/add_plant_photos', {
                method: 'POST',
                body: formData,
                headers: {
                    'Accept': 'application/json, text/plain, */*',
                    "X-CSRFToken": Cookies.get('csrftoken')
                }
            });

            if (response.ok) {
                const data = await response.json();

                // Update state with new photo URLs from response
                const newPhotoUrls = photoUrls.concat(data.urls);
                newPhotoUrls.sort((a, b) => {
                    return a.created.localeCompare(b.created);
                }).reverse();
                setPhotoUrls(newPhotoUrls);

                // Close modal
                photoModalRef.current.close();
            } else {
                alert("Upload failed!");
            }
        };

        return (
            <Modal dialogRef={photoModalRef}>
                <p className="text-lg mb-6">Upload Photos</p>

                <div className="h-36 flex flex-col justify-center mx-auto">
                    <input
                        type="file"
                        accept="image/*"
                        multiple="multiple"
                        className="file-input file-input-bordered w-full max-w-xs"
                        onChange={handleSelect}
                        data-testid="photo-input"
                    />
                </div>

                <div className="modal-action mx-auto">
                    <button
                        className="btn btn-success"
                        onClick={handleSubmit}
                        disabled={!selectedFiles.length}
                    >
                        Upload
                    </button>
                </div>

            </Modal>
        );
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
                    name={plant.name}
                    species={plant.species}
                    pot_size={plant.pot_size}
                    description={plant.description}
                    species_options={speciesOptions}
                />
            </EditModal>

            <AddToTrayModal />

            <RepotModal />

            <PhotoModal />
        </div>
    );
}

export default App;
