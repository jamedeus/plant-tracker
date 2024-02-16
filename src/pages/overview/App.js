import React, { useState, useEffect, useRef } from 'react';
import print from 'print-js'
import CollapseCol from 'src/components/CollapseCol';
import EditableNodeList from 'src/components/EditableNodeList';
import Navbar from 'src/components/Navbar';
import TrayCard from 'src/components/TrayCard';
import PlantCard from 'src/components/PlantCard';

function App() {
    // Load context set by django template
    const [context, setContext] = useState(() => {
        function parse_dom_context(name) {
            const element = document.getElementById(name);
            if (element) {
                return JSON.parse(element.textContent);
            } else {
                return "";
            }
        }

        // Parse context elements created by django template
        return {
            plants: parse_dom_context("plants"),
            trays: parse_dom_context("trays")
        };
    });
    console.log(context)

    // State object to track edit mode (shows checkbox for each card)
    const [editing, setEditing] = useState(false);

    // Toggle editing state, clear selectedRef, remove focus (closes dropdown)
    const toggleEditing = () => {
        setEditing(!editing);
        selectedRef.current = [];
        document.activeElement.blur();
    };

    // Track which card checkboxes the user has selected
    const selectedRef = useRef([]);

    // Show loading modal with cancel button, request QR codes from backend,
    // open QR codes in print dialog if user did not click cancel
    const fetchQrCodes = async () => {
        // Show loading modal
        document.getElementById('printModal').showModal();

        // Get Base64-encoded image string from backend
        const response = await fetch('/get_qr_codes');

        // Check response if user did not close modal
        if (document.getElementById('printModal').open) {
            // Open QR codes in print dialog if response OK
            if (response.ok) {
                const data = await response.json();
                printQrCodes(data.qr_codes);
            // Replace loading modal with error modal if response not OK
            } else {
                document.getElementById('printModal').close();
                document.getElementById('printErrorModal').showModal();
            }
        }
    };

    // Takes base64 image string, decodes and opens in print dialog
    const printQrCodes = (data) => {
        console.log(data)
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

        // Open print dialog, close loading modal
        print({
            printable: uri,
            type: 'image',
            documentTitle: '',
            header: null,
            footer: null
        });
        document.getElementById('printModal').close();
    };

    return (
        <div className="container flex flex-col mx-auto">
            <Navbar
                dropdownOptions={
                    <>
                        <li><a onClick={toggleEditing}>Edit</a></li>
                        <li><a onClick={fetchQrCodes}>Print QR Codes</a></li>
                    </>
                }
                title={
                    <a className="btn btn-ghost text-3xl">Plant Overview</a>
                }
            />

            <div className="grid grid-cols-1 md:grid-cols-2 mx-auto">
                <div className="md:mr-12 mb-8 md:mb-0">
                    <CollapseCol title="Plants">
                        <EditableNodeList editing={editing} selected={selectedRef}>
                            {context.plants.map((plant) => {
                                return <PlantCard
                                    key={plant.uuid}
                                    name={plant.name}
                                    uuid={plant.uuid}
                                />
                            })}
                        </EditableNodeList>
                    </CollapseCol>
                </div>

                <div className="md:ml-12">
                    <CollapseCol title="Trays">
                        <EditableNodeList editing={editing} selected={selectedRef}>
                            {context.trays.map((tray) => {
                                return <TrayCard
                                    key={tray.uuid}
                                    name={tray.name}
                                    plants={tray.plants}
                                    uuid={tray.uuid}
                                />
                            })}
                        </EditableNodeList>
                    </CollapseCol>
                </div>
            </div>

            <dialog id="printModal" className="modal">
                <div className="modal-box text-center flex flex-col">
                    <h3 className="font-bold text-lg mb-6">Fetching QR Codes</h3>
                    <span className="loading loading-spinner loading-lg mx-auto"></span>
                    <div className="modal-action mx-auto">
                        <form method="dialog">
                            {/* if there is a button in form, it will close the modal */}
                            <button className="btn">Cancel</button>
                        </form>
                    </div>
                </div>
            </dialog>

            <dialog id="printErrorModal" className="modal">
                <div className="modal-box text-center flex flex-col">
                    <h3 className="font-bold text-lg mb-6">Error</h3>
                    <p>The URL_PREFIX environment variable is not set, check docker config</p>
                    <div className="modal-action mx-auto">
                        <form method="dialog">
                            {/* if there is a button in form, it will close the modal */}
                            <button className="btn">OK</button>
                        </form>
                    </div>
                </div>
            </dialog>
        </div>
    );
}

export default App;
