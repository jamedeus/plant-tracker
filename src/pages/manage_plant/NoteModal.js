import React, { useState, useRef, useLayoutEffect, memo } from 'react';
import PropTypes from 'prop-types';
import clsx from 'clsx';
import DatetimeInput from 'src/components/DatetimeInput';
import { showToast } from 'src/components/Toast';
import HoldToConfirm from 'src/components/HoldToConfirm';
import { openErrorModal } from 'src/components/ErrorModal';
import sendPostRequest from 'src/utils/sendPostRequest';
import { localToUTC, timestampToReadable } from 'src/utils/timestampUtils';
import { noteAdded, noteEdited, notesDeleted } from './timelineSlice';
import { useDispatch, useSelector } from 'react-redux';
import isoTimestampTzPropType from 'src/types/isoTimestampTzPropType';

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
    noteTime: isoTimestampTzPropType.isRequired
};

const NoteModal = ({ note, close, setTitle }) => {
    const dispatch = useDispatch();
    const plantID = useSelector((state) => state.plant.plantDetails.uuid);
    // Get user-configured hold to delete delay
    const holdToConfirmDelay = useSelector(
        (state) => state.settings.holdToConfirmDelay
    );

    // States for text input + character count
    const [noteText, setNoteText] = useState(note?.text || '');
    const [charCount, setCharCount] = useState(note?.text.length || 0);

    // Show delete button and prevent editing timestamp if true
    const editingNote = note ? true : false;
    useLayoutEffect(() => setTitle(editingNote ? "Edit Note" : "Add Note"), []);

    // Ref to read value of timestamp input
    const timestampRef = useRef(null);

    // Disable save button if text field empty or over character limit
    const saveButtonDisabled = !noteText.length || noteText.length > 500;

    // Textarea listener
    const updateNoteText = (text) => {
        setNoteText(text);
        setCharCount(text.length);
    };

    const handleSubmit = async () => {
        const payload = {
            plant_id: plantID,
            timestamp: localToUTC(timestampRef.current.value),
            note_text: noteText
        };
        // Update note state with params from response, close modal
        const onSuccess = (data) => {
            dispatch(noteAdded({
                timestamp: data.timestamp,
                text: data.note_text
            }));
            close();
        };
        const onError = (data, status) => {
            // Duplicate event timestamp: show error toast for 5 seconds
            if (status === 409) {
                showToast(
                    `Error: note with same timestamp already exists`,
                    'red',
                    5000
                );
            // Other error (unexpected): show in error modal
            } else {
                openErrorModal(JSON.stringify(data));
            }
        };
        await sendPostRequest('/add_plant_note', payload, onSuccess, onError);
    };

    const handleEdit = async () => {
        const payload = {
            plant_id: plantID,
            timestamp: note.timestamp,
            note_text: noteText
        };
        // Update note state with params from response, close modal
        const onSuccess = (data) => {
            dispatch(noteEdited({
                timestamp: data.timestamp,
                text: data.note_text
            }));
            close();
        };
        await sendPostRequest('/edit_plant_note', payload, onSuccess);
    };

    const handleDelete = async () => {
        const payload = {
            plant_id: plantID,
            timestamps: [note.timestamp]
        };
        // Remove note from state, close modal
        const onSuccess = (data) => {
            dispatch(notesDeleted(data.deleted));
            close();
        };
        await sendPostRequest('/delete_plant_notes', payload, onSuccess);
    };

    return (
        <div className="flex flex-col">
            <div className="min-h-36 flex flex-col items-center mt-2">
                {editingNote
                    ? <ExistingNoteTimestamp noteTime={note.timestamp} />
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
    );
};

NoteModal.propTypes = {
    note: PropTypes.exact({
        text: PropTypes.string.isRequired,
        timestamp: isoTimestampTzPropType.isRequired
    }),
    close: PropTypes.func.isRequired,
    setTitle: PropTypes.func.isRequired
};

export default NoteModal;
