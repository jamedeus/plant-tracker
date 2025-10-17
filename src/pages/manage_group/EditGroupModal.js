import PropTypes from 'prop-types';
import { useDispatch, useSelector } from 'react-redux';
import FormModal from 'src/components/FormModal';
import GroupDetailsForm from 'src/components/GroupDetailsForm';
import { groupDetailsUpdateed } from './groupSlice';

const EditGroupModal = ({ close }) => {
    const dispatch = useDispatch();
    const groupDetails = useSelector((state) => state.group.groupDetails);

    const onSuccess = (data) => {
        dispatch(groupDetailsUpdateed(data));
        close();
    };

    return (
        <FormModal
            close={close}
            FormComponent={GroupDetailsForm}
            endpoint='/edit_group_details'
            initialValues={groupDetails}
            payload={{group_id: groupDetails.uuid}}
            onSuccess={onSuccess}
        />
    );
};

EditGroupModal.propTypes = {
    close: PropTypes.func.isRequired
};

export default EditGroupModal;
