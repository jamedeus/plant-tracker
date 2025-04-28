import React, { useState, useRef, useCallback, memo } from 'react';
import PropTypes from 'prop-types';
import clsx from 'clsx';
import { Tab } from '@headlessui/react';
import { DateTime } from 'luxon';
import { sendPostRequest } from 'src/util';
import { timestampToRelativeDays } from 'src/timestampUtils';
import Modal from 'src/components/Modal';
import { openErrorModal } from 'src/components/ErrorModal';
import { useSelector, useDispatch } from 'react-redux';
import { eventDeleted } from './timelineSlice';

let modalRef;

export const openEventHistoryModal = () => {
    modalRef.current.open();
};

// Displays timestamp and relative time of a single event
// When clicked color changes and timestamp is passed to onSelect callback
const EventCard = memo(function EventCard({ timestamp, selected, onSelect }) {
    return (
        <label className={clsx(
            'card card-compact w-full max-w-80 select-none bg-neutral',
            'text-neutral-content'
        )}>
            <input
                type="checkbox"
                className="hidden peer"
                defaultChecked={selected}
                onChange={() => onSelect(timestamp)}
            />
            <div className={clsx(
                "card-body text-center rounded-2xl transition-all",
                "duration-[200ms] peer-checked:ring-2 ring-error ring-inset"
            )}>
                <p className="text-lg font-bold">
                    {timestampToRelativeDays(timestamp)}
                </p>
                <p>
                    {DateTime.fromISO(
                        timestamp
                    ).toFormat("h:mm\u202Fa MMMM dd, yyyy")}
                </p>
            </div>
        </label>
    );
});

EventCard.propTypes = {
    timestamp: PropTypes.string.isRequired,
    selected: PropTypes.bool.isRequired,
    onSelect: PropTypes.func.isRequired
};

// Takes event type, ref containing array, and handleSelect callback
// Renders column of EventCard instances (appends to selected when clicked)
const EventsCol = ({ type, selectedRef, handleSelect }) => {
    const events = useSelector((state) => state.timeline.eventsByType[type]);

    const onSelect = useCallback((timestamp) => {
        handleSelect(timestamp, selectedRef);
    }, [handleSelect, selectedRef]);

    return (
        <div className={
            "flex flex-col items-center gap-4 h-[50vh] overflow-y-scroll px-4"
        }>
            {events.length > 0 ? (
                events.map((timestamp) => (
                    <EventCard
                        key={timestamp}
                        timestamp={timestamp}
                        selected={selectedRef.current.includes(timestamp)}
                        onSelect={onSelect}
                    />
                ))
            ) : (
                <p className="my-8">No events</p>
            )}
        </div>
    );
};

EventsCol.propTypes = {
    type: PropTypes.oneOf([
        'water',
        'fertilize',
        'prune',
        'repot'
    ]).isRequired,
    selectedRef: PropTypes.oneOfType([
        PropTypes.func,
        PropTypes.shape({ current: PropTypes.array }),
    ]).isRequired,
    handleSelect: PropTypes.func.isRequired
};

