import React, { useState, useEffect, useRef } from 'react';
import print from 'print-js'

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

    // Add card UUID to selectedRef if not already present, remove if present
    const selectCard = (uuid) => {
        const oldSelected = [...selectedRef.current];
        if (oldSelected.includes(uuid)) {
            oldSelected.splice(oldSelected.indexOf(uuid), 1);
            console.log('Deleted from list');
        } else {
            oldSelected.push(uuid);
            console.log('Added to list');
        }
        console.log(oldSelected);
        selectedRef.current = oldSelected;
    };

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

    const CardWrapper = ({ card, editing }) => {
        switch(editing) {
            case(true):
                return (
                    <div className="flex mb-4">
                        <label className="label cursor-pointer">
                            <input
                                type="checkbox"
                                className="radio checked:bg-blue-500"
                                onClick={() => selectCard(card.key)}
                            />
                        </label>
                        <div className="ml-2 w-full">
                            {card}
                        </div>
                    </div>
                )
            case(false):
                return (
                    <div className="mb-4">
                        {card}
                    </div>
                )
        }
    };

    const CollapseCol = ({ title, children }) => {
        const [open, setOpen] = useState(true);

        const toggle = () => {
            setOpen(!open);
        };

        return (
            <div className="collapse bg-base-200 w-96 px-4 mx-auto max-w-90 md:max-w-full">
                <input type="checkbox" onChange={toggle} defaultChecked={true} />
                <div className="collapse-title text-xl font-medium text-center">
                    {title}
                </div>
                <div className="collapse-content">
                    {children.map((card) => {
                        return <CardWrapper key={card.key} card={card} editing={editing} />
                    })}
                </div>
            </div>
        );
    };

    const PlantCard = ({ name, uuid }) => {
        return (
            <div
                className="card bg-neutral text-neutral-content mx-auto w-full"
                onClick={() => window.location.href = `/manage/${uuid}`}
            >
                <div className="card-body text-center">
                    <h2 className="card-title mx-auto">{name}</h2>
                </div>
            </div>
        );
    };

    const TrayCard = ({ name, plants, uuid }) => {
        return (
            <div
                className="card bg-neutral text-neutral-content mx-auto w-full"
                onClick={() => window.location.href = `/manage/${uuid}`}
            >
                <div className="card-body text-center">
                    <h2 className="card-title mx-auto">{name}</h2>
                    <p>Contains {plants} plants</p>
                </div>
            </div>
        );
    };

    return (
        <div className="container flex flex-col mx-auto">
            <div className="navbar bg-base-100 mb-4">
                <div className="navbar-start">

                    <div className="dropdown">
                        <div tabIndex={0} role="button" className="btn btn-ghost btn-circle">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-5 w-5"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="2"
                                    d="M4 6h16M4 12h16M4 18h7"
                                />
                            </svg>
                        </div>
                        <ul tabIndex={0} className="menu menu-md dropdown-content mt-3 z-[99] p-2 shadow bg-base-300 rounded-box w-52">
                            <li><a onClick={toggleEditing}>Edit</a></li>
                            <li><a onClick={fetchQrCodes}>Print QR Codes</a></li>
                        </ul>
                    </div>

                </div>
                <div className="navbar-center">
                    <a className="btn btn-ghost text-3xl">Plant Overview</a>
                </div>
                <div className="navbar-end">
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 mx-auto">
                <div className="md:mr-12 mb-8 md:mb-0">
                    <CollapseCol
                        title="Plants"
                        children={context.plants.map((plant) => {
                            return <PlantCard
                                key={plant.uuid}
                                name={plant.name}
                                uuid={plant.uuid}
                            />
                        })}
                    />
                </div>

                <div className="md:ml-12">
                    <CollapseCol
                        title="Trays"
                        children={context.trays.map((tray) => {
                            return <TrayCard
                                key={tray.uuid}
                                name={tray.name}
                                plants={tray.plants}
                                uuid={tray.uuid}
                            />
                        })}
                    />
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
