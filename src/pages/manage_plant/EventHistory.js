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

const EventHistoryModal = ({ plant, removeEvent }) => {
    eventHistoryModalRef = useRef(null);

    // Get hook to show error modal
    const { showErrorModal } = useErrorModal();

    // Create ref to store selected events in each column
    const selectedWaterRef = useRef([]);
    const selectedFertilizeRef = useRef([]);
    const selectedPruneRef = useRef([]);
    const selectedRepotRef = useRef([]);

    // Takes event timestamp and types, sends delete request to backend
    // If successful removes timestamp from react state to re-render history
    const deleteEvent = async (timestamp, type) => {
        const payload = {
            plant_id: plant.uuid,
            event_type: type,
            timestamp: timestamp
        };
        const response = await sendPostRequest('/delete_plant_event', payload);
        // If successful remove event from history column
        if (response.ok) {
            removeEvent(timestamp, type);
        } else {
            const error = await response.json();
            showErrorModal(JSON.stringify(error));
        }
    };

    // Handler for modal delete button, iterates all selected refs and deletes
    // each event (TODO add bulk delete endpoint)
    const deleteAllSelected = async () => {
        selectedWaterRef.current.forEach(async timestamp => {
            await deleteEvent(timestamp, 'water');
        });
        selectedFertilizeRef.current.forEach(async timestamp => {
            await deleteEvent(timestamp, 'fertilize');
        });
        selectedPruneRef.current.forEach(async timestamp => {
            await deleteEvent(timestamp, 'prune');
        });
        selectedRepotRef.current.forEach(async timestamp => {
            await deleteEvent(timestamp, 'repot');
        });
        // Clear all refs, close modal
        selectedWaterRef.current = [];
        selectedFertilizeRef.current = [];
        selectedPruneRef.current = [];
        selectedRepotRef.current = [];
        eventHistoryModalRef.current.close();
    };

    // Displays timestamp and relative time of a single event
    // When clicked color changes and timestamp is passed to onSelect callback
    const EventCard = ({ timestamp, selected, onSelect }) => {
        const [cardClass, setCardClass] = useState(
            selected ? 'bg-primary text-white' : 'bg-neutral text-neutral-content'
        );

        const toggle = (event) => {
            if (event.target.checked) {
                setCardClass('bg-primary text-white');
            } else {
                setCardClass('bg-neutral text-neutral-content');
            }
            onSelect(timestamp);
        };

        return (
            <label className={`card card-compact max-w-80 mb-4 mx-auto select-none ${cardClass}`}>
                <input
                    type="checkbox"
                    className="hidden"
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
                <div className="max-h-half-screen overflow-scroll">
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

                <Tab.Panels className="mt-8">
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
                    className="btn btn-outline btn-error mx-auto"
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
    removeEvent: PropTypes.func
};

export default EventHistoryModal;
