import React, { useRef, memo } from 'react';
import PropTypes from 'prop-types';
import { useDispatch, useSelector } from 'react-redux';
import sendPostRequest from 'src/utils/sendPostRequest';
import EditModal from 'src/components/EditModal';
import GroupDetailsForm from 'src/components/GroupDetailsForm';
import { openErrorModal } from 'src/components/ErrorModal';
import { groupDetailsUpdateed } from './groupSlice';

const EditGroupModal = memo(function EditGroupModal({ close }) {
    const groupDetails = useSelector((state) => state.group.groupDetails);
    const dispatch = useDispatch();
    const formRef = useRef(null);

    const submit = async () => {
        const response = await sendPostRequest('/edit_group_details', {
            group_id: groupDetails.uuid,
            ...Object.fromEntries(new FormData(formRef.current))
        });
        if (response.ok) {
            // Update group details state with new values from response
            const data = await response.json();
            dispatch(groupDetailsUpdateed(data));
        } else {
            const error = await response.json();
            openErrorModal(JSON.stringify(error));
        }
    };

    return (
        <EditModal formRef={formRef} onSubmit={submit} close={close}>
            <GroupDetailsForm
                formRef={formRef}
                name={groupDetails.name}
                location={groupDetails.location}
                description={groupDetails.description}
            />
        </EditModal>
    );
});

EditGroupModal.propTypes = {
    close: PropTypes.func.isRequired
};

export default EditGroupModal;
