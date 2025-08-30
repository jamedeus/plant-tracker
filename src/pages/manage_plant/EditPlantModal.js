import React, { useRef } from 'react';
import PropTypes from 'prop-types';
import sendPostRequest from 'src/utils/sendPostRequest';
import EditModal from 'src/components/EditModal';
import PlantDetailsForm from 'src/components/PlantDetailsForm';
import { openErrorModal } from 'src/components/ErrorModal';
import { useSelector, useDispatch } from 'react-redux';
import { plantDetailsUpdated } from './plantSlice';

const EditPlantModal = ({ close }) => {
    const formRef = useRef(null);
    const dispatch = useDispatch();
    const plantDetails = useSelector((state) => state.plant.plantDetails);

    const submit = async () => {
        const response = await sendPostRequest('/edit_plant_details', {
            plant_id: plantDetails.uuid,
            ...Object.fromEntries(new FormData(formRef.current))
        });
        if (response.ok) {
            // Update plant state with new values from response
            const data = await response.json();
            dispatch(plantDetailsUpdated(data));
        } else {
            const error = await response.json();
            openErrorModal(JSON.stringify(error));
        }
    };

    return (
        <EditModal formRef={formRef} onSubmit={submit} close={close}>
            <PlantDetailsForm
                formRef={formRef}
                name={plantDetails.name}
                species={plantDetails.species}
                pot_size={plantDetails.pot_size}
                description={plantDetails.description}
            />
        </EditModal>
    );
};

EditPlantModal.propTypes = {
    close: PropTypes.func.isRequired
};

export default EditPlantModal;
