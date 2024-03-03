import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { XMarkIcon } from '@heroicons/react/16/solid';

// Reusable modal component, can be closed with button or by clicking outside
const Modal = ({ dialogRef, children }) => {
    return (
        <dialog className="modal" ref={dialogRef}>
            <div className="modal-box text-center flex flex-col pt-4">
                <form method="dialog">
                    <button className="btn-close absolute right-4 top-4">
                        <XMarkIcon className="w-8 h-8" />
                    </button>
                </form>
                {children}
            </div>
            <form method="dialog" className="modal-backdrop">
                <button>close</button>
            </form>
        </dialog>
    );
};

Modal.propTypes = {
    dialogRef: PropTypes.oneOfType([
        PropTypes.func,
        PropTypes.shape({ current: PropTypes.instanceOf(Component) }),
    ]),
    children: PropTypes.node
};

export default Modal;
