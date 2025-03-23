import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import PropTypes from 'prop-types';
import { localToUTC } from 'src/timestampUtils';
import { sendPostRequest, parseDomContext } from 'src/util';
import EditModal from 'src/components/EditModal';
import PlantDetailsForm from 'src/forms/PlantDetailsForm';
import Navbar from 'src/components/Navbar';
import DatetimeInput from 'src/components/DatetimeInput';
import { showToast } from 'src/components/Toast';
import { useTheme } from 'src/context/ThemeContext';
import DetailsCard from 'src/components/DetailsCard';
import LastEventTime from 'src/components/LastEventTime';
import PlantDetails from 'src/components/PlantDetails';
import IconButton from 'src/components/IconButton';
import EventCalendar from './EventCalendar';
import GroupModal, { openGroupModal, closeGroupModal } from './GroupModal';
import RepotModal from './RepotModal';
import ChangeQrModal, { openChangeQrModal } from 'src/components/ChangeQrModal';
import EventHistoryModal from './EventHistoryModal';
import { openDefaultPhotoModal, preloadDefaultPhotoModal } from './DefaultPhotoModal';
import { openErrorModal } from 'src/components/ErrorModal';
import Timeline from './Timeline';
import { faPlus, faBan, faUpRightFromSquare } from '@fortawesome/free-solid-svg-icons';

const EventButtons = ({ events, addEvent }) => {
    // Create ref to access new event datetime input
    const eventTimeInput = useRef(null);

    return (
        <div className="flex flex-col text-center">
            <span className="text-lg">
                <LastEventTime
                    text="watered"
                    timestamp={events.water[0]}
                />
            </span>
            <span className="text-lg">
                <LastEventTime
                    text="fertilized"
                    timestamp={events.fertilize[0]}
                />
            </span>
            <DatetimeInput inputRef={eventTimeInput} />
            <div className="flex mx-auto">
                <button
                    className="btn btn-info m-2"
                    onClick={() => addEvent('water', eventTimeInput.current.value)}
                >
                    Water
                </button>
                <button
                    className="btn btn-success m-2"
                    onClick={() => addEvent('fertilize', eventTimeInput.current.value)}
                >
                    Fertilize
                </button>
                <button
                    className="btn btn-prune m-2"
                    onClick={() => addEvent('prune', eventTimeInput.current.value)}
                >
                    Prune
                </button>
            </div>
        </div>
    );
};

EventButtons.propTypes = {
    events: PropTypes.object.isRequired,
    addEvent: PropTypes.func.isRequired
};

const DropdownOptions = memo(function DropdownOptions({ plant }) {
    // Get toggle theme option from context
    const { ToggleThemeOption } = useTheme();

    return (
        <>
            <li><a onClick={() => window.location.href = "/"}>
                Overview
            </a></li>
            {!plant.archived && (
                <>
                    {plant.group &&
                        <li><a href={"/manage/" + plant.group.uuid}>
                            Go to group
                        </a></li>
                    }
                    <li><a onClick={openDefaultPhotoModal}>
                        Set default photo
                    </a></li>
                    <li><a onClick={openChangeQrModal}>
                        Change QR code
                    </a></li>
                </>
            )}
            <ToggleThemeOption />
        </>
    );
});

DropdownOptions.propTypes = {
    plant: PropTypes.object.isRequired
};

// Contents of dropdown shown when plant name clicked in header
const DetailsDropdown = memo(function DetailsDropdown({ plant, handleRemoveGroup }) {
    return (
        <DetailsCard>
            <div className="flex flex-col">
                <div className="divider font-bold mt-0">Group</div>
                {/* Group details if in group, add group button if not */}
                {plant.group ? (
                    <div className="flex flex-col text-center">
                        <a
                            className="font-bold text-lg"
                            href={`/manage/${plant.group.uuid}`}
                        >
                            { plant.group.name }
                        </a>
                        <div className="flex gap-2 mx-auto mt-2">
                            <IconButton
                                onClick={handleRemoveGroup}
                                title='Remove plant from group'
                                icon={faBan}
                            />
                            <IconButton
                                href={`/manage/${plant.group.uuid}`}
                                title='Go to group page'
                                icon={faUpRightFromSquare}
                            />
                        </div>
                    </div>
                ) : (
                    <div className="mx-auto mt-2">
                        <IconButton
                            onClick={openGroupModal}
                            title='Add plant to group'
                            icon={faPlus}
                        />
                    </div>
                )}
            </div>
            <div className="divider font-bold">Details</div>
            <PlantDetails
                species={plant.species}
                pot_size={plant.pot_size}
                description={plant.description}
            />
        </DetailsCard>
    );
});

DetailsDropdown.propTypes = {
    plant: PropTypes.object.isRequired,
    handleRemoveGroup: PropTypes.func.isRequired
};

