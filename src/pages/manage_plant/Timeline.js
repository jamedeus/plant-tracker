import React, { useRef, useState, useLayoutEffect, memo } from 'react';
import PropTypes from 'prop-types';
import clsx from 'clsx';
import { DateTime } from 'luxon';
import { Popover } from "react-tiny-popover";
import { capitalize, pastTense } from 'src/util';
import { timestampToReadable, timestampToRelativeDays } from 'src/timestampUtils';
import { openNoteModal } from './NoteModal';
import { openRepotModal } from './RepotModal';
import { openPhotoModal } from './PhotoModal';
import { openDeletePhotosModal, preloadDeletePhotosModal } from './DeletePhotosModal';
import { openEventHistoryModal } from './EventHistoryModal';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEllipsis, faPenToSquare} from '@fortawesome/free-solid-svg-icons';
import WaterIcon from 'src/components/WaterIcon';
import FertilizeIcon from 'src/components/FertilizeIcon';
import PruneIcon from 'src/components/PruneIcon';
import RepotIcon from 'src/components/RepotIcon';
import { useSelector } from 'react-redux';
import 'src/timeline.css';

// Takes ISO timestamp string, returns "x days ago"
const getRelativeTimeString = (timestamp) => {
    const relative = timestampToRelativeDays(timestamp);

    // Remove " ago" if > 1000 days old (breaks flex layout)
    const days = relative.split(' ')[0];
    if (days.length > 3) {
        return relative.replace(' ago', '');
    } else {
        return relative;
    }
};

// History title with dropdown menu to jump to a specific month in timeline
const Title = memo(function Title() {
    const archived = useSelector((state) => state.plant.plantDetails.archived);

    return (
        <div className="navbar bg-base-200 rounded-2xl px-4">
            <div className="navbar-start w-12">
                {/* Spacer with same width as .navbar-end button */}
            </div>
            <div className="navbar-center mx-auto">
                <div className="dropdown dropdown-center dropdown-hover">
                    <div
                        tabIndex={0}
                        role="button"
                        className="btn btn-ghost text-xl font-bold m-1"
                    >
                        History
                    </div>
                    <ul tabIndex={0} className="dropdown-options w-44">
                        <QuickNavigation />
                    </ul>
                </div>
            </div>

            <div
                className="justify-end w-12 dropdown dropdown-end"
                onFocus={preloadDeletePhotosModal}
            >
                {!archived &&
                    <>
                        <div
                            tabIndex={0}
                            role="button"
                            className="btn btn-ghost btn-circle"
                        >
                            <FontAwesomeIcon
                                icon={faEllipsis}
                                className="size-6"
                            />
                        </div>
                        <ul tabIndex={0} className="dropdown-options w-40">
                            <li><button
                                className="flex justify-end"
                                onClick={() => openNoteModal()}
                            >
                                Add note
                            </button></li>
                            <li><button
                                className="flex justify-end"
                                onClick={openPhotoModal}
                            >
                                Add photos
                            </button></li>
                            <li><button
                                className="flex justify-end"
                                onClick={openRepotModal}
                            >
                                Repot plant
                            </button></li>
                            <li><button
                                className="flex justify-end"
                                onClick={openDeletePhotosModal}
                            >
                                Delete photos
                            </button></li>
                            <li><button
                                className="flex justify-end"
                                onClick={openEventHistoryModal}
                            >
                                Delete events
                            </button></li>
                        </ul>
                    </>
                }
            </div>
        </div>
    );
});

// Dropdown menu with expandable section for each year in timeline containing
// month links that scroll to the correct timeline section when clicked
const QuickNavigation = () => {
    const navigationOptions = useSelector(
        (state) => state.timeline.navigationOptions
    );

    return (
        <>
            {Object.keys(navigationOptions).reverse().map(year => (
                <QuickNavigationYear
                    key={year}
                    year={year}
                    months={navigationOptions[year]}
                />
            ))}
        </>
    );
};

// Takes year (YYYY string) and array of months (MM strings, not names or ints)
// Renders dropdown item with year which expands to show sub-menu of month
// links that scroll to the correct timeline section when clicked
const QuickNavigationYear = ({ year, months }) => {
    // Create ref used to open sub-menu on hover
    const detailsRef = useRef(null);

    const open = () => {
        detailsRef.current.open = true;
    };

    const close = () => {
        detailsRef.current.open = false;
    };

    // Takes year-month string (ie 2024-03), scrolls to timeline section
    const jumpTo = (yearMonth) => {
        const timelineRow = document.querySelector(
            `[data-timeline-divider="${yearMonth}"]`
        );
        timelineRow.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
        // Close dropdown after click
        document.activeElement.blur();
    };

    // Converts month number to name string (ie 04 -> April)
    const monthNumToName = (month) => {
        return DateTime.fromFormat(month, 'MM').toFormat('MMMM');
    };

    return (
        <li>
            <details
                ref={detailsRef}
                onMouseOver={open}
                onFocus={open}
                onMouseOut={close}
                className="outline-none"
            >
                <summary>{year}</summary>
                <ul>
                    {months.map(month => (
                        <li key={month}>
                            <button onClick={() => jumpTo(`${year}-${month}`)}>
                                {monthNumToName(month)}
                            </button>
                        </li>
                    ))}
                </ul>
            </details>
        </li>
    );
};

