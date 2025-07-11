import React, { useRef, useCallback, memo } from 'react';
import PropTypes from 'prop-types';
import Modal from 'src/components/Modal';
import { sendPostRequest } from 'src/util';
import { timestampToReadable } from 'src/timestampUtils';
import { openErrorModal } from 'src/components/ErrorModal';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/16/solid';
import clsx from 'clsx';
import { useSelector, useDispatch } from 'react-redux';
import { defaultPhotoChanged } from './timelineSlice';

let modalRef;

export const openDefaultPhotoModal = () => {
    modalRef.current.open();
};

export const preloadDefaultPhotoModal = () => {
    requestAnimationFrame(() => {
        modalRef.current.preload();
    });
};

// Renders single photo slide with next, prev, and select buttons
const PhotoSlide = memo(function PhotoSlide({
    photo,
    nextPhotoLink,
    prevPhotoLink,
    submit
}) {
    return (
        <div
            id={`slide${photo.key}`}
            className="carousel-item relative w-full mx-1"
            title={timestampToReadable(photo.timestamp)}
        >
            <img
                loading="lazy"
                draggable={false}
                src={photo.preview}
                className="w-full rounded-xl object-contain my-auto"
            />
            <div className={clsx(
                'absolute flex justify-between transform -translate-y-1/2',
                'left-5 right-5 top-1/2'
            )}>
                <a href={prevPhotoLink} className="btn btn-circle">
                    <ChevronLeftIcon className="size-6" />
                </a>
                <a href={nextPhotoLink} className="btn btn-circle">
                    <ChevronRightIcon className="size-6" />
                </a>
            </div>
            <div className="absolute flex bottom-5 -translate-x-1/2 left-1/2">
                <button
                    className="btn rounded-full font-bold"
                    onClick={() => submit(photo)}
                >
                    Select
                </button>
            </div>
        </div>
    );
});

PhotoSlide.propTypes = {
    photo: PropTypes.shape({
        key: PropTypes.number.isRequired,
        timestamp: PropTypes.string.isRequired,
        thumbnail: PropTypes.string.isRequired,
        preview: PropTypes.string.isRequired,
        photo: PropTypes.string.isRequired
    }).isRequired,
    nextPhotoLink: PropTypes.string.isRequired,
    prevPhotoLink: PropTypes.string.isRequired,
    submit: PropTypes.func.isRequired
};

const DefaultPhotoModal = () => {
    const dispatch = useDispatch();
    const plantID = useSelector((state) => state.plant.plantDetails.uuid);
    const photos = useSelector((state) => state.timeline.photos);

    modalRef = useRef(null);

    const submit = useCallback(async (selected) => {
        const payload = {
            plant_id: plantID,
            photo_key: selected.key
        };
        const response = await sendPostRequest(
            '/set_plant_default_photo',
            payload
        );
        if (response.ok) {
            modalRef.current.close();
            const data = await response.json();
            dispatch(defaultPhotoChanged(data.default_photo));
        } else {
            const error = await response.json();
            openErrorModal(error);
        }
    }, []);

    // Takes index of photo slide, returns link to next slide
    // If last slide return link to first (wrap when end reached)
    const nextPhotoLink = (index) => {
        switch(index) {
            case(photos.length - 1):
                return `#slide${photos[0].key}`;
            default:
                return `#slide${photos[index + 1].key}`;
        }
    };

    // Takes index of photo slide, returns link to prev slide
    // If first slide return link to last (wrap when start reached)
    const prevPhotoLink = (index) => {
        switch(index) {
            case(0):
                return `#slide${photos[photos.length - 1].key}`;
            default:
                return `#slide${photos[index - 1].key}`;
        }
    };

    return (
        <Modal title='Select Default Photo' ref={modalRef}>
            <div className="carousel w-full h-min">
                {photos.length > 0 ? (
                    photos.map((photo, index) => (
                        <PhotoSlide
                            key={photo.key}
                            photo={photo}
                            nextPhotoLink={nextPhotoLink(index)}
                            prevPhotoLink={prevPhotoLink(index)}
                            submit={submit}
                        />
                    ))
                ) : (
                    <p className="my-8 mx-auto">No photos</p>
                )}
            </div>
        </Modal>
    );
};

export default DefaultPhotoModal;
