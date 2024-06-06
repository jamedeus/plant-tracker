import React, { useState, useRef } from 'react';
import PropTypes from 'prop-types';
import Cookies from 'js-cookie';
import Modal from 'src/components/Modal';
import { XMarkIcon } from '@heroicons/react/16/solid';
import { useErrorModal } from 'src/context/ErrorModalContext';

let photoModalRef;

export const openPhotoModal = () => {
    photoModalRef.current.showModal();
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

    // Get hook to show error modal
    const { showErrorModal } = useErrorModal();

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
            addPlantPhotoUrls(data.urls);

            // Close modal, wait for close animation to complete then stop
            // loading animation and remove selected files from input/state
            photoModalRef.current.close();
            setTimeout(() => {
                setUploading(false);
                resetSelection();
            }, 150);
        } else {
            const error = await response.json();
            showErrorModal(JSON.stringify(error));
            setUploading(false);
        }
    };

    // Displays selected files under input
    const SelectedFiles = () => {
        // Handler for delete button shown next to each selected file
        const removeFile = (filename) => {
            // Remove deleted file from state
            setSelectedFiles(selectedFiles.filter(file => file.name !== filename));

            // Copy input FileList into array, remove deleted file
            const inputFiles = Array.from(inputRef.current.files);
            const newFiles = inputFiles.filter(file => file.name !== filename);

            // Add remaining files to DataTransfer, overwrite input FileList
            const data = new DataTransfer();
            for (let file of newFiles) {
                data.items.add(file);
            }
            inputRef.current.files = data.files;
        };

        // Table row with delete button next to filename
        const Row = ({ filename }) => {
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
                        <p className="w-full truncate">{filename}</p>
                    </td>
                </tr>
            );
        };

        PhotoModal.propTypes = {
            filename: PropTypes.string
        };

        // Return table with 1 row for each selected file
        return (
            <div className="max-h-half-screen overflow-y-scroll overflow-x-hidden">
                <table className="table mt-2">
                    <tbody>
                        {selectedFiles.map(file => {
                            return <Row key={file.name} filename={file.name} />;
                        })}
                    </tbody>
                </table>
            </div>
        );
    };

    return (
        <Modal
            dialogRef={photoModalRef}
            title={`${uploading ? "Uploading..." : "Upload Photos"}`}
        >
            {/* Photo select/unselect input, shown until user clicks submit */}
            <div className={`${uploading ? "hidden" : "flex flex-col"}`}>
                <div className="min-h-36 flex flex-col justify-center mt-2">
                    <input
                        ref={inputRef}
                        type="file"
                        accept="image/*"
                        multiple="multiple"
                        className="file-input file-input-bordered w-full max-w-xs mx-auto"
                        onChange={handleSelect}
                        data-testid="photo-input"
                    />
                    <SelectedFiles />
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
            <div className={`${uploading ? "flex flex-col" : "hidden"}`}>
                <div className="h-36 flex flex-col justify-center mx-auto">
                    <span className="loading loading-spinner loading-lg"></span>
                </div>
            </div>
        </Modal>
    );
};

PhotoModal.propTypes = {
    plantID: PropTypes.string,
    photoUrls: PropTypes.array,
    setPhotoUrls: PropTypes.func
};

export default PhotoModal;
