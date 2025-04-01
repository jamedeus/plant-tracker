import React, { useRef, useEffect, useCallback, useMemo, memo } from 'react';
import PropTypes from 'prop-types';
import { localToUTC } from 'src/timestampUtils';
import { sendPostRequest } from 'src/util';
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
import NoteModal from './NoteModal';
import RepotModal from './RepotModal';
import PhotoModal from './PhotoModal';
import DefaultPhotoModal from './DefaultPhotoModal';
import DeletePhotosModal from './DeletePhotosModal';
import ChangeQrModal, { openChangeQrModal } from 'src/components/ChangeQrModal';
import EventHistoryModal from './EventHistoryModal';
import { openDefaultPhotoModal, preloadDefaultPhotoModal } from './DefaultPhotoModal';
import { openErrorModal } from 'src/components/ErrorModal';
import Timeline from './Timeline';
import { faPlus, faBan, faUpRightFromSquare } from '@fortawesome/free-solid-svg-icons';
import { useSelector, useDispatch } from 'react-redux';
import {
    eventAdded,
    plantDetailsUpdated,
    plantAddedToGroup,
    plantRemovedFromGroup,
    backButtonPressed
} from './plantSlice';

const EventButtons = memo(function EventButtons({ plantID, lastWatered, lastFertilized }) {
    // Create ref to access new event datetime input
    const eventTimeInput = useRef(null);

    // Used to update redux store
    const dispatch = useDispatch();

    const addEvent = async (eventType, timestamp) => {
        const payload = {
            plant_id: plantID,
            event_type: eventType,
            timestamp: localToUTC(timestamp)
        };
        const response = await sendPostRequest('/add_plant_event', payload);
        if (response.ok) {
            // Add new event to redux store (updates calendar, timeline, etc)
            dispatch(eventAdded({
                timestamp: payload.timestamp,
                type: eventType
            }));
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

    return (
        <div className="flex flex-col text-center">
            <span className="text-lg">
                <LastEventTime
                    text="watered"
                    timestamp={lastWatered}
                />
            </span>
            <span className="text-lg">
                <LastEventTime
                    text="fertilized"
                    timestamp={lastFertilized}
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
});

EventButtons.propTypes = {
    plantID: PropTypes.string.isRequired,
    lastWatered: PropTypes.string.isRequired,
    lastFertilized: PropTypes.string.isRequired
};

function App() {
    // Get redux states (parsed from context set by django template)
    const plantDetails = useSelector((state) => state.plant.plantDetails);
    const groupOptions = useSelector((state) => state.plant.groupOptions);

    // Object with "water", "fertilize", "prune", and "repot" keys each
    // containing an array of all event timestamps in backend database.
    const events = useSelector((state) => state.plant.events);

    // Used to update redux store
    const dispatch = useDispatch();

    // Request new state from backend if user navigates to page by pressing
    // back button (may be outdated if user clicked group and made changes)
    useEffect(() => {
        const handleBackButton = async (event) => {
            if (event.persisted) {
                const response = await fetch(`/get_plant_state/${plantDetails.uuid}`);
                if (response.ok) {
                    const data = await response.json();
                    // Update plant details, events, notes, photoUrls, and
                    // groupOptions (outdated species_options won't cause issues)
                    dispatch(backButtonPressed(data));
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

    // Get toggle theme option from context
    const { ToggleThemeOption } = useTheme();

    // Called after successful repot_plant API call, takes RepotEvent params
    const handleRepot = (newPotSize, repotTimestamp) => {
        // Update state with new pot_size and event timestamp
        dispatch(plantDetailsUpdated({
            ...plantDetails,
            pot_size: newPotSize
        }));
        dispatch(eventAdded({timestamp: repotTimestamp, type: 'repot'}));

        // Open modal with instructions to change QR code
        openChangeQrModal();
    };

    // GroupModal submit handler
    const handleAddGroup = async (groupID) => {
        const payload = {
            plant_id: plantDetails.uuid,
            group_id: groupID
        };
        const response = await sendPostRequest('/add_plant_to_group', payload);
        if (response.ok) {
            // Update plant state with group name and UUID from response
            const data = await response.json();
            dispatch(plantAddedToGroup({
                name: data.group_name,
                uuid: data.group_uuid
            }));
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
            {plant_id: plantDetails.uuid}
        );
        if (response.ok) {
            // Remove group details from plant state
            dispatch(plantRemovedFromGroup());
        } else {
            const error = await response.json();
            openErrorModal(JSON.stringify(error));
        }
    }, []);

    const submitEditModal = async () => {
        const payload = Object.fromEntries(
            new FormData(editDetailsRef.current)
        );
        payload["plant_id"] = plantDetails.uuid;

        const response = await sendPostRequest('/edit_plant', payload);
        if (response.ok) {
            // Update plant state with new values from response
            const data = await response.json();
            dispatch(plantDetailsUpdated({
                ...plantDetails,
                ...data
            }));
        } else {
            const error = await response.json();
            openErrorModal(JSON.stringify(error));
        }
    };

    // Top left corner dropdown options
    const DropdownMenuOptions = useMemo(() => {
        return (
            <>
                <li><a onClick={() => window.location.href = "/"}>
                    Overview
                </a></li>
                {!plantDetails.archived && (
                    <>
                        {plantDetails.group &&
                            <li><a href={"/manage/" + plantDetails.group.uuid}>
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
    }, [plantDetails]);

    // Plant details card shown when title is clicked
    const PlantDetailsDropdown = useMemo(() => {
        return (
            <DetailsCard>
                <div className="flex flex-col">
                    <div className="divider font-bold mt-0">Group</div>
                    {/* Group details if in group, add group button if not */}
                    {plantDetails.group ? (
                        <div className="flex flex-col text-center">
                            <a
                                className="font-bold text-lg"
                                href={`/manage/${plantDetails.group.uuid}`}
                            >
                                { plantDetails.group.name }
                            </a>
                            <div className="flex gap-2 mx-auto mt-2">
                                <IconButton
                                    onClick={handleRemoveGroup}
                                    title='Remove plant from group'
                                    icon={faBan}
                                />
                                <IconButton
                                    href={`/manage/${plantDetails.group.uuid}`}
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
                    species={plantDetails.species}
                    pot_size={plantDetails.pot_size}
                    description={plantDetails.description}
                />
            </DetailsCard>
        );
    }, [plantDetails]);

    return (
        <div className="container flex flex-col mx-auto mb-8">
            <Navbar
                menuOptions={DropdownMenuOptions}
                onOpenMenu={preloadDefaultPhotoModal}
                title={plantDetails.display_name}
                titleOptions={PlantDetailsDropdown}
            />

            {/* Don't render event buttons if plant is archived */}
            {plantDetails.archived ? (
                <div className="text-center text-xl">
                    Plant Archived
                </div>
            ) : (
                <EventButtons
                    plantID={plantDetails.uuid}
                    lastWatered={events.water[0]}
                    lastFertilized={events.fertilize[0]}
                />
            )}

            <EventCalendar />

            <Timeline archived={plantDetails.archived} />
            <NoteModal plantID={plantDetails.uuid} />
            <PhotoModal plantID={plantDetails.uuid} />
            <DefaultPhotoModal plantID={plantDetails.uuid} />
            <DeletePhotosModal plantID={plantDetails.uuid} />

            <EditModal title="Edit Details" onSubmit={submitEditModal}>
                <PlantDetailsForm
                    formRef={editDetailsRef}
                    name={plantDetails.name}
                    species={plantDetails.species}
                    pot_size={plantDetails.pot_size}
                    description={plantDetails.description}
                />
            </EditModal>

            <GroupModal
                groupOptions={groupOptions}
                handleAddGroup={handleAddGroup}
            />

            <RepotModal
                plantID={plantDetails.uuid}
                currentPotSize={plantDetails.pot_size}
                handleRepot={handleRepot}
            />

            <EventHistoryModal plantID={plantDetails.uuid} />

            <ChangeQrModal uuid={plantDetails.uuid} />
        </div>
    );
}

export default App;
