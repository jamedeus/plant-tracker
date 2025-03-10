import React, { useRef, memo } from 'react';
import PropTypes from 'prop-types';
import EditableNodeList from 'src/components/EditableNodeList';
import PlantCard from 'src/components/PlantCard';
import Modal from 'src/components/Modal';
import { sendPostRequest } from 'src/util';
import { openErrorModal } from 'src/components/ErrorModal';

let modalRef;

export const openRemovePlantsModal = () => {
    modalRef.current.open();
};

const RemovePlantsModal = memo(function RemovePlantsModal({ groupID, plantDetails, setPlantDetails }) {
    modalRef = useRef(null);

    // Ref to track selected items
    const selected = useRef([]);

    // Handler for remove button in manage plants modal
    const removePlants = async () => {
        const payload = {
            group_id: groupID,
            plants: selected.current
        };
        const response = await sendPostRequest(
            '/bulk_remove_plants_from_group',
            payload
        );
        if (response.ok) {
            // Remove UUIDs in response from plantDetails
            const data = await response.json();
            setPlantDetails(plantDetails.filter(
                plant => !data.removed.includes(plant.uuid)
            ));
            // Clear selection
            selected.current = [];
        } else {
            const error = await response.json();
            openErrorModal(JSON.stringify(error));
        }
    };

    return (
        <Modal
            title='Remove Plants'
            ref={modalRef}
            className='max-w-[26rem]'
        >
            <div className="max-h-screen md:max-h-half-screen overflow-scroll pr-4 mt-4">
                {plantDetails.length > 0 ? (
                    <EditableNodeList editing={true} selected={selected}>
                        {plantDetails.map((plant) => (
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
                        className="btn btn-error ml-2"
                        onClick={removePlants}
                    >
                        Remove
                    </button>
                </form>
            </div>
        </Modal>
    );
});

RemovePlantsModal.propTypes = {
    groupID: PropTypes.string.isRequired,
    plantDetails: PropTypes.array.isRequired,
    setPlantDetails: PropTypes.func.isRequired
};

export default RemovePlantsModal;
