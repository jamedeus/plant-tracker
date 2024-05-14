import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import Cookies from 'js-cookie';
import Modal from 'src/components/Modal';
import { DateTime } from 'luxon';
import DatetimeInput from 'src/components/DatetimeInput';
import { useToast } from 'src/context/ToastContext';
import { useErrorModal } from 'src/context/ErrorModalContext';

const NoteModal = ({ plantID, addNote, removeNote, modalRef, noteText, noteTime, editingNote }) => {
    // Refs to track timestamp and text inputs
    const timestampRef = useRef(null);
    const noteTextRef = useRef(null);

    const [text, setText] = useState(noteText);

    useEffect(() => {
        setText(noteText);
    }, [noteText]);

    // Get hooks to show toast message, error modal
    const { showToast } = useToast();
    const { showErrorModal } = useErrorModal();

    const handleSubmit = async () => {
        // Build payload
        const payload = {
            plant_id: plantID,
            timestamp: timestampRef.current.value,
            note_text: noteTextRef.current.value
        };

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
            modalRef.current.close();
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

    const handleEdit = async () => {
        alert("Not implemented");
    };

    const handleDelete = async () => {
        // Build payload
        const payload = {
            plant_id: plantID,
            timestamp: noteTime
        };

        // Post to backend
        const response = await fetch('/delete_plant_note', {
            method: 'POST',
            body: JSON.stringify(payload),
            headers: {
                'Accept': 'application/json, text/plain, */*',
                "X-CSRFToken": Cookies.get('csrftoken')
            }
        });

        if (response.ok) {
            // Remove note from state, close modal
            removeNote(payload.timestamp);
            modalRef.current.close();
        } else {
            // Show error in modal
            const error = await response.json();
            showErrorModal(JSON.stringify(error));
        }
    };

    // Renders input when adding new note, timestamp string when editing
    const TimestampInput = () => {
        switch(editingNote) {
            case(true):
                return (
                    <p>{DateTime.fromISO(noteTime).toFormat('MMM dd, yyyy')}</p>
                );
            case(false):
                return <DatetimeInput inputRef={timestampRef} />;
        }
    };

    return (
        <Modal dialogRef={modalRef} title={editingNote ? "Edit Note" : "Add Note"}>
            <div className="flex flex-col">
                <div className="min-h-36 flex flex-col justify-center mt-2">
                    <TimestampInput />
                    <textarea
                        className={`textarea textarea-bordered w-full max-w-xs
                                    mx-auto mt-8 mb-4 min-h-40`}
                        ref={noteTextRef}
                        value={text}
                        onChange={e => setText(e.target.value)}
                    ></textarea>
                </div>
                {(() => {
                    switch(editingNote) {
                        case(true):
                            return (
                                <div className="modal-action mx-auto">
                                    <button
                                        className="btn btn-error"
                                        onClick={handleDelete}
                                    >
                                        Delete
                                    </button>
                                    <button
                                        className="btn btn-success"
                                        onClick={handleEdit}
                                        disabled={!text.length}
                                    >
                                        Save
                                    </button>
                                </div>
                            );
                        case(false):
                            return (
                                <div className="modal-action mx-auto">
                                    <button
                                        className="btn btn-success"
                                        onClick={handleSubmit}
                                        disabled={!text.length}
                                    >
                                        Save
                                    </button>
                                </div>
                            );
                    }
                })()}
            </div>
        </Modal>
    );
};

NoteModal.propTypes = {
    plantID: PropTypes.string,
    addNote: PropTypes.func,
    removeNote: PropTypes.func,
    modalRef: PropTypes.oneOfType([
        PropTypes.func,
        PropTypes.shape({ current: PropTypes.instanceOf(Element) }),
    ]),
    noteText: PropTypes.string,
    noteTime: PropTypes.string,
    editingNote: PropTypes.bool
};

export default NoteModal;
