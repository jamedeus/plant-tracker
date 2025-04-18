import React, { useRef } from 'react';
import PropTypes from 'prop-types';
import Modal from 'src/components/Modal';

let modalRef;

export const openEditModal = () => {
    modalRef.current.open();
};

// Takes modal title, submit handler, and details form
// Modal has centered title, can be closed with button, esc, or outside click
const EditModal = ({ title, onSubmit, children }) => {
    modalRef = useRef(null);

    return (
        <Modal title={title} ref={modalRef} className="max-w-[25rem]">
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
    title: PropTypes.string.isRequired,
    onSubmit: PropTypes.func.isRequired,
    children: PropTypes.node.isRequired
};

export default EditModal;
