import React, { useRef, memo } from 'react';
import PropTypes from 'prop-types';
import { sendPostRequest } from 'src/util';
import EditModal from 'src/components/EditModal';
import GroupDetailsForm from 'src/components/GroupDetailsForm';
import { openErrorModal } from 'src/components/ErrorModal';

const EditGroupModal = memo(function EditGroupModal({ group, setGroup }) {
    const formRef = useRef(null);

    const submit = async () => {
        const response = await sendPostRequest('/edit_group_details', {
            group_id: group.uuid,
            ...Object.fromEntries(new FormData(formRef.current))
        });
        if (response.ok) {
            // Update plant state with new values from response
            const data = await response.json();
            setGroup(prevGroup => {
                return { ...prevGroup, ...data };
            });
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

EditGroupModal.propTypes = {
    group: PropTypes.shape({
        name: PropTypes.string,
        uuid: PropTypes.string.isRequired,
        location: PropTypes.string,
        description: PropTypes.string
    }).isRequired,
    setGroup: PropTypes.func.isRequired
};

export default EditGroupModal;
