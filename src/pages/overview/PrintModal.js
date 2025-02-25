import React, { useState, useRef, useImperativeHandle } from 'react';
import PropTypes from 'prop-types';
import clsx from 'clsx';
import { Tab } from '@headlessui/react';
import print from 'print-js';
import Modal from 'src/components/Modal';
import { sendPostRequest } from 'src/util';

// QR code size options + description text shown when selected
const sizeOptions = {
    small: {
        qr_per_row: 8,
        size: "About ¾ inch wide",
        per_sheet: "96"
    },
    medium: {
        qr_per_row: 6,
        size: "About 1 inch wide",
        per_sheet: "48"
    },
    large: {
        qr_per_row: 4,
        size: "About 1 ½ inches wide",
        per_sheet: "20"
    }
};

// Takes error state, renders more descriptive error message
const ErrorMessage = ({ error }) => {
    switch(error) {
        case("unset"):
            return (
                <>
                    <p>The URL_PREFIX environment variable is not set</p>
                    <p>Check docker config</p>
                </>
            );
        case("long"):
            return (
                <>
                    <p>Unable to generate QR codes</p>
                    <p>Try setting a shorter URL_PREFIX in docker config</p>
                </>
            );
        default:
            return (
                <p>An unknown error occurred</p>
            );
    }
};

ErrorMessage.propTypes = {
    error: PropTypes.string.isRequired
};

const PrintModal = React.forwardRef(function PrintModal(_, ref) {
    // State controls modal contents, must be "options", "loading", or "error"
    const [modalContents, setModalContents] = useState("options");

    // Selected size option, default to small
    const [qrSize, setQrSize] = useState(sizeOptions.small);

    // State controls ErrorMessage text, must be "unset", "long", or "unknown"
    const [error, setError] = useState("");

    // Ref used to abort printing if user clicks cancel before API response
    // Set to true when request starts, response only processed if still true
    const cancelPrinting = useRef(false);

    const printModalRef = useRef(null);

    // Make open method available in parent component
    useImperativeHandle(ref, () => {
        return {
            open() {
                printModalRef.current.showModal();
            },
        };
    });

    // Cancel button handler, aborts printing and resets modal contents
    const cancel = () => {
        cancelPrinting.current = true;
        setModalContents("options");
    };

    // Called by listener when modal is closed - aborts printing immediately,
    // waits for close animation to complete then resets modal contents
    const resetModal = () => {
        cancelPrinting.current = true;
        setTimeout(() => {
            setModalContents("options");
        }, 150);
    };

    // Request QR codes from backend, open print dialog if user did not cancel
    const fetchQrCodes = async (size) => {
        // State starts loading animation (will change back if user cancels)
        setModalContents("loading");

        // Request Base64-encoded image string from backend
        const response = await sendPostRequest(
            '/get_qr_codes',
            {qr_per_row: size}
        );

        // Check response if user did not click cancel or close modal
        if (cancelPrinting.current === false) {
            // Open QR codes in print dialog if response OK
            if (response.ok) {
                const data = await response.json();
                printQrCodes(data.qr_codes);
            // Replace loading animation with error if response not OK
            } else {
                handleError(response.status);
            }
        } else {
            console.log("Print QR codes canceled by user");
        }
    };

    // Takes base64 image string, decodes and opens in print dialog
    const printQrCodes = (data) => {
        console.log(data);
        // Decode base64 image data to binary
        const imageData = atob(data);

        // Create Uint8Array with same length
        const imageBuffer = new ArrayBuffer(imageData.length);
        const imageBytes = new Uint8Array(imageBuffer);

        // Read bytes into array
        for (let i = 0; i < imageData.length; i++) {
            imageBytes[i] = imageData.charCodeAt(i);
        }

        // Create blob object from buffer, set MIME type
        const qr = new Blob([imageBytes], { type: 'image/png' });
        const uri = URL.createObjectURL(qr);

        // Open print dialog, close print modal
        print({
            printable: uri,
            type: 'image',
            documentTitle: '',
            header: null,
            footer: null
        });
        printModalRef.current.close();
    };

    const generate = () => {
        cancelPrinting.current = false;
        fetchQrCodes(qrSize.qr_per_row);
    };

    // Takes status code from failed API call, shows correct error in modal
    const handleError = (statusCode) => {
        // Set state that controls error text based on status code
        if (statusCode === 501) {
            setError("unset");
        } else if (statusCode === 500) {
            setError("long");
        } else {
            setError("unknown");
        }

        // Change modal contents to error
        setModalContents("error");
    };

    switch(modalContents) {
        case("loading"):
            return (
                <Modal
                    dialogRef={printModalRef}
                    title='Fetching QR Codes'
                    onClose={resetModal}
                >
                    <div className="h-36 mt-2 flex flex-col justify-center mx-auto">
                        <span className="loading loading-spinner loading-lg"></span>
                    </div>
                    <div className="modal-action mx-auto">
                        <button className="btn" onClick={cancel}>Cancel</button>
                    </div>
                </Modal>
            );
        case("options"):
            return (
                <Modal
                    dialogRef={printModalRef}
                    title='Select QR Code Size'
                >
                    <div className="h-36 mt-2 flex flex-col justify-center">
                        <Tab.Group onChange={(index) => {
                            setQrSize(Object.values(sizeOptions)[index]);
                        }}>
                            <Tab.List className="tab-group">
                                {Object.keys(sizeOptions).map((option) => (
                                    <Tab key={option} className={({ selected }) =>
                                        clsx(
                                            'tab-option',
                                            selected && 'tab-option-selected'
                                        )
                                    }>
                                        {option}
                                    </Tab>
                                ))}
                            </Tab.List>
                            <Tab.Panels className="mt-4">
                                {Object.values(sizeOptions).map((option, idx) => (
                                    <Tab.Panel key={idx}>
                                        <span className="text-center">
                                            {option.size}<br/>
                                            {option.per_sheet} QR codes per sheet
                                        </span>
                                    </Tab.Panel>
                                ))}
                            </Tab.Panels>
                        </Tab.Group>
                    </div>

                    <div className="modal-action mx-auto">
                        <button className="btn btn-accent" onClick={generate}>
                            Generate
                        </button>
                    </div>
                </Modal>
            );
        default:
            return (
                <Modal
                    dialogRef={printModalRef}
                    title='Error'
                    onClose={resetModal}
                >
                    <div className="h-36 mt-2 flex flex-col justify-center mx-auto">
                        <ErrorMessage error={error} />
                    </div>
                    <div className="modal-action mx-auto">
                        <button className="btn" onClick={cancel}>OK</button>
                    </div>
                </Modal>
            );
    }
});

export default PrintModal;
