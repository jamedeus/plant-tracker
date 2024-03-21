import React from 'react';
import PropTypes from 'prop-types';
import Calendar from 'react-calendar';
import 'src/calendar.css';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/16/solid';

const EventCalendar = ({ events }) => {
    // Convert events into object with date string keys, array of event types as value
    const formattedEvents = Object.entries(events).reduce((acc, [eventType, eventDates]) => {
        eventDates.forEach(date => {
            const dateKey = new Date(date).toDateString();
            if (!acc[dateKey]) {
                acc[dateKey] = [];
            }
            acc[dateKey].push(eventType);
        });
        return acc;
    }, {});

    // Takes date object, returns div with colored dots for each event on date
    const renderDots = (date) => {
        const dateKey = date.toDateString();
        const dateEvents = formattedEvents[dateKey];
        // If no events return empty div (consistent alignment)
        if (!dateEvents) {
            return (
                <div className="dots">
                </div>
            )
        }
        // Return div containing 1 span for each event on day
        return (
            <div className="dots">
                {dateEvents.map((eventType, index) => (
                    <span key={index} className={`dot dot-${eventType}`} />
                ))}
            </div>
        );
    };

    return (
        <Calendar
            calendarType={"gregory"}
            minDate={new Date('2001-01-01T00:00:00')}
            maxDate={new Date('2100-01-01T00:00:00')}
            prevLabel=<ChevronLeftIcon className="w-6 h-6 m-auto" />
            nextLabel=<ChevronRightIcon className="w-6 h-6 m-auto" />
            tileContent={({ date, view }) => view === 'month' ? renderDots(date) : null}
        />
    );
};

EventCalendar.propTypes = {
    events: PropTypes.object
};

export default EventCalendar;
