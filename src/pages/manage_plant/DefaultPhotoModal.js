import React, { useRef, useCallback, memo } from 'react';
import PropTypes from 'prop-types';
import Modal from 'src/components/Modal';
import { sendPostRequest } from 'src/util';
import { timestampToReadable } from 'src/timestampUtils';
import { openErrorModal } from 'src/components/ErrorModal';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/16/solid';
import { useTimeline } from './TimelineContext';
import clsx from 'clsx';

let modalRef;

export const openDefaultPhotoModal = () => {
    modalRef.current.open();
};

export const preloadDefaultPhotoModal = () => {
    requestAnimationFrame(() => {
        modalRef.current.preload();
    });
};

export const closeDefaultPhotosModal = () => {
    modalRef.current.close();
};

// Renders single photo slide with next, prev, and select buttons
const PhotoSlide = memo(function PhotoSlide({ photo, nextPhotoLink, prevPhotoLink, submit }) {
    return (
        <div
            id={`slide${photo.key}`}
            className="carousel-item relative w-full mx-1"
            title={timestampToReadable(photo.created)}
        >
            <img
                loading="lazy"
                src={photo.thumbnail}
                className="w-full rounded-xl object-scale-down my-auto"
            />
            <div className={clsx(
                'absolute flex justify-between transform -translate-y-1/2',
                'left-5 right-5 top-1/2'
            )}>
                <a href={prevPhotoLink} className="btn btn-circle">
                    <ChevronLeftIcon className="w-6 h-6" />
                </a>
                <a href={nextPhotoLink} className="btn btn-circle">
                    <ChevronRightIcon className="w-6 h-6" />
                </a>
            </div>
            <div className="absolute flex bottom-5 -translate-x-1/2 left-1/2">
                <button
                    className="btn rounded-full font-bold"
                    onClick={() => submit(photo.key)}
                >
                    Select
                </button>
            </div>
        </div>
    );
});

PhotoSlide.propTypes = {
    photo: PropTypes.object.isRequired,
    nextPhotoLink: PropTypes.string.isRequired,
    prevPhotoLink: PropTypes.string.isRequired,
    submit: PropTypes.func.isRequired
};

const DefaultPhotoModal = memo(function DefaultPhotoModal({ plantID }) {
    const { photoUrls } = useTimeline();

    modalRef = useRef(null);

    const submit = useCallback(async (selected) => {
        const payload = {
            plant_id: plantID,
            photo_key: selected
        };
        const response = await sendPostRequest('/set_plant_default_photo', payload);
        if (response.ok) {
            closeDefaultPhotosModal();
        } else {
            const error = await response.json();
            openErrorModal(error);
        }
    }, []);

    // Takes index of photo slide, returns link to next slide
    // If last slide return link to first (wrap when end reached)
    const nextPhotoLink = (index) => {
        switch(index) {
            case(photoUrls.length - 1):
                return `#slide${photoUrls[0].key}`;
            default:
                return `#slide${photoUrls[index + 1].key}`;
        }
    };

    // Takes index of photo slide, returns link to prev slide
    // If first slide return link to last (wrap when start reached)
    const prevPhotoLink = (index) => {
        switch(index) {
            case(0):
                return `#slide${photoUrls[photoUrls.length - 1].key}`;
            default:
                return `#slide${photoUrls[index - 1].key}`;
        }
    };

    return (
        <Modal
            title='Select Default Photo'
            ref={modalRef}
            onClose={closeDefaultPhotosModal}
        >
            <div className="carousel w-full h-min">
                {photoUrls.map((photo, index) => (
                    <PhotoSlide
                        key={photo.key}
                        photo={photo}
                        nextPhotoLink={nextPhotoLink(index)}
                        prevPhotoLink={prevPhotoLink(index)}
                        submit={submit}
                    />
                ))}
            </div>
        </Modal>
    );
});

DefaultPhotoModal.propTypes = {
    plantID: PropTypes.string.isRequired
};

export default DefaultPhotoModal;
