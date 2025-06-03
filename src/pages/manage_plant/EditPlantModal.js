import React, { useRef } from 'react';
import { sendPostRequest } from 'src/util';
import EditModal from 'src/components/EditModal';
import PlantDetailsForm from 'src/components/PlantDetailsForm';
import { openErrorModal } from 'src/components/ErrorModal';
import { useSelector, useDispatch } from 'react-redux';
import { plantDetailsUpdated } from './plantSlice';

const EditPlantModal = () => {
    const formRef = useRef(null);
    const dispatch = useDispatch();
    const plantDetails = useSelector((state) => state.plant.plantDetails);

    const submit = async () => {
        const payload = Object.fromEntries(
            new FormData(formRef.current)
        );
        payload["plant_id"] = plantDetails.uuid;

        const response = await sendPostRequest('/edit_plant', payload);
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
        <EditModal title="Edit Details" formRef={formRef} onSubmit={submit}>
            {/* Key forces form to remount when RepotModal is submitted -
                form is unmanaged so props only set default values, which
                do not change when plantDetails updates. If pot_size field
                does not update after repot the user could easily reset the
                new pot size without noticing.
            */}
            <PlantDetailsForm
                key={plantDetails.pot_size}
                formRef={formRef}
                name={plantDetails.name}
                species={plantDetails.species}
                pot_size={plantDetails.pot_size}
                description={plantDetails.description}
            />
        </EditModal>
    );
};

export default EditPlantModal;
