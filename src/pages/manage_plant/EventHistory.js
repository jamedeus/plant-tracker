import React, { useState, useRef } from 'react';
import PropTypes from 'prop-types';
import { Tab } from '@headlessui/react';
import { DateTime } from 'luxon';
import { sendPostRequest, timestampToRelative } from 'src/util';
import CollapseCol from 'src/components/CollapseCol';
import EditableNodeList from 'src/components/EditableNodeList';

// Takes state bool, function to set state bool, delete button handler
// Shows edit button when bool is false, cancel and delete buttons when true
// Rendered at the bottom of water/fertilize event history columns
export const EventHistoryButtons = ({editing, setEditing, handleDelete}) => {
    switch(editing) {
        case(true):
            return (
                <div className="flex mt-4">
                    <button
                        className="btn btn-outline mx-auto"
                        onClick={() => setEditing(false)}
                    >
                        Cancel
                    </button>
                    <button
                        className="btn btn-outline btn-error mx-auto"
                        onClick={() => handleDelete()}
                    >
                        Delete
                    </button>
                </div>
            );
        case(false):
            return (
                <div className="flex mt-4">
                    <button
                        className="btn btn-outline mx-auto"
                        onClick={() => setEditing(true)}
                    >
                        Edit
                    </button>
                </div>
            );
    }
};

EventHistoryButtons.propTypes = {
    editing: PropTypes.bool,
    setEditing: PropTypes.func,
    handleDelete: PropTypes.func,
};

const EventHistory = ({ plantId, events, removeEvent }) => {
    // Create ref to preserve collapse open state between re-renders
    const eventHistoryOpen = useRef(false);

    // Takes event timestamp and types, sends delete request to backend
    // If successful removes timestamp from react state to re-render history
    const deleteEvent = async (timestamp, type) => {
        const payload = {
            plant_id: plantId,
            event_type: type,
            timestamp: timestamp
        };
        const response = await sendPostRequest('/delete_plant_event', payload);
        // If successful remove event from history column
        if (response.ok) {
            removeEvent(timestamp, type);
        }
    };

    // Displays timestamp and relative time in event history sections
    const EventCard = ({ timestamp }) => {
        return (
            <div className="card card-compact bg-neutral text-neutral-content">
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
            </div>
        );
    };

    EventCard.propTypes = {
        timestamp: PropTypes.string
    };

    // Takes events array (eg plant.water_events) and type (water or fertilize)
    // Renders EditableNodeList with edit + delete button and handlers
    const EventsCol = ({ events, type }) => {
        // Create edit mode state + ref to track selected events while editing
        const [editing, setEditing] = useState(false);
        const selected = useRef([]);

        // Delete button handler
        const onDelete = () => {
            selected.current.forEach(async timestamp => {
                await deleteEvent(timestamp, type);
            });
            setEditing(false);
        };

        return (
            <div className="flex flex-col">
                <div className="max-h-half-screen overflow-scroll no-scrollbar">
                    <EditableNodeList
                        editing={editing}
                        selected={selected}
                    >
                        {events.map((timestamp) => {
                            return (
                                <EventCard
                                    key={timestamp}
                                    timestamp={timestamp}
                                />
                            );
                        })}
                    </EditableNodeList>
                </div>
                <EventHistoryButtons
                    editing={editing}
                    setEditing={setEditing}
                    handleDelete={onDelete}
                />
            </div>
        );
    };

    EventsCol.propTypes = {
        events: PropTypes.array,
        type: PropTypes.string
    };

    return (
        <CollapseCol
            title={"Event History"}
            openRef={eventHistoryOpen}
            scroll={true}
            className="mb-8"
        >
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
                </Tab.List>

                <Tab.Panels className="mt-8">
                    <Tab.Panel>
                        <EventsCol
                            events={events.water}
                            type="water"
                        />
                    </Tab.Panel>
                    <Tab.Panel>
                        <EventsCol
                            events={events.fertilize}
                            type="fertilize"
                        />
                    </Tab.Panel>
                    <Tab.Panel>
                        <EventsCol
                            events={events.prune}
                            type="prune"
                        />
                    </Tab.Panel>
                </Tab.Panels>
            </Tab.Group>
        </CollapseCol>
    );
};

EventHistory.propTypes = {
    plantId: PropTypes.string,
    events: PropTypes.object,
    removeEvent: PropTypes.func
};

export default EventHistory;
