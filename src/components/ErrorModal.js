import React, { useState, useRef } from 'react';
import Modal from 'src/components/Modal';

export let showErrorModal;

export let closeErrorModal;

export const ErrorModal = () => {
    const [message, setMessage] = useState('');
    const modalRef = useRef();

    // Takes error message to show inside modal
    showErrorModal = (error) => {
        // Stringify if received raw JSON response
        if (typeof(error) === 'object') {
            setMessage(JSON.stringify(error));
        } else {
            setMessage(error);
        }
        modalRef.current.showModal();
    };

    closeErrorModal = () => {
        modalRef.current.close();
    };

    return (
        <Modal dialogRef={modalRef}>
            <h3 className="font-bold text-lg mb-6">Error</h3>
            <div className={`min-h-36 flex flex-col justify-center mx-auto
                             whitespace-pre-line`}
            >
                {message}
            </div>
            <div className="modal-action mx-auto">
                <button className="btn" onClick={closeErrorModal}>
                    OK
                </button>
            </div>
        </Modal>
    );
};
