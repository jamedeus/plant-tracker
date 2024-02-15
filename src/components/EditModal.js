import React, { useState, useEffect, useRef } from 'react';

// Takes modal title, submit handler, and details form
// Modal has centered title, can be closed with button, esc, or outside click
const EditModal = ({ title, onSubmit, children }) => {

    return (
        <dialog id="editModal" className="modal">
            <div className="modal-box text-center flex flex-col">
                <form method="dialog">
                    <button className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
                </form>
                <h3 className="font-bold text-lg">{title}</h3>

                {children}

                <div className="modal-action mx-auto">
                    <form method="dialog">
                        <button className="btn mr-2">Cancel</button>
                        <button className="btn ml-2" onClick={onSubmit}>Edit</button>
                    </form>
                </div>
            </div>
            <form method="dialog" className="modal-backdrop">
                <button>close</button>
            </form>
        </dialog>
    )
}

export default EditModal;
