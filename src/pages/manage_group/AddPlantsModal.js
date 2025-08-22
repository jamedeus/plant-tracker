import React, { useState, useRef, memo } from 'react';
import PropTypes from 'prop-types';
import { useSelector, useDispatch } from 'react-redux';
import { sendPostRequest } from 'src/util';
import EditableNodeList from 'src/components/EditableNodeList';
import LoadingAnimation from 'src/components/LoadingAnimation';
import Modal from 'src/components/Modal';
import PlantCard from 'src/components/PlantCard';
import { plantsAdded } from './groupSlice';
import { openErrorModal } from 'src/components/ErrorModal';

let modalRef, loadOptions;

// Request options from backend, open modal
export const openAddPlantsModal = () => {
    modalRef.current.open();
};

const Options = ({ options }) => {
    const dispatch = useDispatch();
    const group = useSelector((state) => state.group.group);
    // Ref used to read selected items from EditableNodeList form
    const formRef = useRef(null);

    // Parses array of selected plant UUIDs, passes to addPlants callback
    const submit = () => {
        const selected = new FormData(formRef.current);
        addPlants(Array.from(selected.keys()));
    };

    // Takes array of selected plant UUIDs,posts to backend and updates state
    const addPlants = async (selected) => {
        const response = await sendPostRequest('/bulk_add_plants_to_group', {
            group_id: group.uuid,
            plants: selected
        });
        if (response.ok) {
            // Add objects in response to plantDetails state
            const data = await response.json();
            dispatch(plantsAdded(data.added));
        } else {
            const error = await response.json();
            openErrorModal(JSON.stringify(error));
        }
    };

    if (options) {
        return (
            <>
                <div className="md:max-h-[50vh] max-w-94 w-full mx-auto overflow-y-auto pr-4 my-4">
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
                        <button className="btn btn-soft w-20">
                            Cancel
                        </button>
                        <button
                            className="btn btn-accent w-20"
                            onClick={submit}
                        >
                            Add
                        </button>
                    </form>
                </div>
            </>
        );
    } else {
        return (
            <div className="flex flex-col items-center">
                <LoadingAnimation />
            </div>
        );
    }
};

Options.propTypes = {
    options: PropTypes.object
};

const AddPlantsModal = memo(function AddPlantsModal() {
    modalRef = useRef(null);

    // Stores options queried from backend
    const [options, setOptions] = useState(null);

    // Request options from backend, set state (called when modal opens)
    loadOptions = async () => {
        const response = await fetch('/get_plant_options');
        if (response.ok) {
            const data = await response.json();
            setOptions(data.options);
        } else {
            setOptions({});
        }
    };

    // Clear options after close animation completes
    const clearOptions = () => {
        setTimeout(() => {
            setOptions(null);
        }, 200);
    };

    return (
        <Modal
            title='Add Plants'
            ref={modalRef}
            onOpen={loadOptions}
            onClose={clearOptions}
        >
            <Options options={options} />
        </Modal>
    );
});

export default AddPlantsModal;
