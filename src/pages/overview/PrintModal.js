import React, { useState, useEffect, useRef } from 'react';
import { Tab } from '@headlessui/react';
import print from 'print-js';
import Modal from 'src/components/Modal';
import { sendPostRequest } from 'src/util';

const PrintModal = ({ printModalRef }) => {
    // State controls modal contents, must be "options", "loading", or "error"
    const [modalContents, setModalContents] = useState("options");

    // State controls ErrorMessage text, must be "unset", "long", or "unknown"
    const [error, setError] = useState("");

    // Ref used to abort printing if user clicks cancel before API response
    // Set to true when request starts, response only processed if still true
    const cancelPrinting = useRef(false);

    // Cancel button handler
    const cancel = () => {
        cancelPrinting.current = true;
        setModalContents("options");
    };

    // Resets modal contents after close animation completes
    const resetModal = () => {
        setTimeout(() => {
            setModalContents("options");
        }, 150);
    };

    // Listen for modal close event, reset contents to default after animation
    useEffect(() => {
        if (printModalRef.current) {
            printModalRef.current.addEventListener('close', resetModal);
            return () => {
                if (printModalRef.current) {
                    printModalRef.current.removeEventListener('close', resetModal);
                }
            };
        }
    }, []);

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

    const QrCodeSizeSelect = () => {
        const options = {
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

        let [qrSize, setQrSize] = useState(options.small);

        const generate = () => {
            cancelPrinting.current = false;
            fetchQrCodes(qrSize.qr_per_row);
        };

        return (
            <>
                <h3 className="font-bold text-lg mb-6">
                    Select QR Code Size
                </h3>
                <div className="h-36 flex flex-col justify-center">
                    <Tab.Group onChange={(index) => {
                        setQrSize(Object.values(options)[index]);
                    }}>
                        <Tab.List className="tab-group">
                            {Object.keys(options).map((option) => (
                                <Tab key={option} className={({ selected }) =>
                                    `tab-option ${
                                        selected ? 'tab-option-selected' : ''
                                    }`
                                }>
                                    {option}
                                </Tab>
                            ))}
                        </Tab.List>
                        <Tab.Panels className="mt-4">
                            {Object.values(options).map((option, idx) => (
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
            </>
        );
    };

    const LoadingAnimation = () => {
        return (
            <>
                <h3 className="font-bold text-lg mb-6">Fetching QR Codes</h3>
                <div className="h-36 flex flex-col justify-center mx-auto">
                    <span className="loading loading-spinner loading-lg"></span>
                </div>
                <div className="modal-action mx-auto">
                    <button className="btn" onClick={cancel}>Cancel</button>
                </div>
            </>
        );
    };

    const ErrorMessage = () => {
        const UnsetUrlPrefix = (
            <>
                <p>The URL_PREFIX environment variable is not set</p>
                <p>Check docker config</p>
            </>
        )

        const LongUrlPrefix = (
            <>
                <p>Unable to generate QR codes</p>
                <p>Try setting a shorter URL_PREFIX in docker config</p>
            </>
        )

        return (
            <>
                <h3 className="font-bold text-lg mb-6">Error</h3>
                <div className="h-36 flex flex-col justify-center mx-auto">
                    {(() => {
                        switch(error) {
                            case("unset"):
                                return UnsetUrlPrefix;
                            case("long"):
                                return LongUrlPrefix;
                            default:
                                return (
                                    <p>An unknown error occurred</p>
                                )
                        }
                    })()}
                </div>
                <div className="modal-action mx-auto">
                    <button className="btn" onClick={cancel}>OK</button>
                </div>
            </>
        );
    };

    return (
        <Modal dialogRef={printModalRef}>
            {(() => {
                switch(modalContents) {
                    case("loading"):
                        return <LoadingAnimation />;
                    case("options"):
                        return <QrCodeSizeSelect />;
                    case("error"):
                        return <ErrorMessage />;
                }
            })()}
        </Modal>
    );
};

export default PrintModal;
