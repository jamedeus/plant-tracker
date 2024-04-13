import React, { useRef } from 'react';
import PropTypes from 'prop-types';
import EditableNodeList from 'src/components/EditableNodeList';
import Modal from 'src/components/Modal';
import { sendPostRequest } from 'src/util';
import ManagePlantsCard from './ManagePlantsCard';

let addPlantsModalRef;

export const openAddPlantsModal = () => {
    addPlantsModalRef.current.showModal();
};

const AddPlantsModal = ({ trayID, options, plantDetails, setPlantDetails }) => {
    addPlantsModalRef = useRef(null);

    // Ref to track selected items
    const selected = useRef([]);

    // Handler for add button in manage plants modal
    const addPlants = async () => {
        const payload = {
            tray_id: trayID,
            plants: selected.current
        };
        const response = await sendPostRequest(
            '/bulk_add_plants_to_tray',
            payload
        );
        if (response.ok) {
            // Add objects in response to plantDetails state
            const data = await response.json();
            setPlantDetails([...plantDetails, ...data.added]);
        }
    };

    // Get object with name and UUID of all plants not already in tray
    const existing = plantDetails.map(plant => plant.uuid);
    const plantOptions = options.filter(
        plant => !existing.includes(plant.uuid)
    );

    return (
        <Modal dialogRef={addPlantsModalRef}>
            <p className="font-bold text-2xl mb-8">Add Plants</p>

            <EditableNodeList editing={true} selected={selected}>
                {plantOptions.map((plant) => {
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
                        className="btn btn-success ml-2"
                        onClick={addPlants}
                    >
                        Add
                    </button>
                </form>
            </div>
        </Modal>
    );
};

AddPlantsModal.propTypes = {
    trayID: PropTypes.string,
    options: PropTypes.array,
    plantDetails: PropTypes.array,
    setPlantDetails: PropTypes.func
};

export default AddPlantsModal;
