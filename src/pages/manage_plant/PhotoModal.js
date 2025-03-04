import React, { useState, useRef, useCallback, memo } from 'react';
import PropTypes from 'prop-types';
import Cookies from 'js-cookie';
import Modal from 'src/components/Modal';
import LoadingAnimation from 'src/components/LoadingAnimation';
import { XMarkIcon } from '@heroicons/react/16/solid';
import { showErrorModal } from 'src/components/ErrorModal';

let photoModalRef;

export const openPhotoModal = () => {
    photoModalRef.current.showModal();
};

// Table row with delete button next to filename
const Row = memo(function Row({ filename, removeFile }) {
    return (
        <tr className="flex max-w-96">
            <td className="my-auto">
                <button
                    className="btn-close"
                    onClick={() => removeFile(filename)}
                >
                    <XMarkIcon className="w-8 h-8" />
                </button>
            </td>
            <td className="text-lg leading-8 w-full text-center">
                <p className="w-full line-clamp-1">{filename}</p>
            </td>
        </tr>
    );
});

Row.propTypes = {
    filename: PropTypes.string.isRequired,
    removeFile: PropTypes.func.isRequired
};

const PhotoModal = ({ plantID, photoUrls, setPhotoUrls }) => {
    photoModalRef = useRef(null);
    // File input ref, used to remove selected files when X buttons clicked
    const inputRef = useRef(null);

    // State updated when user selects files, used in submit hook and to
    // render table of selected files with X buttons to unselect
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

    // Takes photo URLs from API response when new photos are uploaded
    const addPlantPhotoUrls = (newUrls) => {
        // Add new URLs to photoUrl state, sort chronologically, re-render
        const newPhotoUrls = photoUrls.concat(newUrls);
        newPhotoUrls.sort((a, b) => {
            return a.created.localeCompare(b.created);
        }).reverse();
        setPhotoUrls(newPhotoUrls);
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
                addPlantPhotoUrls(data.urls);
            }

            // Close modal, wait for close animation to complete then stop
            // loading animation and remove selected files from input/state
            photoModalRef.current.close();
            setTimeout(() => {
                setUploading(false);
                resetSelection();
            }, 150);

            // Show error if any photos failed
            if (data.failed.length) {
                const num = data.failed.length;
                const list = data.failed.join('\n');
                showErrorModal(`Failed to upload ${num} photos:\n${list}`);
            }
        } else {
            setUploading(false);
            resetSelection();
            try {
                const error = await response.json();
                showErrorModal(JSON.stringify(error));
            } catch(err) {
                showErrorModal('Unexpected response from backend');
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
            dialogRef={photoModalRef}
            title={uploading ? "Uploading..." : "Upload Photos"}
        >
            {/* Photo select/unselect input, shown until user clicks submit */}
            <div className={uploading ? "hidden" : "flex flex-col"}>
                <div className="min-h-36 flex flex-col justify-center mx-auto mt-2 max-w-full">
                    <input
                        ref={inputRef}
                        type="file"
                        accept="image/*"
                        multiple="multiple"
                        className="file-input file-input-bordered w-full max-w-xs"
                        onChange={handleSelect}
                        data-testid="photo-input"
                    />
                    <div className="max-h-half-screen overflow-y-scroll overflow-x-hidden">
                        <table className="table mt-2">
                            <tbody>
                                {selectedFiles.map(file => (
                                    <Row
                                        key={file.name}
                                        filename={file.name}
                                        removeFile={removeFile}
                                    />
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="modal-action mx-auto">
                    <button
                        className="btn btn-success"
                        onClick={handleSubmit}
                        disabled={!selectedFiles.length}
                    >
                        Upload
                    </button>
                </div>
            </div>

            {/* Loading animation shown after user clicks submit */}
            <div className={uploading ? "flex flex-col" : "hidden"}>
                <LoadingAnimation />
            </div>
        </Modal>
    );
};

PhotoModal.propTypes = {
    plantID: PropTypes.string.isRequired,
    photoUrls: PropTypes.array.isRequired,
    setPhotoUrls: PropTypes.func.isRequired
};

export default PhotoModal;
