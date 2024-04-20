import React, { useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { DateTime } from 'luxon';
import Modal from 'src/components/Modal';
import { sendPostRequest } from 'src/util';
import { useErrorModal } from 'src/context/ErrorModalContext';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/16/solid';

let deletePhotosModalRef;

export const openDeletePhotosModal = () => {
    deletePhotosModalRef.current.showModal();
};

const DeletePhotosModal = ({ plantID, photoUrls, setPhotoUrls }) => {
    deletePhotosModalRef = useRef(null);

    // Track photos to delete
    const selected = useRef([]);

    // Get hook to show error modal
    const { showErrorModal } = useErrorModal();

    // Delete button handler
    const deleteSelected = async () => {
        // Build payload with plant UUID and array of selected photo IDs
        const payload = {
            plant_id: plantID,
            delete_photos: selected.current.map(key => parseInt(key))
        };
        const response = await sendPostRequest('/delete_plant_photos', payload);
        // If successful remove photos from history column
        if (response.ok) {
            const data = await response.json();
            let oldPhotoUrls = [...photoUrls];
            setPhotoUrls(oldPhotoUrls.filter(
                photo => !data.deleted.includes(photo.key)
            ));

            // Clear selected photos, close modal
            selected.current = [];
            deletePhotosModalRef.current.close();
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
                return '#photo0'
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

    const SelectButton = ({ photoKey }) => {
        const [btnClass, setBtnClass] = useState('');

        const toggle = (event) => {
            if (event.target.checked) {
                setBtnClass('btn-error');
                selected.current.push(photoKey);
            } else {
                setBtnClass('');
                selected.current = selected.current.filter(item => item !== photoKey);
            }
        };

        return (
            <label className={`btn ${btnClass} text-white rounded-full`}>
                <input
                    type="checkbox"
                    className="hidden"
                    onChange={toggle}
                />
                Select
            </label>
        );
    };

    // Renders single photo slide with next, prev, and select buttons
    const PhotoSlide = ({ index, photoUrl, photoKey, timestamp }) => {
        return (
            <div id={`photo${index}`} className="carousel-item relative w-full mx-1">
                <div className="flex flex-col">
                    <h1 className="mt-auto mb-1 md:text-lg">
                        {DateTime.fromISO(timestamp).toFormat('MMMM dd, yyyy')}
                    </h1>
                    <img
                        src={photoUrl}
                        className="w-full rounded-xl object-scale-down mb-auto"
                    />
                    <div className={`absolute flex justify-between transform
                                    -translate-y-1/2 left-5 right-5 top-1/2`}
                    >
                        <a href={prevPhotoLink(index)} className="btn btn-circle">
                            <ChevronLeftIcon className="w-6 h-6" />
                        </a>
                        <a href={nextPhotoLink(index)} className="btn btn-circle">
                            <ChevronRightIcon className="w-6 h-6" />
                        </a>
                    </div>
                    <div className="absolute flex bottom-5 -translate-x-1/2 left-1/2">
                        <SelectButton photoKey={photoKey} />
                    </div>
                </div>
            </div>
        );
    };

    PhotoSlide.propTypes = {
        index: PropTypes.number,
        photoUrl: PropTypes.string,
        photoKey: PropTypes.number
    };

    return (
        <Modal dialogRef={deletePhotosModalRef}>
            <p className="text-lg mb-4">Delete Photos</p>
            <div className="carousel w-full h-min">
                {photoUrls.map((photo, index) => {
                    return (
                        <PhotoSlide
                            key={index}
                            index={index}
                            photoUrl={photo.thumbnail}
                            photoKey={photo.key}
                            timestamp={photo.created}
                        />
                    );
                })}
            </div>
            <div className="modal-action mx-auto">
                <button
                    className="btn mr-2"
                    onClick={() => deletePhotosModalRef.current.close()}
                >
                    Cancel
                </button>
                <button
                    className="btn btn-error btn-outline ml-2"
                    onClick={deleteSelected}
                >
                    Delete
                </button>
            </div>
        </Modal>
    );
};

DeletePhotosModal.propTypes = {
    plantID: PropTypes.string,
    photoUrls: PropTypes.array
};

export default DeletePhotosModal;
