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

    // Ref used to read selected items from EditableNodeList form
    const formRef = useRef(null);

    // Parses array of selected plant UUIDs, passes to removePlants callback
    const submit = () => {
        const selected = new FormData(formRef.current);
        removePlants(Array.from(selected.keys()));
    };

    return (
        <Modal
            title='Remove Plants'
            ref={modalRef}
            className='max-w-[26rem]'
        >
            <div className="max-h-screen md:max-h-half-screen overflow-y-scroll pr-4 mt-4">
                {plantDetails.length > 0 ? (
                    <EditableNodeList editing={true} formRef={formRef}>
                        {plantDetails.map((plant) => (
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
                        className="btn btn-error ml-2"
                        onClick={submit}
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
