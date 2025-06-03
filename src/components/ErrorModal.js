import React, { useState, useRef } from 'react';
import Modal from 'src/components/Modal';
import clsx from 'clsx';

export let openErrorModal;

export let closeErrorModal;

export const ErrorModal = () => {
    const [message, setMessage] = useState('');
    const modalRef = useRef();

    // Takes error message to show inside modal
    openErrorModal = (error) => {
        // Stringify if received raw JSON response
        if (typeof(error) === 'object') {
            setMessage(JSON.stringify(error));
        } else {
            setMessage(error);
        }
        modalRef.current.open();
    };

    closeErrorModal = () => {
        modalRef.current.close();
    };

    return (
        <Modal ref={modalRef}>
            <h3 className="font-bold text-lg mb-6">Error</h3>
            <div className={clsx(
                'min-h-36 flex flex-col justify-center mx-auto',
                'whitespace-pre-line'
            )}>
                {message}
            </div>
            <div className="modal-action">
                <button className="btn" onClick={closeErrorModal}>
                    OK
                </button>
            </div>
        </Modal>
    );
};
