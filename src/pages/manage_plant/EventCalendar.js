import React, { memo, useMemo } from 'react';
import { DateTime } from 'luxon';
import Calendar from 'react-calendar';
import 'src/css/event_calendar.css';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/16/solid';
import { useSelector } from 'react-redux';

const colorMap = {
    water: 'bg-info',
    fertilize: 'bg-success',
    prune: 'bg-prune',
    repot: 'bg-repot'
};

const EventCalendar = memo(function EventCalendar() {
    // Object with date strings as keys, array of event types as value
    const calendarDays = useSelector((state) => state.timeline.calendarDays);

    // Get keys (YYYY-MM-DD strings, used to disable days with no events)
    const calendarDaysKeys = useMemo(() => (
        Object.keys(calendarDays)
    ), [calendarDays]);

    // Takes date object, returns True if events exist on date, otherwise False
    const hasEvents = (date) => {
        return calendarDaysKeys.includes(date.toISOString().split('T')[0]);
    };

    // Takes date object, returns div with colored dots for each event on date
    const renderDots = (date) => {
        const dateKey = date.toISOString().split('T')[0];
        const dateEvents = calendarDays[dateKey];
        // Don't add dots if no events
        if (!dateEvents) {
            return;
        }
        // Return div containing 1 span for each event on day
        return (
            <div className="dots">
                {dateEvents.map(eventType => (
                    <span key={eventType} className="dot">
                        <span className={colorMap[eventType]} />
                    </span>
                ))}
            </div>
        );
    };

    // Called when user clicks calendar day, scrolls timeline day into view
    const handleClickDay = (value) => {
        const t = DateTime.fromISO(value.toISOString()).toFormat('yyyy-MM-dd');
        const timelineRow = document.querySelector(`[data-date="${t}"]`);
        timelineRow?.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    };

    return (
        <Calendar
            calendarType='gregory'
            minDate={new Date('2001-01-01T00:00:00')}
            maxDate={new Date('2100-01-01T00:00:00')}
            prevLabel={<ChevronLeftIcon className="size-6 m-auto" />}
            nextLabel={<ChevronRightIcon className="size-6 m-auto" />}
            prevAriaLabel='Show previous month'
            nextAriaLabel='Show next month'
            tileContent={
                ({ date, view }) => view === 'month' && renderDots(date)
            }
            tileDisabled={
                ({ date, view }) => view === 'month' && !hasEvents(date)
            }
            onClickDay={handleClickDay}
        />
    );
});

export default EventCalendar;
