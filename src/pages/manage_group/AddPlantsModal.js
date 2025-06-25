import React, { useState, useRef, memo } from 'react';
import PropTypes from 'prop-types';
import EditableNodeList from 'src/components/EditableNodeList';
import Modal from 'src/components/Modal';
import PlantCard from 'src/components/PlantCard';

let modalRef, loadOptions;

// Request options from backend, open modal
export const openAddPlantsModal = async () => {
    await loadOptions();
    modalRef.current.open();
};

const AddPlantsModal = memo(function AddPlantsModal({ addPlants }) {
    modalRef = useRef(null);

    // Stores options queried from backend
    const [options, setOptions] = useState([]);

    loadOptions = async () => {
        const response = await fetch('/get_plant_options');
        if (response.ok) {
            const data = await response.json();
            setOptions(data.options);
        }
    };

    const clearOptions = () => {
        setOptions([]);
    };

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
            onClose={clearOptions}
        >
            <div className="md:max-h-[50vh] overflow-y-auto pr-4 mt-4">
                {Object.keys(options).length > 0 ? (
                    <EditableNodeList editing={true} formRef={formRef}>
                        {Object.entries(options).map(([uuid, plant]) => (
                            <PlantCard key={uuid} { ...plant } />
                        ))}
                    </EditableNodeList>
                ) : (
                    <p className="my-4 pl-4">No plants</p>
                )}
            </div>

            <div className="modal-action">
                <form method="dialog">
                    <button className="btn btn-soft">
                        Cancel
                    </button>
                    <button
                        className="btn btn-accent"
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
    addPlants: PropTypes.func.isRequired
};

export default AddPlantsModal;
