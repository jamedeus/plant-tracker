import React, { useRef, memo } from 'react';
import PropTypes from 'prop-types';
import EditableNodeList from 'src/components/EditableNodeList';
import Modal from 'src/components/Modal';
import { sendPostRequest } from 'src/util';
import PlantCard from 'src/components/PlantCard';
import { openErrorModal } from 'src/components/ErrorModal';

let modalRef;

export const openAddPlantsModal = () => {
    modalRef.current.open();
};

const AddPlantsModal = memo(function AddPlantsModal({ groupID, options, plantDetails, setPlantDetails }) {
    modalRef = useRef(null);

    // Ref to track selected items
    const selected = useRef([]);

    // Handler for add button in manage plants modal
    const addPlants = async () => {
        const payload = {
            group_id: groupID,
            plants: selected.current
        };
        const response = await sendPostRequest(
            '/bulk_add_plants_to_group',
            payload
        );
        if (response.ok) {
            // Add objects in response to plantDetails state
            const data = await response.json();
            setPlantDetails([...plantDetails, ...data.added]);
            // Clear selection
            selected.current = [];
        } else {
            const error = await response.json();
            openErrorModal(JSON.stringify(error));
        }
    };

    // Get object with name and UUID of all plants that are not archived or
    // already in group
    const existing = plantDetails.map(plant => plant.uuid);
    const plantOptions = options.filter(
        plant => !existing.includes(plant.uuid) && !plant.archived
    );

    return (
        <Modal
            title='Add Plants'
            ref={modalRef}
            className='max-w-[26rem]'
        >
            <div className="max-h-screen md:max-h-half-screen overflow-y-scroll pr-4 mt-4">
                {plantOptions.length > 0 ? (
                    <EditableNodeList editing={true} selected={selected}>
                        {plantOptions.map((plant) => (
                            <PlantCard
                                key={plant.uuid}
                                {...plant}
                                linkPage={false}
                            />
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
});

AddPlantsModal.propTypes = {
    groupID: PropTypes.string.isRequired,
    options: PropTypes.array.isRequired,
    plantDetails: PropTypes.array.isRequired,
    setPlantDetails: PropTypes.func.isRequired
};

export default AddPlantsModal;