const EventHistoryModal = () => {
    modalRef = useRef(null);

    const plantID = useSelector((state) => state.plant.plantDetails.uuid);
    const dispatch = useDispatch();

    // Create ref to store selected events in each column
    const selectedWaterRef = useRef([]);
    const selectedFertilizeRef = useRef([]);
    const selectedPruneRef = useRef([]);
    const selectedRepotRef = useRef([]);

    // Controls delete button enable state (disabled until >0 events selected)
    const [deleteDisabled, setDeleteDisabled] = useState(true);

    // Enable delete button if at least 1 event selected, disable if 0 selected
    const updateDeleteDisabled = useCallback(() => {
        if (
            selectedWaterRef.current.length > 0
            || selectedFertilizeRef.current.length > 0
            || selectedPruneRef.current.length > 0
            || selectedRepotRef.current.length > 0
        ) {
            setDeleteDisabled(false);
        } else {
            setDeleteDisabled(true);
        }
    }, [
        selectedWaterRef,
        selectedFertilizeRef,
        selectedPruneRef,
        selectedRepotRef
    ]);

    const handleSelect = useCallback((key, selectedRef) => {
        if (selectedRef.current.includes(key)) {
            selectedRef.current = selectedRef.current.filter(
                item => item !== key
            );
        } else {
            selectedRef.current.push(key);
        }
        updateDeleteDisabled();
    }, [updateDeleteDisabled]);

    // Handler for modal delete button, posts all selected event types and
    // timestamps to backend, removes events from state if successfully deleted
    const deleteAllSelected = async () => {
        const payload = {
            plant_id: plantID,
            events: []
        };

        selectedWaterRef.current.forEach(timestamp => {
            payload.events.push({type: 'water', timestamp: timestamp});
        });
        selectedFertilizeRef.current.forEach(timestamp => {
            payload.events.push({type: 'fertilize', timestamp: timestamp});
        });
        selectedPruneRef.current.forEach(timestamp => {
            payload.events.push({type: 'prune', timestamp: timestamp});
        });
        selectedRepotRef.current.forEach(timestamp => {
            payload.events.push({type: 'repot', timestamp: timestamp});
        });

        const response = await sendPostRequest('/bulk_delete_plant_events',
            payload
        );

        // If successful remove event from history column
        if (response.ok) {
            payload.events.forEach(event => {
                dispatch(eventDeleted({
                    timestamp: event.timestamp,
                    type: event.type
                }));
            });

            // Clear all refs, disable delete button, close modal
            selectedWaterRef.current = [];
            selectedFertilizeRef.current = [];
            selectedPruneRef.current = [];
            selectedRepotRef.current = [];
            setDeleteDisabled(true);
            modalRef.current.close();
        } else {
            const error = await response.json();
            openErrorModal(JSON.stringify(error));
        }
    };

    return (
        <Modal title='Event History' ref={modalRef}>
            <Tab.Group>
                <Tab.List className="tab-group mt-2">
                    <Tab className={({ selected }) => clsx(
                        'tab-option',
                        selected && 'tab-option-selected'
                    )}>
                        Water
                    </Tab>
                    <Tab className={({ selected }) => clsx(
                        'tab-option',
                        selected && 'tab-option-selected'
                    )}>
                        Fertilize
                    </Tab>
                    <Tab className={({ selected }) => clsx(
                        'tab-option',
                        selected && 'tab-option-selected'
                    )}>
                        Prune
                    </Tab>
                    <Tab className={({ selected }) => clsx(
                        'tab-option',
                        selected && 'tab-option-selected'
                    )}>
                        Repot
                    </Tab>
                </Tab.List>

                <Tab.Panels className="mt-8 mb-4">
                    <Tab.Panel>
                        <EventsCol
                            type={'water'}
                            selectedRef={selectedWaterRef}
                            handleSelect={handleSelect}
                        />
                    </Tab.Panel>
                    <Tab.Panel>
                        <EventsCol
                            type={'fertilize'}
                            selectedRef={selectedFertilizeRef}
                            handleSelect={handleSelect}
                        />
                    </Tab.Panel>
                    <Tab.Panel>
                        <EventsCol
                            type={'prune'}
                            selectedRef={selectedPruneRef}
                            handleSelect={handleSelect}
                        />
                    </Tab.Panel>
                    <Tab.Panel>
                        <EventsCol
                            type={'repot'}
                            selectedRef={selectedRepotRef}
                            handleSelect={handleSelect}
                        />
                    </Tab.Panel>
                </Tab.Panels>
            </Tab.Group>
            <div className="flex mt-4">
                <button
                    className="btn btn-error mx-auto"
                    onClick={deleteAllSelected}
                    disabled={deleteDisabled}
                >
                    Delete
                </button>
            </div>
        </Modal>
    );
};

export default EventHistoryModal;
