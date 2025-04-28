import React, { useRef, memo } from 'react';
import PropTypes from 'prop-types';
import EditableNodeList from 'src/components/EditableNodeList';
import Modal from 'src/components/Modal';
import PlantCard from 'src/components/PlantCard';

let modalRef;

export const openAddPlantsModal = () => {
    modalRef.current.open();
};

const AddPlantsModal = memo(function AddPlantsModal({ options, addPlants }) {
    modalRef = useRef(null);

    // Ref used to read selected items from EditableNodeList form
    const formRef = useRef(null);

    // Parses array of selected plant UUIDs, passes to addPlants callback
    const submit = () => {
        const selected = new FormData(formRef.current);
        addPlants(Array.from(selected.keys()));
    };

    return (
        <Modal
            title='Add Plants'
            ref={modalRef}
            className='max-w-[26rem]'
        >
            <div className="md:max-h-[50vh] overflow-y-scroll pr-4 mt-4">
                {options.length > 0 ? (
                    <EditableNodeList editing={true} formRef={formRef}>
                        {options.map((plant) => (
                            <PlantCard key={plant.uuid} {...plant} />
                        ))}
                    </EditableNodeList>
                ) : (
                    <p className="my-4 pl-4">No plants</p>
                )}
            </div>

            <div className="modal-action mx-auto">
                <form method="dialog">
                    <button className="btn mr-2">
                        Cancel
                    </button>
                    <button
                        className="btn btn-accent ml-2"
                        onClick={submit}
                    >
                        Add
                    </button>
                </form>
            </div>
        </Modal>
    );
});

AddPlantsModal.propTypes = {
    options: PropTypes.array.isRequired,
    addPlants: PropTypes.func.isRequired
};

export default AddPlantsModal;
