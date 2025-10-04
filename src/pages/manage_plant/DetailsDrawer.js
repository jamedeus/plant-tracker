import React, { useCallback } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import sendPostRequest from 'src/utils/sendPostRequest';
import { useSelector, useDispatch } from 'react-redux';
import TitleDrawer from 'src/components/TitleDrawer';
import PlantDetails from 'src/components/PlantDetails';
import { openErrorModal } from 'src/components/ErrorModal';
import ChangeQrScannerButton from 'src/components/ChangeQrScanner';
import { FaPlus } from 'react-icons/fa6';
import { IoMdCloseCircle } from "react-icons/io";
import { plantRemovedFromGroup } from './plantSlice';
import {
    titleDrawerOpened,
    changeQrScannerOpened,
    photoGalleryOpened,
    photoGalleryIndexChanged
} from './interfaceSlice';
import 'src/css/title-drawer.css';
import clsx from 'clsx';

const DetailsDrawer = ({ openGroupModal, openEditModal }) => {
    // Get state shown in drawer
    const plantDetails = useSelector((state) => state.plant.plantDetails);
    const defaultPhoto = useSelector((state) => state.timeline.defaultPhoto);
    // Get index of default photo (used to open in gallery)
    const photos = useSelector((state) => state.timeline.photos);
    const defaultPhotoIndex = photos.indexOf(
        photos.filter(photo => photo.key === defaultPhoto.key)[0]
    );
    // Get index of default photo (used to open in gallery)
    const open = useSelector((state) => state.interface.titleDrawerOpen);
    const dispatch = useDispatch();

    // Controls change QR scanner overlay open/close state
    const changeQrScannerOpen = useSelector((state) => state.interface.changeQrScannerOpen);
    const openChangeQrScanner = useCallback(() => {
        dispatch(changeQrScannerOpened(true));
    } , [dispatch]);
    const closeChangeQrScanner = useCallback(() => {
        dispatch(changeQrScannerOpened(false));
    } , [dispatch]);

    const closeDrawer = useCallback(() => {
        dispatch(titleDrawerOpened(false));
    }, [dispatch]);

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
        <TitleDrawer open={open} onClose={closeDrawer}>
            {/* Default photo section (if present) */}
            {defaultPhoto.thumbnail && (
                <>
                    <div className="divider font-bold">
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
                        alt="Plant default photo"
                        data-testid="defaultPhotoThumbnail"
                        onClick={openGallery}
                    />
                </>
            )}
            {/* Group section */}
            <div className="divider font-bold">
                Group
            </div>
            {/* Group details if in group, add group button if not */}
            {plantDetails.group ? (
                <span className="relative">
                    <Link
                        className="btn text-lg h-10"
                        to={`/manage/${plantDetails.group.uuid}`}
                        discover="none"
                    >
                        <span className="line-clamp-1">
                            { plantDetails.group.name }
                        </span>
                    </Link>
                    <button
                        className="absolute -right-2 -top-2 cursor-pointer"
                        onClick={handleRemoveGroup}
                        title='Remove plant from group'
                    >
                        <IoMdCloseCircle className="size-5" />
                    </button>
                </span>
            ) : (
                <a
                    className='btn btn-square size-10 min-size-10'
                    onClick={openGroupModal}
                    title='Add plant to group'
                    tabIndex={0}
                >
                    <FaPlus className="size-4" />
                </a>
            )}
            {/* Details section */}
            <div className="divider font-bold">
                Details
            </div>
            <div className='min-w-full'>
                <PlantDetails
                    created={plantDetails.created}
                    species={plantDetails.species}
                    pot_size={plantDetails.pot_size}
                    description={plantDetails.description}
                />
                <button className="btn h-8 mt-4 w-full" onClick={openEditModal}>
                    Edit Details
                </button>
            </div>
            <ChangeQrScannerButton
                isOpen={changeQrScannerOpen}
                onOpen={openChangeQrScanner}
                onClose={closeChangeQrScanner}
                oldUuid={plantDetails.uuid}
            />
        </TitleDrawer>
    );
};

DetailsDrawer.propTypes = {
    openGroupModal: PropTypes.func.isRequired,
    openEditModal: PropTypes.func.isRequired
};

export default DetailsDrawer;
