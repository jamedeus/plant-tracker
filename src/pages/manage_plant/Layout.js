import React, { useEffect, useMemo } from 'react';
import { sendPostRequest } from 'src/util';
import Navbar from 'src/components/Navbar';
import NavbarDropdownOptions from 'src/components/NavbarDropdownOptions';
import DetailsCard from 'src/components/DetailsCard';
import PlantDetails from 'src/components/PlantDetails';
import IconButton from 'src/components/IconButton';
import EventButtons from './EventButtons';
import EventCalendar from './EventCalendar';
import { openGroupModal } from './GroupModal';
import ChangeQrModal, { openChangeQrModal } from 'src/components/ChangeQrModal';
import { openDefaultPhotoModal, preloadDefaultPhotoModal } from './DefaultPhotoModal';
import { openErrorModal } from 'src/components/ErrorModal';
import Timeline from './Timeline';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faBan, faPen, faUpRightFromSquare } from '@fortawesome/free-solid-svg-icons';
import { useSelector, useDispatch } from 'react-redux';
import { plantRemovedFromGroup, backButtonPressed } from './plantSlice';
import Settings from './Settings';
import clsx from 'clsx';

function Layout() {
    // Get redux state (parsed from context set by django template)
    const plantDetails = useSelector((state) => state.plant.plantDetails);
    const defaultPhoto = useSelector((state) => state.timeline.defaultPhoto);

    // Used to update redux store
    const dispatch = useDispatch();

    // Update redux store with new state fetched from backend if user navigates
    // to page by pressing back button (contents may be outdated)
    useEffect(() => {
        const handleBackButton = (event) => {
            event.persisted && dispatch(backButtonPressed());
        };
        // Add listener on mount, remove on unmount
        window.addEventListener('pageshow', handleBackButton);
        return () => window.removeEventListener('pageshow', handleBackButton);
    }, []);

    // Top left corner dropdown options
    const DropdownMenuOptions = useMemo(() => (
        <NavbarDropdownOptions>
            {!plantDetails.archived && (
                <>
                    {plantDetails.group &&
                        <li><a href={`/manage/${plantDetails.group.uuid}`}>
                            Go to group
                        </a></li>
                    }
                    <li><button onClick={openChangeQrModal}>
                        Change QR code
                    </button></li>
                    <li><label
                        htmlFor='settings-menu'
                        onClick={() => document.activeElement.blur()}
                        data-testid='open-settings-menu'
                    >
                        Settings
                    </label></li>
                </>
            )}
        </NavbarDropdownOptions>
    ), [plantDetails]);

    // Plant details card shown when title is clicked
    const PlantDetailsDropdown = useMemo(() => {
        // Makes remove_plant_from_group API call, updates state if successful
        const handleRemoveGroup = async () => {
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
        };

        return (
            <DetailsCard>
                <div className="flex flex-col">
                    {defaultPhoto.thumbnail && (
                        <>
                            <div className="divider font-bold mt-0">
                                Default Photo
                            </div>
                            <button
                                className={clsx(
                                    "relative mx-auto cursor-pointer",
                                    "focus:outline outline-offset-2 rounded-lg"
                                )}
                                onClick={openDefaultPhotoModal}
                                title="Change default photo"
                            >
                                <img
                                    loading="lazy"
                                    className={clsx(
                                        "photo-thumbnail mx-auto",
                                        "size-[8rem] md:size-[14rem]"
                                    )}
                                    src={defaultPhoto.thumbnail}
                                    data-testid="defaultPhotoThumbnail"
                                />
                                <div className={clsx(
                                    "absolute bottom-2 right-2 size-8 min-size-8",
                                    "btn btn-square bg-base-200/60 border-none",
                                )}>
                                    <FontAwesomeIcon
                                        className='size-3!'
                                        icon={faPen}
                                    />
                                </div>
                            </button>
                        </>
                    )}
                    <div className={clsx(
                        "divider font-bold",
                        !defaultPhoto.thumbnail && "mt-0"
                    )}>
                        Group
                    </div>
                    {/* Group details if in group, add group button if not */}
                    <div className="flex flex-col text-center items-center">
                        {plantDetails.group && (
                            <a
                                className={clsx(
                                    "font-bold text-lg line-clamp-1 rounded-lg",
                                    "focus:outline-2 outline-offset-2"
                                )}
                                href={`/manage/${plantDetails.group.uuid}`}
                            >
                                { plantDetails.group.name }
                            </a>
                        )}
                        <div className="flex gap-2 mx-auto mt-2">
                            {plantDetails.group ? (
                                <>
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
                                </>
                            ) : (
                                <IconButton
                                    onClick={openGroupModal}
                                    title='Add plant to group'
                                    icon={faPlus}
                                />
                            )}
                        </div>
                    </div>
                </div>
                <div className="divider font-bold">Details</div>
                <PlantDetails
                    species={plantDetails.species}
                    pot_size={plantDetails.pot_size}
                    description={plantDetails.description}
                />
            </DetailsCard>
        );
    }, [plantDetails, defaultPhoto.thumbnail]);

    return (
        <div className="container flex flex-col items-center mx-auto mb-8">
            <Navbar
                menuOptions={DropdownMenuOptions}
                title={plantDetails.display_name}
                titleOptions={PlantDetailsDropdown}
                onOpenTitle={preloadDefaultPhotoModal}
            />

            {/* Don't render event buttons if plant is archived */}
            {plantDetails.archived ? (
                <div className="text-center text-xl">
                    Plant Archived
                </div>
            ) : (
                <EventButtons />
            )}

            <div className="my-8">
                <EventCalendar />
            </div>

            <div className="w-full max-w-(--breakpoint-md) mt-2 px-4">
                <Timeline />
            </div>

            <ChangeQrModal uuid={plantDetails.uuid} />
            <Settings />
        </div>
    );
}

export default Layout;