QuickNavigationYear.propTypes = {
    year: PropTypes.string.isRequired,
    months: PropTypes.arrayOf(PropTypes.string).isRequired
};

// Takes YYYY-MM-DD string, renders relative timestamp div (left column).
// Has dataset attribute used to scroll page when EventCalendar day clicked.
const TimelineTimestamp = memo(function TimelineTimestamp({ dateKey }) {
    const dateString = DateTime.fromISO(dateKey).toFormat('MMM dd, yyyy');
    return (
        <div className="timeline-timestamp" data-date={dateKey}>
            <div
                className="tooltip !text-end"
                data-tip={dateString}
            >
                <span className="text-sm md:text-lg">
                    {getRelativeTimeString(dateKey)}
                </span>
            </div>
            <span className="hidden md:block text-sm">
                {dateString}
            </span>
        </div>
    );
});

TimelineTimestamp.propTypes = {
    dateKey: PropTypes.string.isRequired
};

// Takes YYYY-MM-DD string, renders horizontal divider with month name that
// spans both timeline columns. Has dataset attribute used to scroll page when
// QuickNavigation month is clicked.
const MonthDivider = memo(function MonthDivider({ dateKey }) {
    const yearMonth = dateKey.slice(0, 7);
    return (
        <div className="month-divider" data-timeline-divider={yearMonth}>
            {DateTime.fromFormat(yearMonth, 'yyyy-MM').toFormat('MMMM yyyy')}
        </div>
    );
});

MonthDivider.propTypes = {
    dateKey: PropTypes.string.isRequired
};

// Map event type strings to icon components
const eventIconMap = {
    'water': <WaterIcon />,
    'fertilize': <FertilizeIcon />,
    'prune': <PruneIcon />,
    'repot': <RepotIcon />,
};

// Takes event type string, renders timeline marker with icon and text
const EventMarker = memo(function EventMarker({ eventType }) {
    return (
        <span className="event-marker">
            {eventIconMap[eventType]}
            {pastTense(capitalize(eventType))}
        </span>
    );
});

EventMarker.propTypes = {
    eventType: PropTypes.oneOf(Object.keys(eventIconMap)).isRequired
};

// Takes photo thumbnail URL, full-resolution URL, and creation timestamp
// Renders thumbnail that opens larger popover when clicked
const PhotoThumbnail = memo(function PhotoThumbnail({ thumbnailUrl, photoUrl, timestamp }) {
    const [popoverOpen, setPopoverOpen] = useState(false);

    return (
        <Popover
            isOpen={popoverOpen}
            positions={["top", "bottom", "left", "right"]}
            align="center"
            padding={8}
            reposition={true}
            onClickOutside={() => setPopoverOpen(false)}
            content={
                <div className="popover-content popover-enter">
                    <a href={photoUrl}>
                        <img
                            loading="lazy"
                            className="popover-image"
                            src={thumbnailUrl}
                        />
                    </a>
                </div>
            }
        >
            <div
                onClick={() => setPopoverOpen(!popoverOpen)}
                title={timestampToReadable(timestamp)}
            >
                <img
                    loading="lazy"
                    className='photo-thumbnail photo-thumbnail-timeline'
                    src={thumbnailUrl}
                />
            </div>
        </Popover>
    );
});

PhotoThumbnail.propTypes = {
    thumbnailUrl: PropTypes.string.isRequired,
    photoUrl: PropTypes.string.isRequired,
    timestamp: PropTypes.string.isRequired
};

