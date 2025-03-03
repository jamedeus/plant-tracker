import React, { memo } from 'react';
import PropTypes from 'prop-types';
import { DateTime } from 'luxon';
import Calendar from 'react-calendar';
import 'src/calendar.css';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/16/solid';

const EventCalendar = memo(function EventCalendar({ events }) {
    // Convert to object with date string keys, array of event types as value
    const formattedEvents = Object.entries(events).reduce(
        (acc, [eventType, eventDates]) => {
            eventDates.forEach(date => {
                const dateKey = new Date(date).toDateString();
                // Add new date key unless it already exists
                if (!acc[dateKey]) {
                    acc[dateKey] = [];
                }
                // Add event to date key unless same type already exists
                if (!acc[dateKey].includes(eventType)) {
                    acc[dateKey].push(eventType);
                }
            });
            return acc;
        },
        {}
    );

    // Takes date object, returns div with colored dots for each event on date
    const renderDots = (date) => {
        const dateKey = date.toDateString();
        const dateEvents = formattedEvents[dateKey];
        // If no events return empty div (consistent alignment)
        if (!dateEvents) {
            return (
                <div className="dots">
                </div>
            );
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

    // Called when user clicks calendar day, scrolls timeline day into view
    const handleClickDay = (value) => {
        const t = DateTime.fromISO(value.toISOString()).toFormat('yyyy-MM-dd');
        const timelineRow = document.querySelector(`[data-date="${t}"]`);
        if (timelineRow) {
            timelineRow.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
        }
    };

    return (
        <div className="mx-auto my-8">
            <Calendar
                calendarType='gregory'
                minDate={new Date('2001-01-01T00:00:00')}
                maxDate={new Date('2100-01-01T00:00:00')}
                prevLabel=<ChevronLeftIcon className="w-6 h-6 m-auto" />
                nextLabel=<ChevronRightIcon className="w-6 h-6 m-auto" />
                tileContent={
                    ({ date, view }) => view === 'month' && renderDots(date)
                }
                onClickDay={handleClickDay}
            />
        </div>
    );
});

EventCalendar.propTypes = {
    events: PropTypes.object.isRequired
};

export default EventCalendar;
