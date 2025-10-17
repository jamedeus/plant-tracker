import PropTypes from 'prop-types';
import FormModal from 'src/components/FormModal';
import PlantDetailsForm from 'src/components/PlantDetailsForm';
import { useSelector, useDispatch } from 'react-redux';
import { plantDetailsUpdated } from './plantSlice';

const EditPlantModal = ({ close }) => {
    const dispatch = useDispatch();
    const plantDetails = useSelector((state) => state.plant.plantDetails);

    const onSuccess = (data) => {
        dispatch(plantDetailsUpdated(data));
        close();
    };

    return (
        <FormModal
            close={close}
            FormComponent={PlantDetailsForm}
            endpoint='/edit_plant_details'
            initialValues={plantDetails}
            payload={{plant_id: plantDetails.uuid}}
            onSuccess={onSuccess}
        />
    );
};

EditPlantModal.propTypes = {
    close: PropTypes.func.isRequired
};

export default EditPlantModal;
