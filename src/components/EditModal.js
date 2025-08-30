import React, { useState } from 'react';
import PropTypes from 'prop-types';

// Takes modal title, submit handler, and details form
// Modal has centered title, can be closed with button, esc, or outside click
const EditModal = ({ formRef, onSubmit, close, children }) => {
    // Disable edit button if form is invalid (field exceeded length limit)
    const [formIsValid, setFormIsValid] = useState(true);
    const onInput = () => {
        setFormIsValid(formRef.current.checkValidity());
    };

    return (
        <>
            <div onInput={onInput}>
                {children}
            </div>

            <div className="modal-action">
                <form method="dialog" onSubmit={close}>
                    <button className="btn btn-soft w-20">
                        Cancel
                    </button>
                    <button
                        className="btn btn-accent w-20"
                        onClick={onSubmit}
                        disabled={!formIsValid}
                    >
                        Edit
                    </button>
                </form>
            </div>
        </>
    );
};

EditModal.propTypes = {
    formRef: PropTypes.oneOfType([
        PropTypes.func,
        PropTypes.shape({ current: PropTypes.instanceOf(Element) }),
    ]).isRequired,
    onSubmit: PropTypes.func.isRequired,
    close: PropTypes.func.isRequired,
    children: PropTypes.node.isRequired
};

export default EditModal;
