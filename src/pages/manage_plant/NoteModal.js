import React, { useState, useRef } from 'react';
import PropTypes from 'prop-types';
import Cookies from 'js-cookie';
import Modal from 'src/components/Modal';
import DatetimeInput from 'src/components/DatetimeInput';
import { useToast } from 'src/context/ToastContext';
import { useErrorModal } from 'src/context/ErrorModalContext';

let noteModalRef;

export const openNoteModal = () => {
    noteModalRef.current.showModal();
};

const NoteModal = ({ plantID, addNote }) => {
    noteModalRef = useRef(null);

    // Submit button enable state
    const [disabled, setDisabled] = useState(true);

    // Refs to track timestamp and text inputs
    const timestampRef = useRef(null);
    const noteTextRef = useRef(null);

    // Get hooks to show toast message, error modal
    const { showToast } = useToast();
    const { showErrorModal } = useErrorModal();

    const handleSubmit = async () => {
        // Build payload
        const payload = {
            plant_id: plantID,
            timestamp: timestampRef.current.value,
            note_text: noteTextRef.current.value
        }

        // Post to backend
        const response = await fetch('/add_plant_note', {
            method: 'POST',
            body: JSON.stringify(payload),
            headers: {
                'Accept': 'application/json, text/plain, */*',
                "X-CSRFToken": Cookies.get('csrftoken')
            }
        });

        if (response.ok) {
            // Update state with new note, close modal
            addNote(payload.timestamp, payload.note_text);
            noteModalRef.current.close();
        } else {
            // Duplicate note timestamp: show error toast for 5 seconds
            if (response.status === 409) {
                showToast(
                    `Error: note with same timestamp already exists`,
                    'red',
                    5000
                );
            // Other error (unexpected): show in error modal
            } else {
                const error = await response.json();
                showErrorModal(JSON.stringify(error));
            }
        }
    };

    return (
        <Modal dialogRef={noteModalRef} title={"Add Note"}>
            <div className="flex flex-col">
                <div className="min-h-36 flex flex-col justify-center mt-2">
                    <DatetimeInput inputRef={timestampRef} />
                    <textarea
                        className={`textarea textarea-bordered w-full max-w-xs
                                    mx-auto mt-8 mb-4 min-h-40`}
                        ref={noteTextRef}
                        onInput={e => setDisabled(!Boolean(e.target.value.length))}
                    ></textarea>
                </div>

                <div className="modal-action mx-auto">
                    <button
                        className="btn btn-success"
                        onClick={handleSubmit}
                        disabled={disabled}
                    >
                        Save
                    </button>
                </div>
            </div>
        </Modal>
    );
};

NoteModal.propTypes = {
    plantID: PropTypes.string,
    addNote: PropTypes.func
};

export default NoteModal;
