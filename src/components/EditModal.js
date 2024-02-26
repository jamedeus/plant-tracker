import React from 'react';
import PropTypes from 'prop-types';
import Modal from 'src/components/Modal';

export const openEditModal = () => {
    document.getElementById('editModal').showModal();
};

// Takes modal title, submit handler, and details form
// Modal has centered title, can be closed with button, esc, or outside click
const EditModal = ({ title, onSubmit, children }) => {
    return (
        <Modal id="editModal">
            <h3 className="font-bold text-lg">{title}</h3>

            {children}

            <div className="modal-action mx-auto">
                <form method="dialog">
                    <button className="btn mr-2">
                        Cancel
                    </button>
                    <button className="btn ml-2" onClick={onSubmit}>
                        Edit
                    </button>
                </form>
            </div>
        </Modal>
    );
};

EditModal.propTypes = {
    title: PropTypes.string,
    onSubmit: PropTypes.func,
    children: PropTypes.node
};

export default EditModal;
