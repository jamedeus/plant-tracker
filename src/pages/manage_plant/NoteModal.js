import React, { useState, useRef, useImperativeHandle } from 'react';
import PropTypes from 'prop-types';
import Modal from 'src/components/Modal';
import DatetimeInput from 'src/components/DatetimeInput';
import { useToast } from 'src/context/ToastContext';
import { useErrorModal } from 'src/context/ErrorModalContext';
import { sendPostRequest } from 'src/util';
import { localToUTC, timestampToReadable } from 'src/timestampUtils';
import { DateTime } from 'luxon';

const NoteModal = React.forwardRef(function NoteModal({ plantID, notes, setNotes }, ref) {
    // States for text and timestamp inputs
    const [noteTime, setNoteTime] = useState('');
    const [noteText, setNoteText] = useState('');
    const [charCount, setCharCount] = useState(0);

    // State shows delete button and prevents editing timestamp if true
    const [editingNote, setEditingNote] = useState(false);

    // Ref to read value of timestamp input
    const timestampRef = useRef(null);

    // Create ref for Modal component (used to show/hide)
    const noteModalRef = useRef(null);

    // Textarea listener
    const updateNoteText = (text) => {
        setNoteText(text);
        setCharCount(text.length);
    };

    // Make open and close methods available in parent component
    useImperativeHandle(ref, () => {
        return {
            open(note) {
                if (note) {
                    updateNoteText(note.text);
                    setNoteTime(note.timestamp);
                    setEditingNote(true);
                } else {
                    updateNoteText('');
                    setNoteTime(DateTime.now().toFormat("yyyy-MM-dd'T'HH:mm:ss"));
                    setEditingNote(false);
                }
                noteModalRef.current.showModal();
            },
        };
    });

    // Get hooks to show toast message, error modal
    const { showToast } = useToast();
    const { showErrorModal } = useErrorModal();

    const handleSubmit = async () => {
        // Build payload, post to backend
        const payload = {
            plant_id: plantID,
            timestamp: localToUTC(timestampRef.current.value),
            note_text: noteText
        };
        const response = await sendPostRequest('/add_plant_note', payload);

        if (response.ok) {
            // Update state with new note, close modal
            setNotes([
                ...notes,
                {timestamp: payload.timestamp, text: payload.note_text}
            ]);
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

    const handleEdit = async () => {
        // Build payload, post to backend
        const payload = {
            plant_id: plantID,
            timestamp: noteTime,
            note_text: noteText
        };
        const response = await sendPostRequest('/edit_plant_note', payload);

        if (response.ok) {
            // Update text in note state, close modal
            setNotes(notes.map(note => {
                if (note.timestamp === payload.timestamp) {
                    return {timestamp: payload.timestamp, text: payload.note_text};
                } else {
                    return note;
                }
            }));
            noteModalRef.current.close();
        } else {
            // Show error in modal
            const error = await response.json();
            showErrorModal(JSON.stringify(error));
        }
    };

    const handleDelete = async () => {
        // Build payload, post to backend
        const payload = {
            plant_id: plantID,
            timestamp: noteTime
        };
        const response = await sendPostRequest('/delete_plant_note', payload);

        if (response.ok) {
            // Remove note from state, close modal
            setNotes(notes.filter(note => note.timestamp !== noteTime));
            noteModalRef.current.close();
        } else {
            // Show error in modal
            const error = await response.json();
            showErrorModal(JSON.stringify(error));
        }
    };

    // Rendered instead of timestamp input when editing note (can't change time)
    const ExistingNoteTimestamp = () => {
        const [time, date] = timestampToReadable(noteTime).split('-');
        return (
            <>
                <p>{date}</p>
                <p className="text-sm">{time}</p>
            </>
        );
    };

    return (
        <Modal dialogRef={noteModalRef} title={editingNote ? "Edit Note" : "Add Note"}>
            <div className="flex flex-col">
                <div className="min-h-36 flex flex-col justify-center mt-2">
                    {editingNote
                        ? <ExistingNoteTimestamp />
                        : <DatetimeInput inputRef={timestampRef} />
                    }
                    <textarea
                        className={`textarea textarea-bordered w-full max-w-xs
                                    mx-auto mt-8 mb-4 min-h-40
                                    ${charCount > 500 ? 'textarea-error' : ''}`}
                        value={noteText}
                        onChange={e => updateNoteText(e.target.value)}
                    ></textarea>
                    <span className={`text-sm ${charCount > 500 ? 'text-error' : ''}`}>
                        {charCount} / 500
                    </span>
                </div>
                {editingNote
                    ? (
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
                                disabled={!noteText.length}
                            >
                                Save
                            </button>
                        </div>
                    ) : (
                        <div className="modal-action mx-auto">
                            <button
                                className="btn btn-success"
                                onClick={handleSubmit}
                                disabled={!noteText.length}
                            >
                                Save
                            </button>
                        </div>
                    )
                }
            </div>
        </Modal>
    );
});

NoteModal.propTypes = {
    plantID: PropTypes.string,
    notes: PropTypes.array,
    setNotes: PropTypes.func
};

export default NoteModal;