function App() {
    // Load context set by django template
    const [plant, setPlant] = useState(() => {
        return parseDomContext("plant_details");
    });
    const [events, setEvents] = useState(() => {
        return parseDomContext("events");
    });
    const [groupOptions, setGroupOptions] = useState(() => {
        return parseDomContext("group_options");
    });

    // Request new state from backend if user navigates to page by pressing
    // back button (may be outdated if user clicked group and made changes)
    useEffect(() => {
        const handleBackButton = async (event) => {
            if (event.persisted) {
                const response = await fetch(`/get_plant_state/${plant.uuid}`);
                if (response.ok) {
                    const data = await response.json();
                    // Only update plant and groupOptions (photos and notes can only be
                    // added on this page, outdated species_options won't cause issues)
                    setPlant(data['plant_details']);
                    setEvents(data['events']);
                    setGroupOptions(data['group_options']);
                } else {
                    // Reload page if failed to get new state (plant deleted)
                    window.location.reload();
                }
            }
        };

        // Add listener on mount, remove on unmount
        window.addEventListener('pageshow', handleBackButton);
        return () => {
            window.removeEventListener('pageshow', handleBackButton);
        };
    }, []);

    // Create ref to access edit details form
    const editDetailsRef = useRef(null);

    // Called after successful repot_plant API call, takes RepotEvent params
    const handleRepot = (newPotSize, repotTimestamp) => {
        // Update state with new pot_size and event timestamp
        setPlant({...plant, pot_size: newPotSize});
        let newEvents = {...events };
        newEvents['repot'].push(repotTimestamp);
        newEvents['repot'].sort().reverse();
        setEvents(newEvents);

        // Open modal with instructions to change QR code
        openChangeQrModal();
    };

    // GroupModal submit handler
    const handleAddGroup = async (groupID) => {
        const payload = {
            plant_id: plant.uuid,
            group_id: groupID
        };
        const response = await sendPostRequest('/add_plant_to_group', payload);
        if (response.ok) {
            // Update plant state with group name and UUID from response
            const data = await response.json();
            setPlant({...plant,
                group: {
                    name: data.group_name,
                    uuid: data.group_uuid
                }
            });
        } else {
            const error = await response.json();
            openErrorModal(JSON.stringify(error));
        }
        closeGroupModal();
    };

    // Makes remove_plant_from_group API call, updates state if successful
    const handleRemoveGroup = useCallback(async () => {
        const response = await sendPostRequest(
            '/remove_plant_from_group',
            {plant_id: plant.uuid}
        );
        if (response.ok) {
            // Remove group details from plant state
            setPlant({...plant, group: null});
        } else {
            const error = await response.json();
            openErrorModal(JSON.stringify(error));
        }
    }, []);

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
            openErrorModal(JSON.stringify(error));
        }
    };

    // Handler for water and fertilize buttons
    // Takes event type, creates event in database, adds timestamp to state
    const addEvent = async (eventType, timestamp) => {
        const payload = {
            plant_id: plant.uuid,
            event_type: eventType,
            timestamp: localToUTC(timestamp)
        };
        const response = await sendPostRequest('/add_plant_event', payload);
        if (response.ok) {
            // Add new event to correct history column, sort chronologically
            let oldEvents = {...events};
            oldEvents[eventType].push(payload.timestamp);
            oldEvents[eventType].sort().reverse();
            setEvents(oldEvents);
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
                openErrorModal(JSON.stringify(error));
            }
        }
    };

    // Takes timestamp and eventType, removes timestamp from events state
    const removeEvent = (timestamp, eventType) => {
        let oldEvents = {...events};
        oldEvents[eventType].splice(
            oldEvents[eventType].indexOf(timestamp),
            1
        );
        setEvents(oldEvents);
    };

    return (
        <div className="container flex flex-col mx-auto mb-8">
            <Navbar
                menuOptions={
                    <DropdownOptions plant={plant} />
                }
                onOpenMenu={preloadDefaultPhotoModal}
                title={plant.display_name}
                titleOptions={
                    <DetailsDropdown
                        plant={plant}
                        handleRemoveGroup={handleRemoveGroup}
                    />
                }
            />

            {/* Don't render event buttons if plant is archived */}
            {plant.archived ? (
                <div className="text-center text-xl">
                    Plant Archived
                </div>
            ) : (
                <EventButtons events={events} addEvent={addEvent} />
            )}

            <EventCalendar events={events} />

            <Timeline
                plantID={plant.uuid}
                events={events}
                archived={plant.archived}
            />

            <EditModal title="Edit Details" onSubmit={submitEditModal}>
                <PlantDetailsForm
                    formRef={editDetailsRef}
                    name={plant.name}
                    species={plant.species}
                    pot_size={plant.pot_size}
                    description={plant.description}
                />
            </EditModal>

            <GroupModal
                groupOptions={groupOptions}
                handleAddGroup={handleAddGroup}
            />

            <RepotModal
                plantID={plant.uuid}
                currentPotSize={plant.pot_size}
                handleRepot={handleRepot}
            />

            <EventHistoryModal
                plantID={plant.uuid}
                events={events}
                removeEvent={removeEvent}
            />

            <ChangeQrModal
                uuid={plant.uuid}
            />
        </div>
    );
}

export default App;
