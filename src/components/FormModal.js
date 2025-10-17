import React, { useState, useRef } from 'react';
import PropTypes from 'prop-types';
import sendPostRequest from 'src/utils/sendPostRequest';

// Reusable component to render a form with submit handler and validation.
// Intended to be rendered inside LazyModal component.
//
// FormComponent must accept a ref and attach it to the <form> element
// initialValues is an optional object used to prefill form values
// endpoint is the API endpoint formData is POSTed to on submit
// payload is an optional object that is concatenated with formData before POST
// onSuccess is a callback function that receives response data after success
const FormModal = ({ close, FormComponent, initialValues, endpoint, payload, onSubmit, onSuccess }) => {
    const formRef = useRef(null);

    // Disable edit button if form is invalid (field exceeded length limit)
    const [formIsValid, setFormIsValid] = useState(true);
    const onInput = () => {
        setFormIsValid(formRef.current.checkValidity());
    };

    const submit = async () => {
        onSubmit?.();
        const data = {
            ...payload,
            ...Object.fromEntries(new FormData(formRef.current))
        };
        await sendPostRequest(endpoint, data, onSuccess);
    };

    return (
        <>
            <div onInput={onInput}>
                <FormComponent formRef={formRef} {...initialValues} />
            </div>

            <div className="modal-action">
                <button className="btn btn-soft w-20" onClick={close}>
                    Cancel
                </button>
                <button
                    className="btn btn-accent w-20"
                    onClick={submit}
                    disabled={!formIsValid}
                >
                    Edit
                </button>
            </div>
        </>
    );
};

FormModal.propTypes = {
    close: PropTypes.func.isRequired,
    FormComponent: PropTypes.func.isRequired,
    initialValues: PropTypes.object,
    endpoint: PropTypes.string.isRequired,
    payload: PropTypes.object,
    onSubmit: PropTypes.func,
    onSuccess: PropTypes.func.isRequired
};

export default FormModal;
