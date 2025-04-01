import React, { memo } from 'react';
import { DateTime } from 'luxon';
import Calendar from 'react-calendar';
import 'src/calendar.css';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/16/solid';
import { useSelector } from 'react-redux';

const EventCalendar = memo(function EventCalendar() {
    // Object with date strings as keys, object with events, notes, and photo
    // keys as values
    const timelineDays = useSelector((state) => state.timelineDays);

    // Takes date object, returns div with colored dots for each event on date
    const renderDots = (date) => {
        const dateKey = date.toISOString().split('T')[0];
        const dateEvents = timelineDays[dateKey];
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
                {dateEvents.events.map((eventType, index) => (
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

export default EventCalendar;
