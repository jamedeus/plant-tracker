import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import PropTypes from 'prop-types';
import Cookies from 'js-cookie';
import { openErrorModal } from 'src/components/ErrorModal';
import { useDispatch, useSelector } from 'react-redux';
import { photosAdded } from './timelineSlice';
import 'src/css/photomodal.css';

const PhotoModal = ({ close }) => {
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const plantID = useSelector((state) => state.plant.plantDetails.uuid);

    // Track number of pending uploads (shows loading animation under buttons)
    const [pendingCount, setPendingCount] = useState(0);

    const uploadFiles = useCallback(async (files) => {
        // Start loading animation (or increase count if already running)
        setPendingCount((prev) => prev + files.length);

        const formData = new FormData();
        files.forEach((file, index) => {
            formData.append(`photo_${index}`, file);
        });
        formData.append('plant_id', plantID);

        const response = await fetch('/add_plant_photos', {
            method: 'POST',
            body: formData,
            headers: {
                'Accept': 'application/json, text/plain, */*',
                "X-CSRFToken": Cookies.get('csrftoken')
            }
        });

        if (response.ok) {
            // Update state with new photo URLs from response
            const data = await response.json();
            if (data.urls.length) {
                dispatch(photosAdded(data.urls));
            }
            // Show error if any photos failed
            if (data.failed.length) {
                const num = data.failed.length;
                const list = data.failed.join('\n');
                openErrorModal(`Failed to upload ${num} photos:\n${list}`);
            }
        } else {
            // Redirect to login page if user not signed in/session expired
            if (response.status === 401) {
                navigate('/accounts/login/');
            // Show error if proxy client_max_body_size exceeded
            } else if (response.status === 413) {
                openErrorModal(
                    'Your upload was too big to process. ' +
                    'Please try again with fewer photos.'
                );
            // Show other errors in modal
            } else {
                try {
                    const error = await response.json();
                    openErrorModal(JSON.stringify(error));
                } catch(err) {
                    openErrorModal('Unexpected response from backend');
                }
            }
        }

        // Stop loading animation (or decrease count if more pending uploads)
        setPendingCount((prev) => Math.max(0, prev - files.length));
    }, [dispatch, navigate, plantID]);

    const handleSelect = useCallback((event) => {
        // Upload selected files
        if (event.target.files.length) {
            uploadFiles(Array.from(event.target.files));
        }
        // Clear input (prevent duplicates if user selects more)
        event.target.value = '';
    }, [uploadFiles]);

    return (
        <div className="flex flex-col justify-center items-center gap-8 min-h-72">
            <div className="flex flex-col mt-16 gap-4 w-full max-w-xs">
                {/* Select existing photos from device */}
                <input
                    id="photo-input"
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleSelect}
                    data-testid="photo-input"
                />
                <label htmlFor="photo-input" className="btn btn-accent">
                    Select photos
                </label>

                {/* Take new photo */}
                <input
                    id="photo-camera-input"
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handleSelect}
                    data-testid="photo-camera-input"
                />
                <label htmlFor="photo-camera-input" className="btn btn-accent">
                    Take photo
                </label>
            </div>

            {/* Show pending upload count while uploading */}
            <div className="flex flex-col h-15 items-center gap-2">
                {pendingCount > 0 && (
                    <>
                        <span className="loading loading-dots loading-lg text-primary" />
                        <span className="font-medium">
                            Uploading {pendingCount} photo{pendingCount === 1 ? '' : 's'}...
                        </span>
                    </>
                )}
            </div>
        </div>
    );
};

PhotoModal.propTypes = {
    close: PropTypes.func.isRequired
};

export default PhotoModal;
