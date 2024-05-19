import React, { createContext, useContext, useState, useRef } from 'react';
import PropTypes from 'prop-types';
import Modal from 'src/components/Modal';
import { DateTime } from 'luxon';
import DatetimeInput from 'src/components/DatetimeInput';
import { useToast } from 'src/context/ToastContext';
import { useErrorModal } from 'src/context/ErrorModalContext';
import {
    parseDomContext,
    sendPostRequest,
    localToUTC,
    timestampToReadable
} from 'src/util';

const NoteModalContext = createContext();

export const useNoteModal = () => useContext(NoteModalContext);

export const NoteModalProvider = ({ children }) => {
    // Load context set by django template
    const [notes, setNotes] = useState(() => {
        return parseDomContext("notes");
    });

    // Updates state after successful add_plant_note API call
    const addNote = (timestamp, text) => {
        setNotes([...notes, {timestamp: timestamp, text: text}]);
    };

    // Updates state after successful edit_plant_note API call
    const updateNote = (timestamp, text) => {
        setNotes(notes.map(note => {
            if (note.timestamp === timestamp) {
                return {timestamp: timestamp, text: text};
            } else {
                return note;
            }
        }));
    };

    // Updates state after successful delete_plant_note API call
    const removeNote = (timestamp) => {
        setNotes(notes.filter(note => note.timestamp !== timestamp));
    };

    // Create ref and states for NoteModal input contents
    const noteModalRef = useRef(null);
    const [noteText, setNoteText] = useState('');
    const [noteTime, setNoteTime] = useState('');
    const [editingNote, setEditingNote] = useState(false);

    // Call with no arg to open empty modal (add new note)
    // Call with existing note object (text and timestamp keys) to edit note
    const openNoteModal = (editNote=null) => {
        if (editNote) {
            setNoteText(editNote.text);
            setNoteTime(editNote.timestamp);
            setEditingNote(true);
        } else {
            setNoteText('');
            setEditingNote(false);
        }
        noteModalRef.current.showModal();
    };

    const closeNoteModal = () => {
        noteModalRef.current.close();
    };

    return (
        <NoteModalContext.Provider value={{
            notes,
            addNote,
            updateNote,
            removeNote,
            noteModalRef,
            noteText,
            setNoteText,
            noteTime,
            editingNote,
            openNoteModal,
            closeNoteModal,
        }}>
            {children}
        </NoteModalContext.Provider>
    );
};

NoteModalProvider.propTypes = {
    children: PropTypes.node,
};

const NoteModal = ({ plantID }) => {
    // Ref to read value of timestamp input
    const timestampRef = useRef(null);

    // Get states and hooks from context
    const {
        addNote,
        removeNote,
        updateNote,
        noteModalRef,
        noteText,
        setNoteText,
        noteTime,
        editingNote,
        closeNoteModal
    } = useNoteModal();

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
            addNote(payload.timestamp, payload.note_text);
            closeNoteModal();
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
            updateNote(payload.timestamp, payload.note_text);
            closeNoteModal();
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
            removeNote(payload.timestamp);
            closeNoteModal();
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
                const [time, date] = timestampToReadable(noteTime).split('-');
                return (
                    <>
                        <p>{date}</p>
                        <p className="text-sm">{time}</p>
                    </>
                );
            case(false):
                return <DatetimeInput inputRef={timestampRef} />;
        }
    };

    return (
        <Modal dialogRef={noteModalRef} title={editingNote ? "Edit Note" : "Add Note"}>
            <div className="flex flex-col">
                <div className="min-h-36 flex flex-col justify-center mt-2">
                    <TimestampInput />
                    <textarea
                        className={`textarea textarea-bordered w-full max-w-xs
                                    mx-auto mt-8 mb-4 min-h-40`}
                        value={noteText}
                        onChange={e => setNoteText(e.target.value)}
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
                                        disabled={!noteText.length}
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
                                        disabled={!noteText.length}
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
    plantID: PropTypes.string
};

export default NoteModal;
