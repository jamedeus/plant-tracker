import React, { useRef } from 'react';
import PropTypes from 'prop-types';
import EditableNodeList from 'src/components/EditableNodeList';
import Modal from 'src/components/Modal';
import { sendPostRequest } from 'src/util';
import ManagePlantsCard from './ManagePlantsCard';

let removePlantsModalRef;

export const openRemovePlantsModal = () => {
    removePlantsModalRef.current.showModal();
};

const RemovePlantsModal = ({ trayID, plantDetails, setPlantDetails }) => {
    removePlantsModalRef = useRef(null);

    // Ref to track selected items
    const selected = useRef([]);

    // Handler for remove button in manage plants modal
    const removePlants = async () => {
        const payload = {
            tray_id: trayID,
            plants: selected.current
        };
        const response = await sendPostRequest(
            '/bulk_remove_plants_from_tray',
            payload
        );
        if (response.ok) {
            // Remove UUIDs in response from plantDetails
            const data = await response.json();
            setPlantDetails(plantDetails.filter(
                plant => !data.removed.includes(plant.uuid)
            ));
        }
    };

    return (
        <Modal dialogRef={removePlantsModalRef}>
            <p className="font-bold text-2xl mb-8">Remove Plants</p>

            <EditableNodeList editing={true} selected={selected}>
                {plantDetails.map((plant) => {
                    return <ManagePlantsCard
                        key={plant.uuid}
                        name={plant.name}
                    />;
                })}
            </EditableNodeList>

            <div className="modal-action mx-auto">
                <form method="dialog">
                    <button className="btn mr-2">
                        Cancel
                    </button>
                    <button
                        className="btn btn-error ml-2"
                        onClick={removePlants}
                    >
                        Remove
                    </button>
                </form>
            </div>
        </Modal>
    );
};

RemovePlantsModal.propTypes = {
    trayID: PropTypes.string,
    plantDetails: PropTypes.array,
    setPlantDetails: PropTypes.func
};

export default RemovePlantsModal;
