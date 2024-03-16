import React, { useState, useEffect, useRef } from 'react';
import { Tab } from '@headlessui/react';
import print from 'print-js';
import Modal from 'src/components/Modal';
import { sendPostRequest } from 'src/util';

const PrintModal = ({ printModalRef }) => {
    // State replaces options with loading animation when true
    const [generatingQrCodes, setGeneratingQrCodes] = useState(false);

    // Ref tracks if user clicks cancel before API response
    const generatingQrCodesRef = useRef(generatingQrCodes);

    // Called when user clicks cancel or closes modal
    // Resets loading animation, prevents print dialog from opening
    const resetModal = () => {
        // Prevent dialog from opening
        generatingQrCodesRef.current = false;
        // Change loading animation back to options after close animation
        setTimeout(() => {
            setGeneratingQrCodes(false);
        }, 150);
    };

    useEffect(() => {
        // Set ref to false when modal closes (prevent opening print dialog)
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
        setGeneratingQrCodes(true);

        // Request Base64-encoded image string from backend
        const response = await sendPostRequest(
            '/get_qr_codes',
            {qr_per_row: size}
        );

        // Check response if state still true (user did not cancel/close modal)
        if (generatingQrCodesRef.current) {
            // Open QR codes in print dialog if response OK
            if (response.ok) {
                const data = await response.json();
                printQrCodes(data.qr_codes);
            } else {
                printModalRef.current.close();
                alert("Error while fetching QR codes");
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
            setGeneratingQrCodes(true);
            generatingQrCodesRef.current = true;
            fetchQrCodes(qrSize.qr_per_row);
        };

        return (
            <>
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
                    <button className="btn" onClick={resetModal}>Cancel</button>
                </div>
            </>
        );
    };

    return (
        <Modal dialogRef={printModalRef}>
            {(() => {
                switch(generatingQrCodes) {
                    case(true):
                        return <LoadingAnimation />;
                    case(false):
                        return (
                            <>
                                <h3 className="font-bold text-lg mb-6">
                                    Select QR Code Size
                                </h3>
                                <QrCodeSizeSelect />
                            </>
                        );
                }
            })()}
        </Modal>
    );
};

export default PrintModal;
