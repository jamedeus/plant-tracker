import PropTypes from 'prop-types';
import { useDispatch, useSelector } from 'react-redux';
import FormModal from 'src/components/FormModal';
import GroupDetailsForm from 'src/components/GroupDetailsForm';
import { groupDetailsUpdateed } from './groupSlice';

const EditGroupModal = ({ close }) => {
    const dispatch = useDispatch();
    const groupDetails = useSelector((state) => state.group.groupDetails);

    return (
        <FormModal
            close={close}
            FormComponent={GroupDetailsForm}
            endpoint='/edit_group_details'
            initialValues={groupDetails}
            payload={{group_id: groupDetails.uuid}}
            onSuccess={data => dispatch(groupDetailsUpdateed(data))}
        />
    );
};

EditGroupModal.propTypes = {
    close: PropTypes.func.isRequired
};

export default EditGroupModal;
