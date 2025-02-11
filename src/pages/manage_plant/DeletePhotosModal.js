import React, { useRef, useState, Fragment } from 'react';
import PropTypes from 'prop-types';
import Modal from 'src/components/Modal';
import { sendPostRequest } from 'src/util';
import { timestampToReadable } from 'src/timestampUtils';
import { showErrorModal } from 'src/components/ErrorModal';
import {
    ChevronLeftIcon,
    ChevronRightIcon,
    XMarkIcon
} from '@heroicons/react/16/solid';

let deletePhotosModalRef;

export const openDeletePhotosModal = () => {
    deletePhotosModalRef.current.showModal();
};

const DeletePhotosModal = ({ plantID, photoUrls, setPhotoUrls }) => {
    deletePhotosModalRef = useRef(null);

    // Controls confirm delete screen visibility
    const [confirmDelete, setConfirmDelete] = useState(false);

    // Track photos to delete
    const [selectedPhotos, setSelectedPhotos ] = useState([]);

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
            let oldPhotoUrls = [...photoUrls];
            setPhotoUrls(oldPhotoUrls.filter(
                photo => !data.deleted.includes(photo.key)
            ));

            // Clear selected photos, close modal, reset confirm delete screen
            setSelectedPhotos([]);
            deletePhotosModalRef.current.close();
            setConfirmDelete(false);
        } else {
            const error = await response.json();
            showErrorModal(JSON.stringify(error));
        }
    };

    // Takes index of photo slide, returns link to next slide
    // If last photo return link to first (wrap when end reached)
    const nextPhotoLink = (index) => {
        switch(index) {
            case(photoUrls.length - 1):
                return '#photo0';
            default:
                return `#photo${index + 1}`;
        }
    };

    // Takes index of photo slide, returns link to prev slide
    // If first slide return link to last (wrap when start reached)
    const prevPhotoLink = (index) => {
        switch(index) {
            case(0):
                return `#photo${photoUrls.length - 1}`;
            default:
                return `#photo${index - 1}`;
        }
    };

    const SelectButton = ({ photo, selected }) => {
        const [btnClass, setBtnClass] = useState(selected ? 'btn-error' : '');

        const toggle = (event) => {
            if (event.target.checked) {
                setBtnClass('btn-error');
                setSelectedPhotos([...selectedPhotos, photo]);
            } else {
                setBtnClass('');
                setSelectedPhotos(selectedPhotos.filter(item => item !== photo));
            }
        };

        return (
            <label className={`btn ${btnClass} rounded-full`}>
                <input
                    type="checkbox"
                    className="hidden"
                    onChange={toggle}
                    defaultChecked={selected}
                />
                Select
            </label>
        );
    };

    SelectButton.propTypes = {
        photo: PropTypes.object.isRequired,
        selected: PropTypes.bool.isRequired
    };

    // Renders single photo slide with next, prev, and select buttons
    const PhotoSlide = ({ photo, index }) => {
        return (
            <div id={`photo${index}`} className="carousel-item relative w-full mx-1">
                <div className="flex flex-col mx-auto">
                    <h1 className="mt-auto mb-1 md:text-lg">
                        {timestampToReadable(photo.created)}
                    </h1>
                    <img
                        loading="lazy"
                        src={photo.thumbnail}
                        className="rounded-xl overflow-hidden mx-auto mb-auto"
                    />
                    <div className={`absolute flex justify-between transform
                                    -translate-y-1/2 left-5 right-5 top-1/2`}
                    >
                        <a href={prevPhotoLink(index)} className="btn btn-circle no-animation">
                            <ChevronLeftIcon className="w-6 h-6" />
                        </a>
                        <a href={nextPhotoLink(index)} className="btn btn-circle no-animation">
                            <ChevronRightIcon className="w-6 h-6" />
                        </a>
                    </div>
                    <div className="absolute flex bottom-5 -translate-x-1/2 left-1/2">
                        <SelectButton
                            photo={photo}
                            selected={selectedPhotos.includes(photo)}
                        />
                    </div>
                </div>
            </div>
        );
    };

    PhotoSlide.propTypes = {
        photo: PropTypes.object.isRequired,
        index: PropTypes.number.isRequired
    };

    // Rendered on confirm delete screen, allows user to unselect photos
    const ConfirmDeleteRow = ({ photo }) => {
        const unselect = () => {
            setSelectedPhotos(selectedPhotos.filter(item => item !== photo));
        };

        return (
            <Fragment>
                <div className="my-auto">
                    <button
                        className="btn-close"
                        onClick={unselect}
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
    };

    ConfirmDeleteRow.propTypes = {
        photo: PropTypes.shape({
            thumbnail: PropTypes.string.isRequired,
            key: PropTypes.number.isRequired
        }).isRequired
    };

    return (
        <Modal dialogRef={deletePhotosModalRef}>
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
                                key={index}
                                photo={photo}
                                index={index}
                            />
                        ))}
                    </div>
                ) : (
                    <p className="my-8">No photos</p>
                )}

                <div className="flex mt-6 mx-auto">
                    <button
                        className="btn mr-2"
                        onClick={() => deletePhotosModalRef.current.close()}
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

            <div className={`${confirmDelete ? "flex flex-col" : "hidden"}`}>
                <h1 className="font-bold text-lg md:text-xl mb-4">
                    Confirm Delete
                </h1>

                <div className={`grid grid-cols-2 grid-cols-[min-content_1fr]
                    mx-auto px-8 gap-4 max-h-half-screen overflow-scroll`}
                >
                    {selectedPhotos.map(photo => (
                        // eslint-disable-next-line react/prop-types
                        <ConfirmDeleteRow key={photo.key} photo={photo} />
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
};

DeletePhotosModal.propTypes = {
    plantID: PropTypes.string.isRequired,
    photoUrls: PropTypes.array.isRequired,
    setPhotoUrls: PropTypes.func.isRequired
};

export default DeletePhotosModal;
