import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Cookies from 'js-cookie';
import { openErrorModal } from 'src/components/ErrorModal';
import { useDispatch, useSelector } from 'react-redux';
import { photosAdded, pendingPhotosResolved } from './timelineSlice';
import sendPostRequest from 'src/utils/sendPostRequest';
import 'src/css/photomodal.css';

// Interval to check pending photo upload status
const POLL_INTERVAL_MS = 2000;

const PhotoModal = () => {
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const plantID = useSelector((state) => state.plant.plantDetails.uuid);

    // Track number of pending uploads (shows loading animation under buttons)
    const [pendingCount, setPendingCount] = useState(0);
    // Track ids of pending uploads (used to poll for status updates)
    const pendingPhotoIdsRef = useRef([]);
    // Track polling interval id (cancel when no more pending)
    const pollingIntervalRef = useRef(null);

    // Takes /get_photo_upload_status response, updates pending photos
    const handlePendingStatus = useCallback((data) => {
        if (!data?.photos?.length) return;

        // Pending uploads that finished successfully
        const completedPhotos = [];
        // Pending upload ids that finished for any reason
        const resolvedIds = [];
        let failed = 0;

        data.photos.forEach((photo) => {
            if (photo.status === 'complete') {
                completedPhotos.push(photo.photo_details);
                resolvedIds.push(photo.photo_id);
            } else if (photo.status === 'failed') {
                resolvedIds.push(photo.photo_id);
                failed += 1;
            }
        });

        // Update redux state with completed photo details, remove pending flag
        if (completedPhotos.length) {
            dispatch(pendingPhotosResolved(completedPhotos));
        }

        // Remove resolved photos from pending ref, stop polling if all resolved
        pendingPhotoIdsRef.current = pendingPhotoIdsRef.current.filter(
            (id) => !resolvedIds.includes(id)
        );
        if (!pendingPhotoIdsRef.current.length) {
            stopPolling();
        }
        // Update number of pending uploads shown in modal
        setPendingCount((prev) => Math.max(0, prev - resolvedIds.length));

        // Show error if any photos failed
        if (failed) {
            openErrorModal(
                `Failed to upload ${failed} photo${failed === 1 ? '' : 's'}.`
            );
        }
    }, [dispatch]);

    const pollPendingPhotos = async () => {
        const payload = { plant_id: plantID, photo_ids: pendingPhotoIdsRef.current };
        await sendPostRequest('/get_photo_upload_status', payload, handlePendingStatus);
    };

    const startPolling = useCallback(() => {
        pollingIntervalRef.current = setInterval(pollPendingPhotos, POLL_INTERVAL_MS);
    }, []);

    const stopPolling = useCallback(() => {
        clearInterval(pollingIntervalRef.current);
    }, []);

    // Stop polling on unmount (page navigation, doesn't unmount modal closed)
    useEffect(() => stopPolling, []);

    const uploadFiles = useCallback(async (files) => {
        // Start loading animation (or increase count if already running)
        setPendingCount((prev) => prev + files.length);

        // Build formData with photos + object with last modified times for each
        const lastModifiedTimes = {};
        const formData = new FormData();
        files.forEach((file, index) => {
            formData.append(`photo_${index}`, file);
            lastModifiedTimes[`photo_${index}`] = file.lastModified;
        });
        formData.append('plant_id', plantID);
        formData.append('last_modified', JSON.stringify(lastModifiedTimes));

        const response = await fetch('/add_plant_photos', {
            method: 'POST',
            body: formData,
            headers: {
                'Accept': 'application/json, text/plain, */*',
                "X-CSRFToken": Cookies.get('csrftoken')
            }
        });

        if (response.ok) {
            // Add pending photos to redux state (will show spinner until done)
            const data = await response.json();
            if (data.urls.length) {
                dispatch(photosAdded(data.urls));
                pendingPhotoIdsRef.current = pendingPhotoIdsRef.current.concat(
                    data.urls.map(photo => photo.key)
                );
                // Start polling pending upload status
                startPolling();
            }
            // Show error if any photos failed
            if (data.failed.length) {
                const num = data.failed.length;
                const list = data.failed.join('\n');
                openErrorModal(`Failed to upload ${num} photos:\n${list}`);
                // Update number of pending uploads shown in modal
                setPendingCount((prev) => Math.max(0, prev - num));
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
            // Update number of pending uploads shown in modal
            setPendingCount((prev) => Math.max(0, prev - files.length));
        }
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

export default PhotoModal;
