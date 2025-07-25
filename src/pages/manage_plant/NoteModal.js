import React, { useState, useRef, memo } from 'react';
import clsx from 'clsx';
import PropTypes from 'prop-types';
import Modal from 'src/components/Modal';
import DatetimeInput from 'src/components/DatetimeInput';
import { showToast } from 'src/components/Toast';
import HoldToConfirm from 'src/components/HoldToConfirm';
import { openErrorModal } from 'src/components/ErrorModal';
import { sendPostRequest } from 'src/util';
import { localToUTC, timestampToReadable } from 'src/timestampUtils';
import { DateTime } from 'luxon';
import { noteAdded, noteEdited, noteDeleted } from './timelineSlice';
import { useDispatch, useSelector } from 'react-redux';

let modalRef;

export let openNoteModal;

// Rendered instead of timestamp input when editing note (can't change time)
const ExistingNoteTimestamp = memo(function ExistingNoteTimestamp({ noteTime }) {
    const [time, date] = timestampToReadable(noteTime).split('-');
    return (
        <>
            <p>{date}</p>
            <p className="text-sm">{time}</p>
        </>
    );
});

ExistingNoteTimestamp.propTypes = {
    noteTime: PropTypes.string.isRequired
};

const NoteModal = () => {
    const dispatch = useDispatch();
    const plantID = useSelector((state) => state.plant.plantDetails.uuid);
    // Get user-configured hold to delete delay
    const holdToConfirmDelay = useSelector(
        (state) => state.settings.holdToConfirmDelay
    );

    // States for text and timestamp inputs
    const [noteTime, setNoteTime] = useState('');
    const [noteText, setNoteText] = useState('');
    const [charCount, setCharCount] = useState(0);

    // State shows delete button and prevents editing timestamp if true
    const [editingNote, setEditingNote] = useState(false);

    // Ref to read value of timestamp input
    const timestampRef = useRef(null);

    // Disable save button if text field empty or over character limit
    const saveButtonDisabled = !noteText.length || noteText.length > 500;

    // Create ref for Modal component (used to show/hide)
    modalRef = useRef(null);

    // Textarea listener
    const updateNoteText = (text) => {
        setNoteText(text);
        setCharCount(text.length);
    };

    openNoteModal = (note) => {
        if (note) {
            updateNoteText(note.text);
            setNoteTime(note.timestamp);
            setEditingNote(true);
        } else {
            updateNoteText('');
            setNoteTime(DateTime.now().toFormat("yyyy-MM-dd'T'HH:mm:ss"));
            setEditingNote(false);
        }
        modalRef.current.open();
    };

    const handleSubmit = async () => {
        const response = await sendPostRequest('/add_plant_note', {
            plant_id: plantID,
            timestamp: localToUTC(timestampRef.current.value),
            note_text: noteText
        });

        if (response.ok) {
            // Update state with new note from response, close modal
            const data = await response.json();
            dispatch(noteAdded({
                timestamp: data.timestamp,
                text: data.note_text
            }));
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
                openErrorModal(JSON.stringify(error));
            }
        }
    };

    const handleEdit = async () => {
        const response = await sendPostRequest('/edit_plant_note', {
            plant_id: plantID,
            timestamp: noteTime,
            note_text: noteText
        });

        if (response.ok) {
            // Update note state with params from response, close modal
            const data = await response.json();
            dispatch(noteEdited({
                timestamp: data.timestamp,
                text: data.note_text
            }));
            modalRef.current.close();
        } else {
            // Show error in modal
            const error = await response.json();
            openErrorModal(JSON.stringify(error));
        }
    };

    const handleDelete = async () => {
        const response = await sendPostRequest('/delete_plant_notes', {
            plant_id: plantID,
            timestamps: [noteTime]
        });

        if (response.ok) {
            // Remove note from state, close modal
            const data = await response.json();
            dispatch(noteDeleted(data.deleted[0]));
            modalRef.current.close();
        } else {
            // Show error in modal
            const error = await response.json();
            openErrorModal(JSON.stringify(error));
        }
    };

    return (
        <Modal title={editingNote ? "Edit Note" : "Add Note"} ref={modalRef}>
            <div className="flex flex-col">
                <div className="min-h-36 flex flex-col items-center mt-2">
                    {editingNote
                        ? <ExistingNoteTimestamp noteTime={noteTime} />
                        : <DatetimeInput inputRef={timestampRef} />
                    }
                    <textarea
                        className={clsx(
                            'textarea w-full max-w-xs mx-auto mt-8 mb-4 min-h-40',
                            charCount > 500 && 'textarea-error'
                        )}
                        value={noteText}
                        onChange={e => updateNoteText(e.target.value)}
                    ></textarea>
                    <span className={clsx(
                        'text-sm',
                        charCount > 500 && 'text-error'
                    )}>
                        {charCount} / 500
                    </span>
                </div>
                <div className="modal-action">
                    {editingNote ? (
                        <>
                            <HoldToConfirm
                                callback={handleDelete}
                                timeout={holdToConfirmDelay}
                                buttonText="Delete"
                                buttonClass="w-20"
                                tooltipText="Hold to confirm"
                            />
                            <button
                                className="btn btn-accent w-20"
                                onClick={handleEdit}
                                disabled={saveButtonDisabled}
                            >
                                Save
                            </button>
                        </>
                    ) : (
                        <button
                            className="btn btn-accent"
                            onClick={handleSubmit}
                            disabled={saveButtonDisabled}
                        >
                            Save
                        </button>
                    )}
                </div>
            </div>
        </Modal>
    );
};

export default NoteModal;
