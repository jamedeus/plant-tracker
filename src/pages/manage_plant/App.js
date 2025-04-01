import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import { sendPostRequest } from 'src/util';
import EditModal from 'src/components/EditModal';
import PlantDetailsForm from 'src/forms/PlantDetailsForm';
import Navbar from 'src/components/Navbar';
import { useTheme } from 'src/context/ThemeContext';
import DetailsCard from 'src/components/DetailsCard';
import PlantDetails from 'src/components/PlantDetails';
import IconButton from 'src/components/IconButton';
import EventButtons from './EventButtons';
import EventCalendar from './EventCalendar';
import GroupModal, { openGroupModal } from './GroupModal';
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
    plantDetailsUpdated,
    plantRemovedFromGroup,
    backButtonPressed
} from './plantSlice';

function App() {
    // Get redux state (parsed from context set by django template)
    const plantDetails = useSelector((state) => state.plant.plantDetails);

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
                <EventButtons />
            )}

            <EventCalendar />

            <Timeline />
            <NoteModal />
            <PhotoModal />
            <DefaultPhotoModal />
            <DeletePhotosModal />

            <EditModal title="Edit Details" onSubmit={submitEditModal}>
                <PlantDetailsForm
                    formRef={editDetailsRef}
                    name={plantDetails.name}
                    species={plantDetails.species}
                    pot_size={plantDetails.pot_size}
                    description={plantDetails.description}
                />
            </EditModal>

            <GroupModal />

            <RepotModal />

            <EventHistoryModal />

            <ChangeQrModal uuid={plantDetails.uuid} />
        </div>
    );
}

export default App;