// Takes note object (timestamp and text keys), renders element with first line
// of text always visible which expands to show full text when clicked
const NoteCollapse = memo(function NoteCollapse({ note }) {
    const [expanded, setExpanded] = useState(false);
    const [height, setHeight] = useState('24px');
    const [clamped, setClamped] = useState(true);

    const archived = useSelector((state) => state.plant.plantDetails.archived);

    // Used to measure height of expanded note text
    const textRef = useRef(null);

    const readableTimestamp = timestampToReadable(note.timestamp);

    useLayoutEffect(() => {
        /* istanbul ignore else */
        if (textRef.current) {
            if (expanded) {
                // Transition height from 1 line to full expanded text height
                setHeight(textRef.current.scrollHeight + "px");
                // Remove line clamp immediately so expand animation can run
                setClamped(false);
            } else {
                // Transition height down to 1 line (collapse)
                setHeight(getComputedStyle(textRef.current).lineHeight);
                // Wait until collapse animation completes before line clamping
                const timer = setTimeout(() => setClamped(true), 300);
                return () => clearTimeout(timer);
            }
        }
    }, [expanded]);

    return (
        <div
            className='note-collapse'
            style={{ height: height }}
        >
            <FontAwesomeIcon
                icon={faPenToSquare}
                className={clsx(
                    'size-4 mr-2 mt-1',
                    !archived && 'cursor-pointer'
                )}
                onClick={archived ? null : () => openNoteModal(note)}
            />
            <div
                className={clsx(
                    'cursor-pointer overflow-hidden',
                    clamped && 'line-clamp-1'
                )}
                title={readableTimestamp}
                ref={textRef}
                onClick={() => setExpanded(!expanded)}
            >
                <span className="note-collapse-text">
                    {note.text}
                </span>
                <span className='text-xs'>
                    {readableTimestamp.split('-')[0].trim()}
                </span>
            </div>
        </div>
    );
});

NoteCollapse.propTypes = {
    note: PropTypes.shape({
        text: PropTypes.string.isRequired,
        timestamp: PropTypes.string.isRequired
    }).isRequired
};

// Takes YYYY-MM-DD dateKey matching a key in timelineSlice.timelineDays state.
// Renders single row of timeline with timestamp in left column and div with
// all events, photos, and notes from that day in right column.
// If optional monthDivider bool is passed a MonthDivider will be rendered
// above the row (passed for first day of each month).
const TimelineDay = memo(function TimelineDay({ dateKey, monthDivider }) {
    const contents = useSelector(
        (state) => state.timeline.timelineDays[dateKey]
    );

    return (
        <>
            {/* Render MonthDivider if monthDivider param was given */}
            {monthDivider && <MonthDivider dateKey={dateKey} />}
            <TimelineTimestamp dateKey={dateKey} />
            <div className="timeline-day">
                {/* mobile: 2x2 grid layout, desktop: 4 events on one row */}
                <div
                    className="timeline-day-events"
                    data-testid={`${dateKey}-events`}
                >
                    {contents.events.map((e) => (
                        <EventMarker key={e} eventType={e} />
                    ))}
                </div>
                <div
                    className="flex flex-row flex-wrap"
                    data-testid={`${dateKey}-photos`}
                >
                    {[...contents.photos].sort((a, b) => {
                        return a.timestamp.localeCompare(b.timestamp);
                    }).reverse().map((photo) => (
                        <PhotoThumbnail
                            key={photo.key}
                            thumbnailUrl={photo.thumbnail}
                            photoUrl={photo.image}
                            timestamp={photo.timestamp}
                        />
                    ))}
                </div>
                <div
                    className="flex flex-col"
                    data-testid={`${dateKey}-notes`}
                >
                    {[...contents.notes].sort((a, b) => {
                        return a.timestamp.localeCompare(b.timestamp);
                    }).map((note) => (
                        <NoteCollapse
                            key={note.timestamp}
                            note={note}
                        />
                    ))}
                </div>
            </div>
        </>
    );
});

TimelineDay.propTypes = {
    dateKey: PropTypes.string.isRequired,
    monthDivider: PropTypes.bool
};

const Timeline = memo(function Timeline() {
    const timelineDays = useSelector((state) => state.timeline.timelineDays);

    // Get array of yyyy-mm-dd keys sorted chronologically (recent first)
    const dayKeys = Object.keys(timelineDays).sort().reverse();

    return (
        <div className='flex flex-col w-full bg-base-200 rounded-2xl'>
            <Title />
            {dayKeys.length > 0 ? (
                <div className='timeline-layout'>
                    {dayKeys.map((dateKey, index) => {
                        // Slice YYYY-MM from dateKey, truncate day
                        const yearMonth = dateKey.slice(0, 7);

                        // Render month divider above day unless yearMonth of
                        // the previous day is identical
                        let monthDivider = true;
                        if (index > 0) {
                            const prevDateKey = dayKeys[index - 1];
                            const prevYearMonth = prevDateKey.slice(0, 7);
                            monthDivider = yearMonth !== prevYearMonth;
                        }

                        return (
                            <TimelineDay
                                key={dateKey}
                                dateKey={dateKey}
                                monthDivider={monthDivider}
                            />
                        );
                    })}
                </div>
            ) : (
                <p className='timeline-empty'>
                    Events created with the buttons above will appear here
                </p>
            )}
        </div>
    );
});

export default Timeline;
