import React, { createContext, useContext, useState, useRef } from 'react';
import PropTypes from 'prop-types';
import Modal from 'src/components/Modal';
import DatetimeInput from 'src/components/DatetimeInput';
import { useToast } from 'src/context/ToastContext';
import { useErrorModal } from 'src/context/ErrorModalContext';
import { parseDomContext, sendPostRequest } from 'src/util';
import { localToUTC, timestampToReadable } from 'src/timestampUtils';

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

    // Create state to set EditNoteModal timestamp
    const [noteTime, setNoteTime] = useState('');

    // Create ref to set/read value of textarea
    const noteTextRef = useRef(null);

    // Create refs to open/close each modal
    const newNoteModalRef = useRef(null);
    const editNoteModalRef = useRef(null);

    const openNewNoteModal = () => {
        newNoteModalRef.current.showModal();
    };

    const openEditNoteModal = (timestamp, text) => {
        setNoteTime(timestamp);
        noteTextRef.current.value = text;
        editNoteModalRef.current.showModal();
    };

    return (
        <NoteModalContext.Provider value={{
            notes,
            addNote,
            updateNote,
            removeNote,
            newNoteModalRef,
            editNoteModalRef,
            noteTime,
            noteTextRef,
            openNewNoteModal,
            openEditNoteModal
        }}>
            {children}
        </NoteModalContext.Provider>
    );
};

NoteModalProvider.propTypes = {
    children: PropTypes.node,
};

export const NewNoteModal = ({ plantID }) => {
    // Create refs to read values of timestamp input and textarea
    const timestampRef = useRef(null);
    const noteTextRef = useRef(null);

    // Create state to control submit button enable state
    const [disabled, setDisabled] = useState(true);

    // Get states and hooks from context
    const { addNote, newNoteModalRef } = useNoteModal();

    // Get hooks to show toast message, error modal
    const { showToast } = useToast();
    const { showErrorModal } = useErrorModal();

    const handleSubmit = async () => {
        // Build payload, post to backend
        const payload = {
            plant_id: plantID,
            timestamp: localToUTC(timestampRef.current.value),
            note_text: noteTextRef.current.value
        };
        const response = await sendPostRequest('/add_plant_note', payload);

        if (response.ok) {
            // Update state with new note, close modal
            addNote(payload.timestamp, payload.note_text);
            newNoteModalRef.current.close();
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
        <Modal dialogRef={newNoteModalRef} title="Add Note">
            <div className="flex flex-col">
                <div className="min-h-36 flex flex-col justify-center mt-2">
                    <DatetimeInput inputRef={timestampRef} />
                    <textarea
                        className={`textarea textarea-bordered w-full max-w-xs
                                    mx-auto mt-8 mb-4 min-h-40`}
                        ref={noteTextRef}
                        onChange={(e) => setDisabled(!e.target.value.length)}
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

NewNoteModal.propTypes = {
    plantID: PropTypes.string
};

export const EditNoteModal = ({ plantID }) => {
    // Get states and hooks from context
    const {
        removeNote,
        updateNote,
        editNoteModalRef,
        noteTime,
        noteTextRef
    } = useNoteModal();

    // Create state to control submit button enable state
    const [disabled, setDisabled] = useState(false);

    // Get hook to show error modal
    const { showErrorModal } = useErrorModal();

    // Shown above text area (can't be edited)
    const [time, date] = timestampToReadable(noteTime).split('-');

    const handleEdit = async () => {
        // Build payload, post to backend
        const payload = {
            plant_id: plantID,
            timestamp: noteTime,
            note_text: noteTextRef.current.value
        };
        const response = await sendPostRequest('/edit_plant_note', payload);

        if (response.ok) {
            // Update text in note state, close modal
            updateNote(payload.timestamp, payload.note_text);
            editNoteModalRef.current.close();
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
            editNoteModalRef.current.close();
        } else {
            // Show error in modal
            const error = await response.json();
            showErrorModal(JSON.stringify(error));
        }
    };

    return (
        <Modal dialogRef={editNoteModalRef} title="Edit Note">
            <div className="flex flex-col">
                <div className="min-h-36 flex flex-col justify-center mt-2">
                    <p>{date}</p>
                    <p className="text-sm">{time}</p>
                    <textarea
                        className={`textarea textarea-bordered w-full max-w-xs
                                    mx-auto mt-8 mb-4 min-h-40`}
                        ref={noteTextRef}
                        onChange={(e) => setDisabled(!e.target.value.length)}
                    ></textarea>
                </div>
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
                        disabled={disabled}
                    >
                        Save
                    </button>
                </div>
            </div>
        </Modal>
    );
};

EditNoteModal.propTypes = {
    plantID: PropTypes.string
};
