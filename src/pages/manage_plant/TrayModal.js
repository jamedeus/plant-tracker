import React, { useRef } from 'react';
import PropTypes from 'prop-types';
import Modal from 'src/components/Modal';
import TrayCard from 'src/components/TrayCard';
import { sendPostRequest } from 'src/util';
import { useErrorModal } from 'src/context/ErrorModalContext';

let trayModalRef;

export const openTrayModal = () => {
    trayModalRef.current.showModal();
};

const TrayModal = ({ plantID, trayOptions, handleAddTray }) => {
    trayModalRef = useRef(null);

    // Get hook to show error modal
    const { showErrorModal } = useErrorModal();

    // Handler for confirm button
    const addToTray = async (trayID) => {
        const payload = {
            plant_id: plantID,
            tray_id: trayID
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
            <div className="flex flex-col px-4 overflow-scroll">
                {trayOptions.map(tray => (
                    <div
                        key={tray.uuid}
                        className="max-w-80 w-full mx-auto mb-4 cursor-pointer"
                        onClick={() => addToTray(tray.uuid)}
                    >
                        <TrayCard
                            key={tray.uuid}
                            name={tray.name}
                            plants={tray.plants}
                            linkPage={false}
                        />
                    </div>
                ))}
            </div>
        </Modal>
    );
};

TrayModal.propTypes = {
    plantID: PropTypes.string,
    trayOptions: PropTypes.array,
    handleAddTray: PropTypes.func
};

export default TrayModal;
