import React, { useState, useRef, useCallback, memo } from 'react';
import PropTypes from 'prop-types';
import clsx from 'clsx';
import { Tab } from '@headlessui/react';
import { DateTime } from 'luxon';
import { sendPostRequest } from 'src/util';
import { timestampToRelativeDays } from 'src/timestampUtils';
import Modal from 'src/components/Modal';
import { openErrorModal } from 'src/components/ErrorModal';

let modalRef;

export const openEventHistoryModal = () => {
    modalRef.current.open();
};

// Displays timestamp and relative time of a single event
// When clicked color changes and timestamp is passed to onSelect callback
const EventCard = memo(function EventCard({ timestamp, selected, onSelect }) {
    const [cardClass, setCardClass] = useState(
        selected ? 'ring-2 ring-error ring-inset' : ''
    );

    const toggle = (event) => {
        if (event.target.checked) {
            setCardClass('ring-2 ring-error ring-inset');
        } else {
            setCardClass('');
        }
        onSelect(timestamp);
    };

    return (
        <label className={clsx(
            'card card-compact max-w-80 mb-4 mx-auto select-none bg-neutral',
            'text-neutral-content',
            cardClass && cardClass
        )}>
            <input
                type="checkbox"
                className="hidden"
                defaultChecked={selected}
                onChange={toggle}
            />
            <div className="card-body text-center">
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

// Takes events state + ref containing array (track selected events)
// Renders column of EventCard instances (appends to selected when clicked)
const EventsCol = ({ events, selectedRef, handleSelect }) => {
    const onSelect = useCallback((timestamp) => {
        handleSelect(timestamp, selectedRef);
    }, [handleSelect, selectedRef]);

    return (
        <div className="flex flex-col mx-auto">
            <div className="max-h-half-screen overflow-y-scroll px-4">
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
        </div>
    );
};

EventsCol.propTypes = {
    events: PropTypes.array.isRequired,
    selectedRef: PropTypes.oneOfType([
        PropTypes.func,
        PropTypes.shape({ current: PropTypes.array }),
    ]).isRequired,
    handleSelect: PropTypes.func.isRequired
};

const EventHistoryModal = ({ plantID, events, removeEvent }) => {
    modalRef = useRef(null);

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
            selectedRef.current = selectedRef.current.filter(item => item !== key);
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

        selectedWaterRef.current.forEach(async timestamp => {
            payload.events.push({type: 'water', timestamp: timestamp});
        });
        selectedFertilizeRef.current.forEach(async timestamp => {
            payload.events.push({type: 'fertilize', timestamp: timestamp});
        });
        selectedPruneRef.current.forEach(async timestamp => {
            payload.events.push({type: 'prune', timestamp: timestamp});
        });
        selectedRepotRef.current.forEach(async timestamp => {
            payload.events.push({type: 'repot', timestamp: timestamp});
        });

        const response = await sendPostRequest('/bulk_delete_plant_events', payload);

        // If successful remove event from history column
        if (response.ok) {
            payload.events.forEach(event => {
                removeEvent(event.timestamp, event.type);
            });

            // Clear all refs, close modal
            selectedWaterRef.current = [];
            selectedFertilizeRef.current = [];
            selectedPruneRef.current = [];
            selectedRepotRef.current = [];
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
                            events={events.water}
                            selectedRef={selectedWaterRef}
                            handleSelect={handleSelect}
                        />
                    </Tab.Panel>
                    <Tab.Panel>
                        <EventsCol
                            events={events.fertilize}
                            selectedRef={selectedFertilizeRef}
                            handleSelect={handleSelect}
                        />
                    </Tab.Panel>
                    <Tab.Panel>
                        <EventsCol
                            events={events.prune}
                            selectedRef={selectedPruneRef}
                            handleSelect={handleSelect}
                        />
                    </Tab.Panel>
                    <Tab.Panel>
                        <EventsCol
                            events={events.repot}
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

EventHistoryModal.propTypes = {
    plantID: PropTypes.string.isRequired,
    events: PropTypes.object.isRequired,
    removeEvent: PropTypes.func.isRequired
};

export default EventHistoryModal;
