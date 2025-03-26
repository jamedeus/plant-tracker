import React, { useRef, useState, useCallback, Fragment, memo } from 'react';
import PropTypes from 'prop-types';
import Modal from 'src/components/Modal';
import { sendPostRequest } from 'src/util';
import { timestampToReadable } from 'src/timestampUtils';
import { openErrorModal } from 'src/components/ErrorModal';
import { useTimeline } from './TimelineContext';
import {
    ChevronLeftIcon,
    ChevronRightIcon,
    XMarkIcon
} from '@heroicons/react/16/solid';
import clsx from 'clsx';

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

// Renders single photo slide with next, prev, and select buttons
const PhotoSlide = memo(function PhotoSlide({ photo, nextPhotoLink, prevPhotoLink, selected, toggle }) {
    return (
        <div id={`photo${photo.key}`} className="carousel-item relative w-full mx-1">
            <div className="flex flex-col mx-auto">
                <h1 className="mt-auto mb-1 md:text-lg">
                    {timestampToReadable(photo.created)}
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
                    <a href={prevPhotoLink} className="btn btn-circle no-animation">
                        <ChevronLeftIcon className="w-6 h-6" />
                    </a>
                    <a href={nextPhotoLink} className="btn btn-circle no-animation">
                        <ChevronRightIcon className="w-6 h-6" />
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
                    >
                        Select
                    </button>
                </div>
            </div>
        </div>
    );
});

PhotoSlide.propTypes = {
    photo: PropTypes.object.isRequired,
    nextPhotoLink: PropTypes.string.isRequired,
    prevPhotoLink: PropTypes.string.isRequired,
    selected: PropTypes.bool.isRequired,
    toggle: PropTypes.func.isRequired
};

// Rendered on confirm delete screen, allows user to unselect photos
const ConfirmDeleteRow = memo(function ConfirmDeleteRow({ photo, unselectPhoto }) {
    return (
        <Fragment>
            <div className="my-auto">
                <button
                    className="btn-close"
                    onClick={() => unselectPhoto(photo)}
                >
                    <XMarkIcon className="w-8 h-8" />
                </button>
            </div>
            <div className="m-auto">
                <img
                    src={photo.thumbnail}
                    className="rounded-lg max-h-20 md:max-h-32"
                />
            </div>
        </Fragment>
    );
});

ConfirmDeleteRow.propTypes = {
    photo: PropTypes.shape({
        thumbnail: PropTypes.string.isRequired,
        key: PropTypes.number.isRequired
    }).isRequired,
    unselectPhoto: PropTypes.func.isRequired
};

const DeletePhotosModal = memo(function DeletePhotosModal({ plantID }) {
    const { photoUrls, deletePhotos } = useTimeline();

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
    const unselectPhoto = (photo) => {
        setSelectedPhotos(selectedPhotos.filter(item => item !== photo));
    };

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
            deletePhotos(data.deleted);

            // Clear selected photos, close modal, reset confirm delete screen
            setSelectedPhotos([]);
            modalRef.current.close();
            setConfirmDelete(false);
        } else {
            const error = await response.json();
            openErrorModal(JSON.stringify(error));
        }
    };

    // Takes index of photo slide, returns link to next slide
    // If last photo return link to first (wrap when end reached)
    const nextPhotoLink = (index) => {
        switch(index) {
            case(photoUrls.length - 1):
                return `#photo${photoUrls[0].key}`;
            default:
                return `#photo${photoUrls[index + 1].key}`;
        }
    };

    // Takes index of photo slide, returns link to prev slide
    // If first slide return link to last (wrap when start reached)
    const prevPhotoLink = (index) => {
        switch(index) {
            case(0):
                return `#photo${photoUrls[photoUrls.length - 1].key}`;
            default:
                return `#photo${photoUrls[index - 1].key}`;
        }
    };

    return (
        <Modal ref={modalRef} onClose={closeDeletePhotosModal}>
            <div className={
                `${confirmDelete ? "hidden" : "flex flex-col overflow-hidden"}`
            }>
                <h1 className="font-bold text-lg md:text-xl mb-4">
                    Delete Photos
                </h1>
                {photoUrls.length > 0 ? (
                    <div className="carousel w-full h-min">
                        {photoUrls.map((photo, index) => (
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
                    >
                        Delete
                    </button>
                </div>
            </div>

            <div className={confirmDelete ? "flex flex-col" : "hidden"}>
                <h1 className="font-bold text-lg md:text-xl mb-4">
                    Confirm Delete
                </h1>

                <div className={clsx(
                    'grid grid-cols-[min-content_1fr] mx-auto px-8 gap-4',
                    'max-h-half-screen overflow-y-scroll'
                )}>
                    {selectedPhotos.map(photo => (
                        // eslint-disable-next-line react/prop-types
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
                    >
                        Delete
                    </button>
                </div>
            </div>
        </Modal>
    );
});

DeletePhotosModal.propTypes = {
    plantID: PropTypes.string.isRequired
};

export default DeletePhotosModal;
