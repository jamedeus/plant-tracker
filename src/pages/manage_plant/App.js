import React, { useState, useRef } from 'react';
import { localToUTC } from 'src/timestampUtils';
import { sendPostRequest, parseDomContext } from 'src/util';
import EditModal from 'src/components/EditModal';
import PlantDetailsForm from 'src/forms/PlantDetailsForm';
import Navbar from 'src/components/Navbar';
import DatetimeInput from 'src/components/DatetimeInput';
import { useToast } from 'src/context/ToastContext';
import { useTheme } from 'src/context/ThemeContext';
import DetailsCard from 'src/components/DetailsCard';
import LastEventTime from 'src/components/LastEventTime';
import PlantDetails from 'src/components/PlantDetails';
import IconButton from 'src/components/IconButton';
import EventCalendar from './EventCalendar';
import GroupModal, { openGroupModal } from './GroupModal';
import PhotoModal, { openPhotoModal } from './PhotoModal';
import RepotModal, { openRepotModal } from './RepotModal';
import ChangeQrModal, { openChangeQrModal } from 'src/components/ChangeQrModal';
import EventHistoryModal from './EventHistoryModal';
import DefaultPhotoModal, { openDefaultPhotoModal } from './DefaultPhotoModal';
import DeletePhotosModal from './DeletePhotosModal';
import { useErrorModal } from 'src/context/ErrorModalContext';
import Timeline from './Timeline';
import { faPlus, faBan, faUpRightFromSquare } from '@fortawesome/free-solid-svg-icons';

function App() {
    // Load context set by django template
    const [plant, setPlant] = useState(() => {
        return parseDomContext("plant");
    });
    const [photoUrls, setPhotoUrls] = useState(() => {
        return parseDomContext("photo_urls");
    });

    // Get hooks to show toast message, error modal
    const { showToast } = useToast();
    const { showErrorModal } = useErrorModal();

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

        // Open modal with instructions to change QR code
        openChangeQrModal();
    };

    // Called after successful add_plant_to_group API call, takes name and UUID
    const handleAddGroup = (newGroupName, newGroupID) => {
        setPlant({...plant,
            group: {
                name: newGroupName,
                uuid: newGroupID
            }
        });
    };

    // Makes remove_plant_from_group API call, updates state if successful
    const handleRemoveGroup = async () => {
        const response = await sendPostRequest(
            '/remove_plant_from_group',
            {plant_id: plant.uuid}
        );
        if (response.ok) {
            // Remove group details from plant state
            setPlant({...plant, group: null});
        } else {
            const error = await response.json();
            showErrorModal(JSON.stringify(error));
        }
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

    const DropdownOptions = () => {
        // Get toggle theme option from context
        const { ToggleThemeOption } = useTheme();

        // Options shown when plant is not in group
        const AddGroup = () => {
            return (
                <li><a onClick={openGroupModal}>
                    Add to group
                </a></li>
            );
        };

        // Options shown when plant is in group
        const RemoveGroup = () => {
            return (
                <>
                    <li><a href={"/manage/" + plant.group.uuid}>
                        Go to group
                    </a></li>
                    <li><a onClick={handleRemoveGroup}>
                        Remove from group
                    </a></li>
                </>
            );
        };

        return (
            <>
                <li><a onClick={() => window.location.href = "/"}>
                    Overview
                </a></li>
                {plant.group ? <RemoveGroup /> : <AddGroup />}
                <li><a onClick={openRepotModal}>
                    Repot plant
                </a></li>
                <li><a onClick={openPhotoModal}>
                    Upload photos
                </a></li>
                <li><a onClick={openDefaultPhotoModal}>
                    Set default photo
                </a></li>
                <li><a onClick={openChangeQrModal}>
                    Change QR code
                </a></li>
                <ToggleThemeOption />
            </>
        );
    };

    // Contents of dropdown shown when name plant clicked in header
    const DetailsDropdown = () => {
        // Rendered when plant is in a group
        const Group = () => {
            const groupLink = `/manage/${plant.group.uuid}`;

            return (
                <div className="flex flex-col text-center">
                    <a className="font-bold text-lg" href={groupLink}>
                        { plant.group.name }
                    </a>
                    <div className="flex gap-2 mx-auto mt-2">
                        <IconButton
                            onClick={handleRemoveGroup}
                            title={"Remove plant from group"}
                            icon={faBan}
                        />
                        <IconButton
                            href={groupLink}
                            title={"Go to group page"}
                            icon={faUpRightFromSquare}
                        />
                    </div>
                </div>
            );
        };

        // Rendered when plant is not in a group
        const AddGroup = () => {
            return (
                <div className="mx-auto mt-2">
                    <IconButton
                        onClick={openGroupModal}
                        title={"Add plant to group"}
                        icon={faPlus}
                    />
                </div>
            );
        };

        return (
            <DetailsCard>
                <div className="flex flex-col">
                    <div className="divider font-bold mt-0">Group</div>
                    {plant.group ? <Group /> : <AddGroup />}
                </div>
                <div className="divider font-bold">Details</div>
                <PlantDetails
                    species={plant.species}
                    pot_size={plant.pot_size}
                    description={plant.description}
                />
            </DetailsCard>
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
                    <DetailsDropdown />
                }
            />

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
                plantID={plant.uuid}
                events={plant.events}
                photoUrls={photoUrls}
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
                plantID={plant.uuid}
                handleAddGroup={handleAddGroup}
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

            <ChangeQrModal
                uuid={plant.uuid}
            />
        </div>
    );
}

export default App;
