import React, { useState, useRef } from 'react';
import Modal from 'src/components/Modal';
import clsx from 'clsx';

export let openErrorModal;

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
                <form method="dialog">
                    <button className="btn btn-accent">
                        OK
                    </button>
                </form>
            </div>
        </Modal>
    );
};
