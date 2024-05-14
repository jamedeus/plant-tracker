import React, { useState, useRef } from 'react';
import { sendPostRequest, parseDomContext, localToUTC } from 'src/util';
import EditModal from 'src/components/EditModal';
import PlantDetailsForm from 'src/forms/PlantDetailsForm';
import Navbar from 'src/components/Navbar';
import { DateTime } from 'luxon';
import DatetimeInput from 'src/components/DatetimeInput';
import { useToast } from 'src/context/ToastContext';
import { useTheme } from 'src/context/ThemeContext';
import DetailsCard from 'src/components/DetailsCard';
import LastEventTime from 'src/components/LastEventTime';
import PlantDetails from 'src/components/PlantDetails';
import EventCalendar from './EventCalendar';
import NoteModal from './NoteModal';
import TrayModal, { openTrayModal } from './TrayModal';
import PhotoModal, { openPhotoModal } from './PhotoModal';
import RepotModal, { openRepotModal } from './RepotModal';
import EventHistoryModal from './EventHistoryModal';
import DefaultPhotoModal, { openDefaultPhotoModal } from './DefaultPhotoModal';
import DeletePhotosModal from './DeletePhotosModal';
import { useErrorModal } from 'src/context/ErrorModalContext';
import Timeline from './Timeline';

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

    // Get hooks to show toast message, error modal
    const { showToast } = useToast();
    const { showErrorModal } = useErrorModal();

    // Create ref to access new event datetime input
    const eventTimeInput = useRef(null);

    // Create ref to access edit details form
    const editDetailsRef = useRef(null);

    // Create ref and states for NoteModal input contents
    const noteModalRef = useRef(null);
    const [noteText, setNoteText] = useState('');
    const [noteTime, setNoteTime] = useState('');
    const [editingNote, setEditingNote] = useState(false);

    // Call with no arg to open empty modal (add new note)
    // Call with existing note object (text and timestamp keys) to edit note
    const openNoteModal = (editNote=null) => {
        if (editNote) {
            setNoteText(editNote.text);
            setNoteTime(editNote.timestamp);
            setEditingNote(true);
        } else {
            setNoteText('');
            setEditingNote(false);
        }
        noteModalRef.current.showModal();
    };

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
        } else {
            const error = await response.json();
            showErrorModal(JSON.stringify(error));
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
            // Other error (unexpected): show in error modal
            } else {
                const error = await response.json();
                showErrorModal(JSON.stringify(error));
            }
        }
    };

    // Called after successful add_plant_note API call, updates state
    const addNote = (timestamp, text) => {
        let oldPlant = {...plant};
        oldPlant.notes.push({timestamp: timestamp, text: text});
        setPlant(oldPlant);
    };

    // Called after successful delete_plant_note API call, updates state
    const removeNote = (timestamp) => {
        setPlant({
            ...plant,
            notes: plant.notes.filter(
                note => note.timestamp !== timestamp
            )
        });
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
            } else {
                const error = await response.json();
                showErrorModal(JSON.stringify(error));
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
                <li><a onClick={openDefaultPhotoModal}>
                    Set default photo
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

            <div className="mx-auto my-8">
                <EventCalendar events={plant.events} />
            </div>

            <Timeline
                events={plant.events}
                notes={plant.notes}
                photoUrls={photoUrls}
                openNoteModal={openNoteModal}
            />

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

            <DefaultPhotoModal
                plantID={plant.uuid}
                photoUrls={photoUrls}
            />

            <DeletePhotosModal
                plantID={plant.uuid}
                photoUrls={photoUrls}
                setPhotoUrls={setPhotoUrls}
            />

            <EventHistoryModal
                plant={plant}
                setPlant={setPlant}
            />

            <NoteModal
                plantID={plant.uuid}
                addNote={addNote}
                removeNote={removeNote}
                modalRef={noteModalRef}
                noteText={noteText}
                noteTime={noteTime}
                editingNote={editingNote}
            />
        </div>
    );
}

export default App;
