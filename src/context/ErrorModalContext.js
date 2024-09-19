import React, { createContext, useContext, useState, useRef } from 'react';
import PropTypes from 'prop-types';
import Modal from 'src/components/Modal';

const ErrorModalContext = createContext();

export const useErrorModal = () => useContext(ErrorModalContext);

export const ErrorModalProvider = ({ children }) => {
    const [message, setMessage] = useState('');
    const modalRef = useRef();

    // Takes error message to show inside modal
    const showErrorModal = (error) => {
        // Stringify if received raw JSON response
        if (typeof(error) === 'object') {
            setMessage(JSON.stringify(error));
        } else {
            setMessage(error);
        }
        modalRef.current.showModal();
    };

    const closeErrorModal = () => {
        modalRef.current.close();
    };

    return (
        <ErrorModalContext.Provider value={{ showErrorModal, closeErrorModal }}>
            {children}
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
        </ErrorModalContext.Provider>
    );
};

ErrorModalProvider.propTypes = {
    children: PropTypes.node,
};
