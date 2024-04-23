import React, { useRef } from 'react';
import PropTypes from 'prop-types';
import Modal from 'src/components/Modal';
import { sendPostRequest } from 'src/util';
import { useErrorModal } from 'src/context/ErrorModalContext';

let trayModalRef;

export const openTrayModal = () => {
    trayModalRef.current.showModal();
};

const TrayModal = ({ plantID, trayOptions, handleAddTray }) => {
    trayModalRef = useRef(null);
    const traySelectRef = useRef(null);

    // Get hook to show error modal
    const { showErrorModal } = useErrorModal();

    // Handler for confirm button
    const addToTray = async () => {
        const payload = {
            plant_id: plantID,
            tray_id: traySelectRef.current.value
        };
        const response = await sendPostRequest('/add_plant_to_tray', payload);
        if (response.ok) {
            // Update plant state with tray name and UUID from response
            const data = await response.json();
            handleAddTray(data.tray_name, data.tray_uuid);
        } else {
            const error = await response.json();
            showErrorModal(JSON.stringify(error));
        }
        // Close modal
        trayModalRef.current.close();
    };

    return (
        <Modal dialogRef={trayModalRef} title={"Add plant to tray"}>
            <select
                ref={traySelectRef}
                defaultValue=""
                className="select select-bordered m-8"
            >
                <option value="" disabled>Select tray</option>
                {trayOptions.map(tray => {
                    return (
                        <option key={tray.uuid} value={tray.uuid}>
                            {tray.name}
                        </option>
                    );
                })}
            </select>
            <button
                className="btn btn-success mx-auto mt-4"
                onClick={addToTray}
            >
                Confirm
            </button>
        </Modal>
    );
};

TrayModal.propTypes = {
    plantID: PropTypes.string,
    trayOptions: PropTypes.array,
    handleAddTray: PropTypes.func
};

export default TrayModal;
