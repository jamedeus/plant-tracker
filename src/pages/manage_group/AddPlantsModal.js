import React, { useState, useEffect, useRef, memo } from 'react';
import PropTypes from 'prop-types';
import { useSelector, useDispatch } from 'react-redux';
import sendPostRequest from 'src/utils/sendPostRequest';
import EditableNodeList from 'src/components/EditableNodeList';
import LoadingAnimation from 'src/components/LoadingAnimation';
import RegisterPageLink from 'src/components/RegisterPageLink';
import PlantCard from 'src/components/PlantCard';
import { plantsAdded } from './groupSlice';
import { openErrorModal } from 'src/components/ErrorModal';
import plantDetailsProptypes from 'src/types/plantDetailsPropTypes';

const Options = ({ options, close }) => {
    const dispatch = useDispatch();
    const groupId = useSelector((state) => state.group.groupDetails.uuid);
    // Ref used to read selected items from EditableNodeList form
    const formRef = useRef(null);
    // Show options if true, no plants message if false
    const hasOptions = Object.keys(options).length > 0;

    // Parses array of selected plant UUIDs, passes to addPlants callback
    const submit = () => {
        const selected = new FormData(formRef.current);
        addPlants(Array.from(selected.keys()));
        close();
    };

    // Takes array of selected plant UUIDs,posts to backend and updates state
    const addPlants = async (selected) => {
        const response = await sendPostRequest('/bulk_add_plants_to_group', {
            group_id: groupId,
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

    return (
        <>
            <div className="md:max-h-[50vh] max-w-94 w-full mx-auto overflow-y-auto pr-4 my-4">
                {hasOptions ? (
                    <EditableNodeList editing={true} formRef={formRef}>
                        {Object.entries(options).map(([uuid, plant]) => (
                            <PlantCard key={uuid} { ...plant } />
                        ))}
                    </EditableNodeList>
                ) : (
                    <div className="flex flex-col h-28 pl-4 pb-4 justify-center gap-4">
                        <span>No plants</span>
                        <RegisterPageLink type="plant" className="mx-auto" />
                    </div>
                )}
            </div>

            {hasOptions &&
                <div className="modal-action">
                    <button className="btn btn-soft w-20" onClick={close}>
                        Cancel
                    </button>
                    <button
                        className="btn btn-accent w-20"
                        onClick={submit}
                    >
                        Add
                    </button>
                </div>
            }
        </>
    );
};

Options.propTypes = {
    options: PropTypes.objectOf(plantDetailsProptypes).isRequired,
    close: PropTypes.func.isRequired
};

const AddPlantsModal = memo(function AddPlantsModal({ close }) {
    // Stores options queried from backend
    const [options, setOptions] = useState(null);

    // Request options from backend, set state (called when modal opens)
    const loadOptions = async () => {
        const response = await fetch('/get_plant_options');
        if (response.ok) {
            const data = await response.json();
            setOptions(data.options);
        } else {
            setOptions({});
        }
    };

    // Get options from backend on first load
    useEffect(() => {
        loadOptions();
    }, []);

    return (
        <div className="flex flex-col items-center px-4 overflow-y-auto">
            {options ? (
                <Options options={options} close={close} />
            ) : (
                <LoadingAnimation />
            )}
        </div>
    );
});

AddPlantsModal.propTypes = {
    close: PropTypes.func.isRequired
};

export default AddPlantsModal;
