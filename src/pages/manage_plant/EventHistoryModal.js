import React, { useState, useRef } from 'react';
import PropTypes from 'prop-types';
import { Tab } from '@headlessui/react';
import { DateTime } from 'luxon';
import { sendPostRequest, timestampToRelative } from 'src/util';
import Modal from 'src/components/Modal';
import { useErrorModal } from 'src/context/ErrorModalContext';

let eventHistoryModalRef;

export const openEventHistoryModal = () => {
    eventHistoryModalRef.current.showModal();
};

const EventHistoryModal = ({ plant, setPlant }) => {
    eventHistoryModalRef = useRef(null);

    // Get hook to show error modal
    const { showErrorModal } = useErrorModal();

    // Create ref to store selected events in each column
    const selectedWaterRef = useRef([]);
    const selectedFertilizeRef = useRef([]);
    const selectedPruneRef = useRef([]);
    const selectedRepotRef = useRef([]);

    // Takes timestamp and eventType, removes timestamp from plant.events state
    const removeEvent = (timestamp, eventType) => {
        let oldPlant = {...plant};
        oldPlant.events[eventType].splice(
            oldPlant.events[eventType].indexOf(timestamp),
            1
        );
        setPlant(oldPlant);
    };

    // Handler for modal delete button, posts all selected event types and
    // timestamps to backend, removes events from state if successfully deleted
    const deleteAllSelected = async () => {
        const payload = {
            plant_id: plant.uuid,
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
            eventHistoryModalRef.current.close();
        } else {
            const error = await response.json();
            showErrorModal(JSON.stringify(error));
        }
    };

    // Displays timestamp and relative time of a single event
    // When clicked color changes and timestamp is passed to onSelect callback
    const EventCard = ({ timestamp, selected, onSelect }) => {
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
            <label className={`card card-compact max-w-80 mb-4 mx-auto
                select-none bg-neutral text-neutral-content ${cardClass}`}
            >
                <input
                    type="checkbox"
                    className="hidden"
                    defaultChecked={selected}
                    onChange={toggle}
                />
                <div className="card-body text-center">
                    <p className="text-lg font-bold">
                        {timestampToRelative(timestamp)}
                    </p>
                    <p>
                        {DateTime.fromISO(
                            timestamp
                        ).toFormat("h:mm\u202Fa MMMM dd, yyyy")}
                    </p>
                </div>
            </label>
        );
    };

    EventCard.propTypes = {
        timestamp: PropTypes.string,
        selected: PropTypes.bool,
        onSelect: PropTypes.func
    };

    // Takes plant.events subkey + ref containing array (track selected events)
    // Renders column of EventCard instances (appends to selected when clicked)
    const EventsCol = ({ events, selectedRef }) => {
        const selectEvent = (key) => {
            if (selectedRef.current.includes(key)) {
                selectedRef.current = selectedRef.current.filter(item => item !== key);
            } else {
                selectedRef.current.push(key);
            }
        };

        return (
            <div className="flex flex-col mx-auto">
                <div className="max-h-half-screen overflow-scroll px-4">
                    {events.map((timestamp) => {
                        return (
                            <EventCard
                                key={timestamp}
                                timestamp={timestamp}
                                selected={selectedRef.current.includes(timestamp)}
                                onSelect={selectEvent}
                            />
                        );
                    })}
                </div>
            </div>
        );
    };

    EventsCol.propTypes = {
        events: PropTypes.array,
        selectedRef: PropTypes.oneOfType([
            PropTypes.func,
            PropTypes.shape({ current: PropTypes.array }),
        ])
    };

    return (
        <Modal dialogRef={eventHistoryModalRef}>
            <p className="text-lg mb-6">Event History</p>
            <Tab.Group>
                <Tab.List className="tab-group">
                    <Tab className={({ selected }) => `tab-option ${
                        selected ? 'tab-option-selected' : ''}`
                    }>
                        Water
                    </Tab>
                    <Tab className={({ selected }) => `tab-option ${
                        selected ? 'tab-option-selected' : ''}`
                    }>
                        Fertilize
                    </Tab>
                    <Tab className={({ selected }) => `tab-option ${
                        selected ? 'tab-option-selected' : ''}`
                    }>
                        Prune
                    </Tab>
                    <Tab className={({ selected }) => `tab-option ${
                        selected ? 'tab-option-selected' : ''}`
                    }>
                        Repot
                    </Tab>
                </Tab.List>

                <Tab.Panels className="mt-8 mb-4">
                    <Tab.Panel>
                        <EventsCol
                            events={plant.events.water}
                            selectedRef={selectedWaterRef}
                        />
                    </Tab.Panel>
                    <Tab.Panel>
                        <EventsCol
                            events={plant.events.fertilize}
                            selectedRef={selectedFertilizeRef}
                        />
                    </Tab.Panel>
                    <Tab.Panel>
                        <EventsCol
                            events={plant.events.prune}
                            selectedRef={selectedPruneRef}
                        />
                    </Tab.Panel>
                    <Tab.Panel>
                        <EventsCol
                            events={plant.events.repot}
                            selectedRef={selectedRepotRef}
                        />
                    </Tab.Panel>
                </Tab.Panels>
            </Tab.Group>
            <div className="flex mt-4">
                <button
                    className="btn btn-error text-white mx-auto"
                    onClick={deleteAllSelected}
                >
                    Delete
                </button>
            </div>
        </Modal>
    );
};

EventHistoryModal.propTypes = {
    plant: PropTypes.object,
    setPlant: PropTypes.func
};

export default EventHistoryModal;
