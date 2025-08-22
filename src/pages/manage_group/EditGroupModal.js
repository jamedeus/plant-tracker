import React, { useRef, memo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { sendPostRequest } from 'src/util';
import EditModal from 'src/components/EditModal';
import GroupDetailsForm from 'src/components/GroupDetailsForm';
import { openErrorModal } from 'src/components/ErrorModal';
import { groupDetailsUpdateed } from './groupSlice';

const EditGroupModal = memo(function EditGroupModal() {
    const group = useSelector((state) => state.group.group);
    const dispatch = useDispatch();
    const formRef = useRef(null);

    const submit = async () => {
        const response = await sendPostRequest('/edit_group_details', {
            group_id: group.uuid,
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
        <EditModal title="Edit Details" formRef={formRef} onSubmit={submit}>
            <GroupDetailsForm
                formRef={formRef}
                name={group.name}
                location={group.location}
                description={group.description}
            />
        </EditModal>
    );
});

export default EditGroupModal;
