import React from 'react';
import PropTypes from 'prop-types';
import { XMarkIcon } from '@heroicons/react/16/solid';

// Reusable modal component, can be closed with button or by clicking outside
const Modal = ({ id, children }) => {
    return (
        <dialog id={id} className="modal">
            <div className="modal-box text-center flex flex-col pt-4">
                <form method="dialog">
                    <button className="btn btn-sm btn-circle btn-ghost absolute right-4 top-4">
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
    id: PropTypes.string,
    children: PropTypes.node
};

export default Modal;
