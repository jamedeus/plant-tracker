import React, { useState, useRef } from 'react';
import PropTypes from 'prop-types';
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
    // Create refs to preserve collapse open state between re-renders
    const waterHistoryOpen = useRef(false);
    const fertilizeHistoryOpen = useRef(false);
    const pruneHistoryOpen = useRef(false);

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
    const EventsCol = ({ title, events, type, openRef }) => {
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
            <CollapseCol title={title} openRef={openRef} scroll={true}>
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
            </CollapseCol>
        );
    };

    EventsCol.propTypes = {
        title: PropTypes.string,
        events: PropTypes.array,
        type: PropTypes.string,
        openRef: PropTypes.object
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 mx-auto">
            <div className="md:mr-8 mb-8">
                <EventsCol
                    title="Water History"
                    events={events.water}
                    type="water"
                    openRef={waterHistoryOpen}
                />
            </div>

            <div className="mb-8">
                <EventsCol
                    title="Fertilize History"
                    events={events.fertilize}
                    type="fertilize"
                    openRef={fertilizeHistoryOpen}
                />
            </div>

            <div className="md:ml-8 mb-8">
                <EventsCol
                    title="Prune History"
                    events={events.prune}
                    type="prune"
                    openRef={pruneHistoryOpen}
                />
            </div>
        </div>
    );
};

EventHistory.propTypes = {
    plantId: PropTypes.string,
    events: PropTypes.object,
    removeEvent: PropTypes.func
};

export default EventHistory;
