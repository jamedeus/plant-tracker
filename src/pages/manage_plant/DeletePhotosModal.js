import React, { useRef, useState, useCallback, memo } from 'react';
import PropTypes from 'prop-types';
import Modal from 'src/components/Modal';
import { sendPostRequest } from 'src/util';
import { timestampToReadable } from 'src/timestampUtils';
import { openErrorModal } from 'src/components/ErrorModal';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/16/solid';
import CloseButtonIcon from 'src/components/CloseButtonIcon';
import clsx from 'clsx';
import { useSelector, useDispatch } from 'react-redux';
import { photosDeleted } from './timelineSlice';

let modalRef;

export const openDeletePhotosModal = () => {
    modalRef.current.open();
};

export const preloadDeletePhotosModal = () => {
    requestAnimationFrame(() => {
        modalRef.current.preload();
    });
};

export const closeDeletePhotosModal = () => {
    modalRef.current.close();
};

const NextPhotoIcon = memo(function NextPhotoIcon() {
    return <ChevronRightIcon className="size-6" />;
});

const PrevPhotoIcon = memo(function PrevPhotoIcon() {
    return <ChevronLeftIcon className="size-6" />;
});

// Renders single photo slide with next, prev, and select buttons
const PhotoSlide = memo(function PhotoSlide({
    photo,
    nextPhotoLink,
    prevPhotoLink,
    selected,
    toggle
}) {
    return (
        <div id={`photo${photo.key}`} className="carousel-item relative w-full mx-1">
            <div className="flex flex-col mx-auto">
                <h1 className="mt-auto mb-1 md:text-lg">
                    {timestampToReadable(photo.timestamp)}
                </h1>
                <img
                    loading="lazy"
                    src={photo.thumbnail}
                    className="rounded-xl overflow-hidden mx-auto mb-auto"
                />
                <div className={clsx(
                    'absolute flex justify-between transform -translate-y-1/2',
                    'left-5 right-5 top-1/2'
                )}>
                    <a href={prevPhotoLink} className="btn btn-circle">
                        <PrevPhotoIcon />
                    </a>
                    <a href={nextPhotoLink} className="btn btn-circle">
                        <NextPhotoIcon />
                    </a>
                </div>
                {/* Select button floats over photo */}
                <div className="absolute bottom-5 -translate-x-1/2 left-1/2">
                    <button
                        className={clsx(
                            'btn rounded-full',
                            selected && 'btn-error'
                        )}
                        onClick={() => toggle(photo)}
                        data-testid={`select_photo_${photo.key}`}
                    >
                        Select
                    </button>
                </div>
            </div>
        </div>
    );
});

PhotoSlide.propTypes = {
    photo: PropTypes.shape({
        key: PropTypes.number.isRequired,
        timestamp: PropTypes.string.isRequired,
        thumbnail: PropTypes.string.isRequired,
        image: PropTypes.string.isRequired
    }).isRequired,
    nextPhotoLink: PropTypes.string.isRequired,
    prevPhotoLink: PropTypes.string.isRequired,
    selected: PropTypes.bool.isRequired,
    toggle: PropTypes.func.isRequired
};

// Rendered on confirm delete screen, allows user to unselect photos
const ConfirmDeleteRow = memo(function ConfirmDeleteRow({ photo, unselectPhoto }) {
    return (
        <>
            <div className="my-auto">
                <button
                    className="btn-close"
                    onClick={() => unselectPhoto(photo)}
                >
                    <CloseButtonIcon />
                </button>
            </div>
            <div className="m-auto">
                <img
                    src={photo.thumbnail}
                    className="rounded-lg max-h-20 md:max-h-32"
                />
            </div>
        </>
    );
});

ConfirmDeleteRow.propTypes = {
    photo: PropTypes.shape({
        key: PropTypes.number.isRequired,
        timestamp: PropTypes.string.isRequired,
        thumbnail: PropTypes.string.isRequired,
        image: PropTypes.string.isRequired
    }).isRequired,
    unselectPhoto: PropTypes.func.isRequired
};

