import React, { useMemo, Suspense, useCallback, lazy } from 'react';
import { Link } from 'react-router-dom';
import Navbar from 'src/components/Navbar';
import NavbarDropdownOptions from 'src/components/NavbarDropdownOptions';
import EventButtons from './EventButtons';
import EventCalendar from './EventCalendar';
import LazyModal, { useModal } from 'src/components/LazyModal';
import QrScannerButton from 'src/components/QrScannerButton';
import { setChangeQrModalHandle } from './modals';
import Timeline from './Timeline';
import { useSelector, useDispatch } from 'react-redux';
import SuspenseFullscreen from 'src/components/SuspenseFullscreen';
import DetailsDrawer from './DetailsDrawer';
import DeleteModeFooter from './DeleteModeFooter';
import { FaGear } from "react-icons/fa6";
import { FaImages, FaLayerGroup } from "react-icons/fa";
import {
    titleDrawerOpened,
    settingsMenuOpened,
    photoGalleryOpened,
} from './interfaceSlice';

// Dynamic import (don't request webpack bundle until gallery opened)
const Gallery = lazy(
    () => import(/* webpackChunkName: "manage_plant_gallery" */ './Gallery')
);

function Layout() {
    // Get redux state (parsed from context set by django template)
    const plantDetails = useSelector((state) => state.plant.plantDetails);
    const galleryOpen = useSelector((state) => state.interface.photoGalleryOpen);
    const hasPhotos = useSelector((state) => state.timeline.hasPhotos);

    // Used to update redux store
    const dispatch = useDispatch();

    // Create callback to open/close details drawer when title clicked
    const titleDrawerOpen = useSelector((state) => state.interface.titleDrawerOpen);
    const toggleDetailsDrawerOpen = useCallback(() => {
        dispatch(titleDrawerOpened(!titleDrawerOpen));
    }, [titleDrawerOpen, dispatch]);

    const editModal = useModal();
    const openEditModal = useCallback(() => {
        editModal.open();
    }, [editModal]);

    const changeQrModal = useModal();
    const openChangeQrModal = useCallback(() => {
        changeQrModal.open({uuid: plantDetails.uuid});
    }, [changeQrModal]);
    setChangeQrModalHandle(changeQrModal);

    const groupModal = useModal();
    const openGroupModal = useCallback(() => {
        groupModal.open();
    }, [groupModal]);

    // Top left corner dropdown options
    const DropdownMenuOptions = useMemo(() => (
        <NavbarDropdownOptions>
            {!plantDetails.archived && (
                <>
                    {plantDetails.group &&
                        <li><Link to={`/manage/${plantDetails.group.uuid}`} discover="none">
                            <FaLayerGroup className="size-4 mr-2" />
                            Go to group
                        </Link></li>
                    }
                    <li><label
                        onClick={() => dispatch(settingsMenuOpened(true))}
                        data-testid='open-settings-menu'
                    >
                        <FaGear className="size-4 mr-2" />
                        Settings
                    </label></li>
                    {hasPhotos &&
                        <li><button onClick={() => dispatch(photoGalleryOpened({open: true}))}>
                            <FaImages className="size-4 mr-2" />
                            Gallery
                        </button></li>
                    }
                </>
            )}
        </NavbarDropdownOptions>
    ), [plantDetails, hasPhotos]);

    return (
        <div
            className="container flex flex-col items-center mx-auto mb-28"
            data-testid="manage-plant-layout"
        >
            <Navbar
                menuOptions={DropdownMenuOptions}
                title={plantDetails.display_name}
                onTitleClick={toggleDetailsDrawerOpen}
                topRightButton={<QrScannerButton />}
            />

            <DetailsDrawer
                openGroupModal={openGroupModal}
                openEditModal={openEditModal}
                openChangeQrModal={openChangeQrModal}
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
                load={() => import(/* webpackChunkName: "manage_plant_edit-modal" */ "./EditPlantModal")}
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
                load={() => import(/* webpackChunkName: "manage_plant_group-modal" */ "./GroupModal")}
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
