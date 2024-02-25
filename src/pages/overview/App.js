import React, { useState } from 'react';
import print from 'print-js';
import EditableNodeList from 'src/components/EditableNodeList';
import Navbar from 'src/components/Navbar';
import TrayCard from 'src/components/TrayCard';
import PlantCard from 'src/components/PlantCard';
import { sendPostRequest, parseDomContext } from 'src/util';
import FilterColumn from 'src/components/FilterColumn';

function App() {
    // Load context set by django template
    const [plants, setPlants] = useState(() => {
        return parseDomContext("plants");
    });
    const [trays, setTrays] = useState(() => {
        return parseDomContext("trays");
    });

    // State object to track edit mode (shows checkbox for each card)
    const [editing, setEditing] = useState(false);

    // Toggle editing state, clear selected, remove focus (closes dropdown)
    const toggleEditing = () => {
        setEditing(!editing);
        setSelectedTrays([]);
        setSelectedPlants([]);
        document.activeElement.blur();
    };

    // Track which card checkboxes the user has selected
    const [selectedPlants, setSelectedPlants] = useState([]);
    const [selectedTrays, setSelectedTrays] = useState([]);

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

    // Appears when edit dropdown option selected
    const EditingButtons = () => {
        const cancel = () => setEditing(false);

        const handleDelete = () => {
            // Send delete request for each selected plant, remove uuid from state
            selectedPlants.forEach(async plant_id => {
                await sendPostRequest('/delete_plant', {plant_id: plant_id});
            });
            setPlants(plants.filter(plant => !selectedPlants.includes(plant.uuid)));

            // Send delete request for each selected tray, remove uuid from state
            selectedTrays.forEach(async tray_id => {
                await sendPostRequest('/delete_tray', {tray_id: tray_id});
            });
            setTrays(trays.filter(tray => !selectedTrays.includes(tray.uuid)));

            // Reset editing state
            setEditing(false);
        };

        if (editing) {
            return (
                <div className="sticky bottom-4 mx-auto my-4 p-4 bg-neutral rounded-box">
                    <button className="btn mr-4" onClick={cancel}>
                        Cancel
                    </button>
                    <button className="btn btn-error ml-4" onClick={handleDelete}>
                        Delete
                    </button>
                </div>
            );
        }
    };

    return (
        <div className="container flex flex-col mx-auto mb-8">
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
                    <FilterColumn
                        title="Plants"
                        contents={plants}
                        cardComponent={PlantCard}
                        editableList={
                            <EditableNodeList
                                editing={editing}
                                selected={selectedPlants}
                                setSelected={setSelectedPlants}
                            />
                        }
                    />
                </div>

                <div className="md:ml-12">
                    <FilterColumn
                        title="Trays"
                        contents={trays}
                        cardComponent={TrayCard}
                        editableList={
                            <EditableNodeList
                                editing={editing}
                                selected={selectedPlants}
                                setSelected={setSelectedPlants}
                            />
                        }
                    />
                </div>
            </div>

            <EditingButtons />

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
