import React, { useRef } from 'react';
import PropTypes from 'prop-types';
import EditableNodeList from 'src/components/EditableNodeList';
import Modal from 'src/components/Modal';
import { sendPostRequest } from 'src/util';
import PlantCard from 'src/components/PlantCard';
import { useErrorModal } from 'src/context/ErrorModalContext';

let addPlantsModalRef;

export const openAddPlantsModal = () => {
    addPlantsModalRef.current.showModal();
};

const AddPlantsModal = ({ trayID, options, plantDetails, setPlantDetails }) => {
    addPlantsModalRef = useRef(null);

    // Ref to track selected items
    const selected = useRef([]);

    // Get hook to show error modal
    const { showErrorModal } = useErrorModal();

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
        } else {
            const error = await response.json();
            showErrorModal(JSON.stringify(error));
        }
    };

    // Get object with name and UUID of all plants not already in tray
    const existing = plantDetails.map(plant => plant.uuid);
    const plantOptions = options.filter(
        plant => !existing.includes(plant.uuid)
    );

    return (
        <Modal dialogRef={addPlantsModalRef} className="max-w-[26rem]">
            <p className="font-bold text-2xl mb-8">Add Plants</p>

            <div className="max-h-screen md:max-h-half-screen overflow-scroll pr-4">
                {plantOptions.length > 0 ? (
                    <EditableNodeList editing={true} selected={selected}>
                        {plantOptions.map((plant) => (
                            <PlantCard key={plant.uuid} {...plant} />
                        ))}
                    </EditableNodeList>
                ) : (
                    <p className="my-4">No plants</p>
                )}
            </div>

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
