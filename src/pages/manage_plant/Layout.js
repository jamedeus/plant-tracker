import React, { useMemo, Suspense, useCallback, lazy } from 'react';
import { Link } from 'react-router-dom';
import sendPostRequest from 'src/utils/sendPostRequest';
import Navbar from 'src/components/Navbar';
import NavbarDropdownOptions from 'src/components/NavbarDropdownOptions';
import DetailsCard from 'src/components/DetailsCard';
import PlantDetails from 'src/components/PlantDetails';
import IconButton from 'src/components/IconButton';
import EventButtons from './EventButtons';
import EventCalendar from './EventCalendar';
import LazyModal, { useModal } from 'src/components/LazyModal';
import QrScannerButton from 'src/components/QrScannerButton';
import { openErrorModal } from 'src/components/ErrorModal';
import { setChangeQrModalHandle } from './modals';
import Timeline from './Timeline';
import { FaPlus, FaBan, FaUpRightFromSquare } from 'react-icons/fa6';
import { useSelector, useDispatch } from 'react-redux';
import { plantRemovedFromGroup } from './plantSlice';
import SuspenseFullscreen from 'src/components/SuspenseFullscreen';
import DeleteModeFooter from './DeleteModeFooter';
import {
    settingsMenuOpened,
    photoGalleryOpened,
    photoGalleryIndexChanged
} from './interfaceSlice';
import clsx from 'clsx';

// Dynamic import (don't request webpack bundle until gallery opened)
const Gallery = lazy(
    () => import(/* webpackChunkName: "lightbox" */ './Gallery')
);

function Layout() {
    // Get redux state (parsed from context set by django template)
    const plantDetails = useSelector((state) => state.plant.plantDetails);
    const defaultPhoto = useSelector((state) => state.timeline.defaultPhoto);
    const galleryOpen = useSelector((state) => state.interface.photoGalleryOpen);
    const hasPhotos = useSelector((state) => state.timeline.hasPhotos);
    // Get index of default photo (used to open in gallery)
    const photos = useSelector((state) => state.timeline.photos);
    const defaultPhotoIndex = photos.indexOf(
        photos.filter(photo => photo.key === defaultPhoto.key)[0]
    );

    // Used to update redux store
    const dispatch = useDispatch();

    const editModal = useModal();
    const openEditModal = useCallback(() => {
        editModal.open();
        document.activeElement.blur();
    }, [editModal]);

    const changeQrModal = useModal();
    const openChangeQrModal = useCallback(() => {
        changeQrModal.open({uuid: plantDetails.uuid});
        document.activeElement.blur();
    }, [changeQrModal]);
    setChangeQrModalHandle(changeQrModal);

    const groupModal = useModal();
    const openGroupModal = useCallback(() => {
        groupModal.open();
        document.activeElement.blur();
    }, [groupModal]);

    // Top left corner dropdown options
    const DropdownMenuOptions = useMemo(() => (
        <NavbarDropdownOptions>
            {!plantDetails.archived && (
                <>
                    {plantDetails.group &&
                        <li><Link to={`/manage/${plantDetails.group.uuid}`} discover="none">
                            Go to group
                        </Link></li>
                    }
                    <li><button onClick={openChangeQrModal}>
                        Change QR code
                    </button></li>
                    <li><label
                        onClick={() => dispatch(settingsMenuOpened(true))}
                        data-testid='open-settings-menu'
                    >
                        Settings
                    </label></li>
                    {hasPhotos &&
                        <li><button onClick={() => dispatch(photoGalleryOpened({open: true}))}>
                            Gallery
                        </button></li>
                    }
                </>
            )}
        </NavbarDropdownOptions>
    ), [plantDetails, hasPhotos]);

    // Plant details card shown when title is clicked
    const PlantDetailsDropdown = useMemo(() => {
        // Opens default photo in gallery
        const openGallery = () => {
            dispatch(photoGalleryIndexChanged({index: defaultPhotoIndex}));
            dispatch(photoGalleryOpened({open: true}));
        };

        // Makes remove_plant_from_group API call, updates state if successful
        const handleRemoveGroup = async () => {
            const response = await sendPostRequest('/remove_plant_from_group', {
                plant_id: plantDetails.uuid
            });
            if (response.ok) {
                // Remove group details from plant state
                dispatch(plantRemovedFromGroup());
            } else {
                const error = await response.json();
                openErrorModal(JSON.stringify(error));
            }
        };

        return (
            <DetailsCard openEditModal={openEditModal}>
                <div className="flex flex-col">
                    {defaultPhoto.thumbnail && (
                        <>
                            <div className="divider font-bold mt-0">
                                Default Photo
                            </div>
                            <img
                                loading="lazy"
                                draggable={false}
                                className={clsx(
                                    "photo-thumbnail mx-auto cursor-pointer",
                                    "size-[8rem] md:size-[14rem]"
                                )}
                                src={defaultPhoto.preview}
                                data-testid="defaultPhotoThumbnail"
                                onClick={openGallery}
                            />
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
                            <Link
                                className={clsx(
                                    "font-bold text-lg line-clamp-1 rounded-lg",
                                    "focus:outline-2 outline-offset-2"
                                )}
                                to={`/manage/${plantDetails.group.uuid}`}
                                discover="none"
                            >
                                { plantDetails.group.name }
                            </Link>
                        )}
                        <div className="flex gap-2 mx-auto mt-2">
                            {plantDetails.group ? (
                                <>
                                    <IconButton
                                        onClick={handleRemoveGroup}
                                        title='Remove plant from group'
                                    >
                                        <FaBan className="size-4" />
                                    </IconButton>
                                    <IconButton
                                        href={`/manage/${plantDetails.group.uuid}`}
                                        title='Go to group page'
                                    >
                                        <FaUpRightFromSquare className="size-4" />
                                    </IconButton>
                                </>
                            ) : (
                                <IconButton
                                    onClick={openGroupModal}
                                    title='Add plant to group'
                                >
                                    <FaPlus className="size-4" />
                                </IconButton>
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
        <div
            className="container flex flex-col items-center mx-auto mb-28"
            data-testid="manage-plant-layout"
        >
            <Navbar
                menuOptions={DropdownMenuOptions}
                title={plantDetails.display_name}
                titleOptions={PlantDetailsDropdown}
                topRightButton={<QrScannerButton />}
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

            <LazyModal
                ref={editModal.ref}
                title="Edit Details"
                ariaLabel="Edit plant details"
                className="max-w-[25rem]"
                load={() => import(/* webpackChunkName: "edit-plant-modal" */ "./EditPlantModal")}
            />

            <LazyModal
                ref={changeQrModal.ref}
                title="Change QR Code"
                ariaLabel="Change plant QR code"
                load={() => import(/* webpackChunkName: "change-qr-modal" */ "src/components/ChangeQrModal")}
            />

            <LazyModal
                ref={groupModal.ref}
                title="Add plant to group"
                ariaLabel="Add plant to group"
                load={() => import(/* webpackChunkName: "add-to-group-modal" */ "./GroupModal")}
            />

            {/* Don't render until user opens gallery */}
            {galleryOpen && (
                <Suspense fallback={
                    <SuspenseFullscreen onClose={
                        /* Allow closing suspense (cancel opening gallery) */
                        () => dispatch(photoGalleryOpened({open: false}))
                    } />
                }>
                    <Gallery />
                </Suspense>
            )}
            <DeleteModeFooter />
        </div>
    );
}

export default Layout;
