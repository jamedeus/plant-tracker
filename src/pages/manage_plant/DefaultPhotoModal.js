import React, { useRef } from 'react';
import PropTypes from 'prop-types';
import Modal from 'src/components/Modal';
import { sendPostRequest } from 'src/util';
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

    // Takes photo slide index, returns prev/next buttons
    // Prev button disabled on first photo, next button disabled on last photo
    const PhotoButtons = ({ index }) => {
        switch(index) {
            case(0):
                return (
                    <div className={`absolute flex justify-between transform
                                    -translate-y-1/2 left-5 right-5 top-1/2`}
                    >
                        <a className="btn btn-circle" disabled>
                            <ChevronLeftIcon className="w-6 h-6" />
                        </a>
                        <a href={`#slide${index + 1}`} className="btn btn-circle">
                            <ChevronRightIcon className="w-6 h-6" />
                        </a>
                    </div>
                );
            case(photoUrls.length - 1):
                return (
                    <div className={`absolute flex justify-between transform
                                    -translate-y-1/2 left-5 right-5 top-1/2`}
                    >
                        <a href={`#slide${index - 1}`} className="btn btn-circle">
                            <ChevronLeftIcon className="w-6 h-6" />
                        </a>
                        <a className="btn btn-circle" disabled>
                            <ChevronRightIcon className="w-6 h-6" />
                        </a>
                    </div>
                );
            default:
                return (
                    <div className={`absolute flex justify-between transform
                                    -translate-y-1/2 left-5 right-5 top-1/2`}
                    >
                        <a href={`#slide${index - 1}`} className="btn btn-circle">
                            <ChevronLeftIcon className="w-6 h-6" />
                        </a>
                        <a href={`#slide${index + 1}`} className="btn btn-circle">
                            <ChevronRightIcon className="w-6 h-6" />
                        </a>
                    </div>
                );
        }
    };

    PhotoButtons.propTypes = {
        index: PropTypes.number
    };

    //
    const PhotoSlide = ({ index, photoUrl, photoKey }) => {
        return (
            <div id={`slide${index}`} className="carousel-item relative w-full mx-1">
                <img
                    src={photoUrl}
                    className="w-full rounded-xl object-scale-down my-auto"
                />
                <PhotoButtons index={index} />
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
        photoKey: PropTypes.number
    };

    return (
        <Modal dialogRef={defaultPhotoModalRef}>
            <p className="text-lg mb-4">Select Default Photo</p>
            <div className="carousel w-full h-min">
                {photoUrls.map((photo, index) => {
                    return (
                        <PhotoSlide
                            key={index}
                            index={index}
                            photoUrl={photo.thumbnail}
                            photoKey={photo.key}
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
