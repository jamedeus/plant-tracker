import React, { useState, useRef, useCallback, memo } from 'react';
import PropTypes from 'prop-types';
import Cookies from 'js-cookie';
import Modal from 'src/components/Modal';
import LoadingAnimation from 'src/components/LoadingAnimation';
import CloseButtonIcon from 'src/components/CloseButtonIcon';
import { openErrorModal } from 'src/components/ErrorModal';
import { useDispatch, useSelector } from 'react-redux';
import { photosAdded } from './timelineSlice';
import './photomodal.css';

let modalRef;

export const openPhotoModal = () => {
    modalRef.current.open();
};

// Grid row with delete button next to filename
const Row = memo(function Row({ filename, removeFile }) {
    return (
        <>
            <div className="my-auto py-3 pe-4">
                <button
                    className="btn-close"
                    onClick={() => removeFile(filename)}
                >
                    <CloseButtonIcon />
                </button>
            </div>
            <div className="text-lg leading-8 w-full text-center py-3 ps-4">
                <p className="w-full line-clamp-1">{filename}</p>
            </div>
        </>
    );
});

Row.propTypes = {
    filename: PropTypes.string.isRequired,
    removeFile: PropTypes.func.isRequired
};

const PhotoModal = () => {
    const dispatch = useDispatch();
    const plantID = useSelector((state) => state.plant.plantDetails.uuid);

    modalRef = useRef(null);
    // File input ref, used to remove selected files when X buttons clicked
    const inputRef = useRef(null);

    // State updated when user selects files, used in submit hook and to
    // render row for each selected file with X button to unselect
    const [selectedFiles, setSelectedFiles] = useState([]);

    // State to control loading animation visibility
    const [uploading, setUploading] = useState(false);

    const handleSelect = (event) => {
        setSelectedFiles(Array.from(event.target.files));
    };

    const resetSelection = () => {
        // Clear selectedFiles state
        setSelectedFiles([]);
        // Replace file input value with empty FileList
        if (inputRef.current) {
            const data = new DataTransfer();
            inputRef.current.files = data.files;
        }
    };

    const handleSubmit = async () => {
        // Start loading animation
        setUploading(true);

        // Create FormData containing all photos + plant UUID
        const formData = new FormData();
        selectedFiles.forEach((file, index) => {
            formData.append(`photo_${index}`, file);
        });
        formData.append('plant_id', plantID);

        // Post FormData to backend
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

            // Close modal, wait for close animation to complete then stop
            // loading animation and remove selected files from input/state
            modalRef.current.close();
            setTimeout(() => {
                setUploading(false);
                resetSelection();
            }, 150);

            // Show error if any photos failed
            if (data.failed.length) {
                const num = data.failed.length;
                const list = data.failed.join('\n');
                openErrorModal(`Failed to upload ${num} photos:\n${list}`);
            }
        } else {
            setUploading(false);
            resetSelection();
            // Redirect to login page if  user not signed in/session expired
            if (response.status === 401) {
                window.location.href = '/accounts/login/';
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
    };

    // Handler for delete button shown next to each selected file
    const removeFile = useCallback((filename) => {
        // Remove deleted file from state
        setSelectedFiles((prevSelectedFiles) => {
            return prevSelectedFiles.filter(file => file.name !== filename);
        });

        // Copy input FileList into array, remove deleted file
        const inputFiles = Array.from(inputRef.current.files);
        const newFiles = inputFiles.filter(file => file.name !== filename);

        // Add remaining files to DataTransfer, overwrite input FileList
        const data = new DataTransfer();
        for (let file of newFiles) {
            data.items.add(file);
        }
        inputRef.current.files = data.files;
    }, []);

    return (
        <Modal
            title={uploading ? "Uploading..." : "Upload Photos"}
            ref={modalRef}
        >
            {/* Photo select/unselect input, shown until user clicks submit */}
            <div className={uploading ? "hidden" : "flex flex-col"}>
                <div className={
                    "min-h-36 flex flex-col justify-center items-center mt-2"
                }>
                    <input
                        ref={inputRef}
                        type="file"
                        accept="image/*"
                        multiple="multiple"
                        className="file-input w-full max-w-xs"
                        onChange={handleSelect}
                        data-testid="photo-input"
                    />
                    <div className="selected-files-grid">
                        {selectedFiles.map(file => (
                            <Row
                                key={file.name}
                                filename={file.name}
                                removeFile={removeFile}
                            />
                        ))}
                    </div>
                </div>

                <div className="modal-action mx-auto">
                    <button
                        className="btn btn-accent"
                        onClick={handleSubmit}
                        disabled={!selectedFiles.length}
                    >
                        Upload
                    </button>
                </div>
            </div>

            {/* Loading animation shown after user clicks submit */}
            <div className={uploading ? "flex flex-col" : "hidden"}>
                <LoadingAnimation className="mx-auto" />
            </div>
        </Modal>
    );
};

export default PhotoModal;
