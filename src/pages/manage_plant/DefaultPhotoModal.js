import React, { useRef } from 'react';
import PropTypes from 'prop-types';
import Modal from 'src/components/Modal';
import { sendPostRequest } from 'src/util';
import { timestampToReadable } from 'src/timestampUtils';
import { useErrorModal } from 'src/context/ErrorModalContext';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/16/solid';

let defaultPhotoModalRef;

export const openDefaultPhotoModal = () => {
    defaultPhotoModalRef.current.showModal();
};

const DefaultPhotoModal = ({ plantID, photoUrls }) => {
    defaultPhotoModalRef = useRef(null);

    // Get hook to show error modal
    const { showErrorModal } = useErrorModal();

    const submit = async (selected) => {
        const payload = {
            plant_id: plantID,
            photo_key: selected
        };
        const response = await sendPostRequest('/set_plant_default_photo', payload);
        if (response.ok) {
            defaultPhotoModalRef.current.close();
        } else {
            const error = await response.json();
            showErrorModal(error);
        }
    };

    // Takes index of photo slide, returns link to next slide
    // If last slide return link to first (wrap when end reached)
    const nextPhotoLink = (index) => {
        switch(index) {
            case(photoUrls.length - 1):
                return '#slide0';
            default:
                return `#slide${index + 1}`;
        }
    };

    // Takes index of photo slide, returns link to prev slide
    // If first slide return link to last (wrap when start reached)
    const prevPhotoLink = (index) => {
        switch(index) {
            case(0):
                return `#slide${photoUrls.length - 1}`;
            default:
                return `#slide${index - 1}`;
        }
    };

    // Renders single photo slide with next, prev, and select buttons
    const PhotoSlide = ({ index, photoUrl, photoKey, timestamp }) => {
        return (
            <div
                id={`slide${index}`} className="carousel-item relative w-full mx-1"
                title={timestampToReadable(timestamp)}
            >
                <img
                    src={photoUrl}
                    className="w-full rounded-xl object-scale-down my-auto"
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
                    <button
                        className="btn rounded-full text-white font-bold"
                        onClick={() => submit(photoKey)}
                    >
                        Select
                    </button>
                </div>
            </div>
        );
    };

    PhotoSlide.propTypes = {
        index: PropTypes.number,
        photoUrl: PropTypes.string,
        photoKey: PropTypes.number,
        timestamp: PropTypes.string
    };

    return (
        <Modal dialogRef={defaultPhotoModalRef} title={"Select Default Photo"}>
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
        </Modal>
    );
};

DefaultPhotoModal.propTypes = {
    plantID: PropTypes.string,
    photoUrls: PropTypes.array
};

export default DefaultPhotoModal;
