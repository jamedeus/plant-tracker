import React, { useRef, memo } from 'react';
import PropTypes from 'prop-types';
import EditableNodeList from 'src/components/EditableNodeList';
import PlantCard from 'src/components/PlantCard';
import Modal from 'src/components/Modal';

let modalRef;

export const openRemovePlantsModal = () => {
    modalRef.current.open();
};

const RemovePlantsModal = memo(function RemovePlantsModal({ plantDetails, removePlants }) {
    modalRef = useRef(null);

    // Ref to track selected items
    const selected = useRef([]);

    return (
        <Modal
            title='Remove Plants'
            ref={modalRef}
            className='max-w-[26rem]'
        >
            <div className="max-h-screen md:max-h-half-screen overflow-y-scroll pr-4 mt-4">
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
                        onClick={() => removePlants(selected)}
                    >
                        Remove
                    </button>
                </form>
            </div>
        </Modal>
    );
});

RemovePlantsModal.propTypes = {
    plantDetails: PropTypes.array.isRequired,
    removePlants: PropTypes.func.isRequired
};

export default RemovePlantsModal;
