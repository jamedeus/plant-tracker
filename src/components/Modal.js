import React from 'react';
import PropTypes from 'prop-types';
import { XMarkIcon } from '@heroicons/react/16/solid';

// Reusable modal component, can be closed with button or by clicking outside
const Modal = ({ dialogRef, title, children, className='', onClose }) => {
    return (
        <dialog className="modal" ref={dialogRef} onClose={onClose}>
            <div className={`modal-box text-center flex flex-col pt-4 ${className}`}>
                <form method="dialog">
                    <button className="btn-close absolute right-4 top-4">
                        <XMarkIcon className="w-8 h-8" />
                    </button>
                </form>

                {title ? (
                    <h1 className="font-bold text-lg md:text-xl mb-4">
                        {title}
                    </h1>
                ) : (
                    null
                )}

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
        PropTypes.shape({ current: PropTypes.instanceOf(Element) }),
    ]).isRequired,
    title: PropTypes.string,
    children: PropTypes.node.isRequired,
    className: PropTypes.string,
    onClose: PropTypes.func
};

export default Modal;