const DeletePhotosModal = () => {
    const dispatch = useDispatch();
    const plantID = useSelector((state) => state.plant.plantDetails.uuid);
    const photos = useSelector((state) => state.timeline.photos);

    modalRef = useRef(null);

    // Controls confirm delete screen visibility
    const [confirmDelete, setConfirmDelete] = useState(false);

    // Track photos to delete
    const [selectedPhotos, setSelectedPhotos ] = useState([]);

    // Select button handler
    const toggleSelected = useCallback((photo) => {
        setSelectedPhotos((prevSelectedPhotos) => {
            if (prevSelectedPhotos.includes(photo)) {
                return prevSelectedPhotos.filter(item => item !== photo);
            } else {
                return [...prevSelectedPhotos, photo];
            }
        });
    }, []);

    // Remove selected photo button handler on confirmation page
    const unselectPhoto = useCallback((photo) => {
        setSelectedPhotos((prevSelectedPhotos) => {
            return prevSelectedPhotos.filter(item => item !== photo);
        });
    }, []);

    // Delete button handler
    const deleteSelected = async () => {
        // Build payload with plant UUID and array of selected photo IDs
        const payload = {
            plant_id: plantID,
            delete_photos: selectedPhotos.map(photo => parseInt(photo.key))
        };
        const response = await sendPostRequest('/delete_plant_photos', payload);
        // If successful remove photos from history column
        if (response.ok) {
            const data = await response.json();
            dispatch(photosDeleted(data.deleted));

            // Close modal, wait for close animation to complete, clear
            // selected photos and reset confirm delete screen
            modalRef.current.close();
            setTimeout(() => {
                setSelectedPhotos([]);
                setConfirmDelete(false);
            }, 200);
        } else {
            const error = await response.json();
            openErrorModal(JSON.stringify(error));
        }
    };

    // Takes index of photo slide, returns link to next slide
    // If last photo return link to first (wrap when end reached)
    const nextPhotoLink = (index) => {
        switch(index) {
            case(photos.length - 1):
                return `#photo${photos[0].key}`;
            default:
                return `#photo${photos[index + 1].key}`;
        }
    };

    // Takes index of photo slide, returns link to prev slide
    // If first slide return link to last (wrap when start reached)
    const prevPhotoLink = (index) => {
        switch(index) {
            case(0):
                return `#photo${photos[photos.length - 1].key}`;
            default:
                return `#photo${photos[index - 1].key}`;
        }
    };

    return (
        <Modal ref={modalRef} onClose={closeDeletePhotosModal}>
            <div
                className={
                    confirmDelete ? "hidden" : "flex flex-col overflow-hidden"
                }
                data-testid="delete-photos-select"
            >
                <h1 className="font-bold text-lg md:text-xl mb-4">
                    Delete Photos
                </h1>
                {photos.length > 0 ? (
                    <div className="carousel w-full h-min">
                        {photos.map((photo, index) => (
                            <PhotoSlide
                                key={photo.key}
                                photo={photo}
                                nextPhotoLink={nextPhotoLink(index)}
                                prevPhotoLink={prevPhotoLink(index)}
                                selected={selectedPhotos.includes(photo)}
                                toggle={toggleSelected}
                            />
                        ))}
                    </div>
                ) : (
                    <p className="my-8">No photos</p>
                )}

                <div className="flex mt-6 mx-auto">
                    <button
                        className="btn mr-2"
                        onClick={closeDeletePhotosModal}
                    >
                        Cancel
                    </button>
                    <button
                        className="btn btn-error ml-2"
                        onClick={() => setConfirmDelete(true)}
                        disabled={!selectedPhotos.length}
                        data-testid="delete_photos"
                    >
                        Delete
                    </button>
                </div>
            </div>

            <div
                className={confirmDelete ? "flex flex-col" : "hidden"}
                data-testid="delete-photos-confirm"
            >
                <h1 className="font-bold text-lg md:text-xl mb-4">
                    Confirm Delete
                </h1>

                <div className={clsx(
                    'grid grid-cols-[min-content_1fr] mx-auto px-8 gap-4',
                    'max-h-[50vh] overflow-y-scroll'
                )}>
                    {selectedPhotos.map(photo => (
                        <ConfirmDeleteRow
                            key={photo.key}
                            photo={photo}
                            unselectPhoto={unselectPhoto}
                        />
                    ))}
                </div>

                <div className="flex mt-6 mx-auto">
                    <button
                        className="btn mr-2"
                        onClick={() => setConfirmDelete(false)}
                    >
                        Cancel
                    </button>
                    <button
                        className="btn btn-error ml-2"
                        onClick={deleteSelected}
                        data-testid="confirm_delete_photos"
                    >
                        Delete
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default DeletePhotosModal;
