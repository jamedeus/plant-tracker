import React, { useState, useEffect, useRef, memo } from 'react';
import PropTypes from 'prop-types';
import clsx from 'clsx';
import { Tab } from '@headlessui/react';
import print from 'print-js';
import LoadingAnimation from 'src/components/LoadingAnimation';
import sendPostRequest from 'src/utils/sendPostRequest';

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

const PrintModal = memo(function PrintModal({ close, setOnClose, setTitle }) {
    // State controls modal contents, must be "options", "loading", or "error"
    const [modalContents, setModalContents] = useState("options");

    // Selected size option, default to small
    const [qrSize, setQrSize] = useState(sizeOptions.small);

    // State controls ErrorMessage text, must be "unset", "long", or "unknown"
    const [error, setError] = useState("");

    // Ref used to abort printing if user clicks cancel before API response
    // Set to true when request starts, response only processed if still true
    const cancelPrinting = useRef(false);

    // Cancel button handler, aborts printing and resets modal contents
    const cancel = () => {
        cancelPrinting.current = true;
        setModalContents("options");
        setTitle("Select QR Code Size");
    };

    // Abort printing immediately when modal is closed
    useEffect(() => {
        setOnClose(() => cancelPrinting.current = true);
    }, [setOnClose]);

    // Request QR codes from backend, open print dialog if user did not cancel
    const fetchQrCodes = async (size) => {
        // State starts loading animation (will change back if user cancels)
        setModalContents("loading");
        setTitle("Fetching QR Codes");

        // Request Base64-encoded image string from backend
        const response = await sendPostRequest('/get_qr_codes', {
            qr_per_row: size
        });

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

        // iOS non-safari browser workaround (only supports printing page)
        // Open new tab containing nothing but image, print, then close tab
        if (/crios|fxios/i.test(navigator.userAgent)) {
            const printWindow = window.open('', '_blank');

            // Make image fill full page without changing aspect ratio
            const style = printWindow.document.createElement('style');
            style.textContent = `
                @page { size: letter portrait; margin: 0 }
                html, body { width: 100%; height: 100%; margin: 0; padding: 0 }
                body { display: flex; align-items: center; justify-content: center }
                img { max-width: 100%; max-height: 100%; object-fit: contain }
            `;
            printWindow.document.head.appendChild(style);

            // Add image to new tab body
            const img = printWindow.document.createElement('img');
            img.src = uri;
            img.alt = 'QR code';
            printWindow.document.body.appendChild(img);

            // Open print dialog, immediately close tab (dialog stays open)
            printWindow.print();
            setTimeout(() => {
                printWindow.close();
            }, 100);

        // Call print-js directly on all other browsers
        } else {
            print({
                printable: uri,
                type: 'image',
                documentTitle: '',
                header: null,
                footer: null
            });
        }
        close();
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
        setTitle("Error");
    };

    switch(modalContents) {
        case("loading"):
            return (
                <>
                    <LoadingAnimation className="h-36 mt-2 mx-auto" />
                    <div className="modal-action">
                        <button className="btn btn-soft" onClick={cancel}>
                            Cancel
                        </button>
                    </div>
                </>
            );
        case("options"):
            return (
                <>
                    <div className="h-36 mt-2 flex flex-col justify-center">
                        <Tab.Group
                            onChange={(index) => {
                                setQrSize(Object.values(sizeOptions)[index]);
                            }}
                            defaultIndex={Object.values(sizeOptions).indexOf(qrSize)}
                        >
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

                    <div className="modal-action">
                        <button className="btn btn-accent" onClick={generate}>
                            Generate
                        </button>
                    </div>
                </>
            );
        default:
            return (
                <>
                    <div className="h-36 mt-2 flex flex-col justify-center mx-auto">
                        <ErrorMessage error={error} />
                    </div>
                    <div className="modal-action">
                        <button className="btn" onClick={cancel}>OK</button>
                    </div>
                </>
            );
    }
});

PrintModal.propTypes = {
    close: PropTypes.func.isRequired,
    setOnClose: PropTypes.func.isRequired,
    setTitle: PropTypes.func.isRequired
};

export default PrintModal;
