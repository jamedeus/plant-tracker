import React, { useRef, useState, useEffect, useLayoutEffect, Fragment, memo } from 'react';
import PropTypes from 'prop-types';
import clsx from 'clsx';
import { DateTime } from 'luxon';
import { Popover } from "react-tiny-popover";
import { parseDomContext, capitalize, pastTense } from 'src/util';
import {
    timestampToReadable,
    timestampToRelativeDays,
    timestampToUserTimezone
} from 'src/timestampUtils';
import NoteModal, { openNoteModal } from './NoteModal';
import DefaultPhotoModal from './DefaultPhotoModal';
import { openRepotModal } from './RepotModal';
import PhotoModal, { openPhotoModal } from './PhotoModal';
import DeletePhotosModal, { openDeletePhotosModal, preloadDeletePhotosModal } from './DeletePhotosModal';
import { openEventHistoryModal } from './EventHistoryModal';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEllipsis, faPenToSquare} from '@fortawesome/free-solid-svg-icons';
import WaterIcon from 'src/components/WaterIcon';
import FertilizeIcon from 'src/components/FertilizeIcon';
import PruneIcon from 'src/components/PruneIcon';
import RepotIcon from 'src/components/RepotIcon';


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

const TimelineDate = memo(function TimelineDate({ timestamp }) {
    return (
        <div className="flex flex-col h-full whitespace-nowrap text-end md:ml-4">
            <span className="text-sm md:text-lg my-auto md:mt-auto md:mb-0">
                {getRelativeTimeString(timestamp)}
            </span>
            <span className="hidden md:block text-sm mb-auto">
                {DateTime.fromISO(timestamp).toFormat('MMM dd, yyyy')}
            </span>
        </div>
    );
});

TimelineDate.propTypes = {
    timestamp: PropTypes.string.isRequired
};

const eventIconMap = {
    'water': <WaterIcon />,
    'fertilize': <FertilizeIcon />,
    'prune': <PruneIcon />,
    'repot': <RepotIcon />,
};

const EventMarker = memo(function EventMarker({ eventType }) {
    return (
        <span className="m-2 whitespace-nowrap text-sm md:text-base">
            {eventIconMap[eventType]}
            {pastTense(capitalize(eventType))}
        </span>
    );
});

EventMarker.propTypes = {
    eventType: PropTypes.string.isRequired
};

const TimelineContent = memo(function TimelineContent({ events, notes, photos, archived }) {
    return (
        <div className="flex flex-col bg-neutral rounded-xl p-2 md:p-4">
            <div className="flex flex-row flex-wrap">
                {events.map((e) => (
                    <EventMarker key={e} eventType={e} />
                ))}
            </div>
            <div className="flex flex-row flex-wrap">
                {photos.map((photo) => (
                    <PhotoThumbnail
                        key={photo.key}
                        thumbnailUrl={photo.thumbnail}
                        photoUrl={photo.image}
                        timestamp={photo.created}
                    />
                ))}
            </div>
            <div className="flex flex-col">
                {notes.map((note) => (
                    <NoteCollapse
                        key={note.timestamp}
                        note={note}
                        archived={archived}
                    />
                ))}
            </div>
        </div>
    );
});

TimelineContent.propTypes = {
    events: PropTypes.array.isRequired,
    notes: PropTypes.array.isRequired,
    photos: PropTypes.array.isRequired,
    archived: PropTypes.bool.isRequired
};

// Photo thumbnail that opens larger popover when clicked
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
                            className="rounded-lg popover-image mx-4"
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
                    className={clsx(
                        'rounded-lg m-2 object-cover w-[4.9rem] h-[4.9rem]',
                        'md:w-[5.4rem] md:h-[5.4rem]'
                    )}
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

const NoteCollapse = memo(function NoteCollapse({ note, archived }) {
    const [expanded, setExpanded] = useState(false);
    const [height, setHeight] = useState('24px');
    const [clamped, setClamped] = useState(true);

    // Used to measure height of expanded note text
    const textRef = useRef(null);

    const readableTimestamp = timestampToReadable(note.timestamp);

    useLayoutEffect(() => {
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
            className='m-2 flex flex-row transition-[height] duration-300 ease-in-out'
            style={{ height: height }}
        >
            <FontAwesomeIcon
                icon={faPenToSquare}
                className={clsx(
                    'w-4 h-4 mr-2 mt-1',
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
                <span className="text-sm md:text-base mr-2 after:content-['\200B']">
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
    }).isRequired,
    archived: PropTypes.bool.isRequired
};

// Takes year-month string (ie 2024-03)
const MonthDivider = memo(function MonthDivider({ yearMonth, sectionRefs }) {
    return (
        <div
            className="divider col-span-2 mt-4 mb-0 font-bold md:text-lg scroll-mt-20"
            ref={el => sectionRefs.current[yearMonth] = el}
        >
            {DateTime.fromFormat(yearMonth, 'yyyy-MM').toFormat('MMMM yyyy')}
        </div>
    );
});

MonthDivider.propTypes = {
    yearMonth: PropTypes.string.isRequired,
    sectionRefs: PropTypes.oneOfType([
        PropTypes.func,
        PropTypes.shape({ current: PropTypes.instanceOf(Object) }),
    ]).isRequired
};

// Takes year-month string (ie 2024-03) and object with yyyy-mm-dd keys keys
// containing object for each day with events, notes, and photos keys. Returns
// divider with year and month text followed by pairs of divs for each day
// (populates grid).
const MonthSection = memo(function MonthSection({ yearMonth, days, sectionRefs, archived }) {
    return (
        <>
            <MonthDivider yearMonth={yearMonth} sectionRefs={sectionRefs} />
            {Object.entries(days).map(([timestamp, contents]) => (
                <Fragment key={timestamp}>
                    <div
                        className="scroll-mt-20"
                        data-date={timestamp}
                    >
                        <TimelineDate timestamp={timestamp} />
                    </div>
                    <div>
                        <TimelineContent
                            events={contents.events}
                            notes={contents.notes}
                            photos={contents.photos}
                            archived={archived}
                        />
                    </div>
                </Fragment>
            ))}
        </>
    );
});

MonthSection.propTypes = {
    yearMonth: PropTypes.string.isRequired,
    days: PropTypes.object.isRequired,
    sectionRefs: PropTypes.oneOfType([
        PropTypes.func,
        PropTypes.shape({ current: PropTypes.instanceOf(Object) }),
    ]).isRequired,
    archived: PropTypes.bool.isRequired
};

// History title with dropdown menu (hover) to jump to month/year sections
const Title = ({ archived, quickNavigation }) => {
    return (
        <div className="navbar bg-base-200 rounded-2xl">
            <div className="navbar-start w-12">
                {/* Spacer with same width as .navbar-end button */}
            </div>
            <div className="navbar-center mx-auto">
                <div className="dropdown dropdown-center dropdown-hover mx-auto">
                    <div
                        tabIndex={0}
                        role="button"
                        className="btn btn-ghost text-xl font-bold m-1"
                    >
                        History
                    </div>
                    <ul tabIndex={0} className="dropdown-options w-44">
                        {quickNavigation}
                    </ul>
                </div>
            </div>

            <div
                className="navbar-end w-12 dropdown dropdown-end"
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
                                className="w-6 h-6"
                            />
                        </div>
                        <ul tabIndex={0} className="dropdown-options w-40">
                            <li><a
                                className="flex justify-end"
                                onClick={() => openNoteModal()}
                            >
                                Add note
                            </a></li>
                            <li><a
                                className="flex justify-end"
                                onClick={openPhotoModal}
                            >
                                Add photos
                            </a></li>
                            <li><a
                                className="flex justify-end"
                                onClick={openRepotModal}
                            >
                                Repot plant
                            </a></li>
                            <li><a
                                className="flex justify-end"
                                onClick={openDeletePhotosModal}
                            >
                                Delete photos
                            </a></li>
                            <li><a
                                className="flex justify-end"
                                onClick={openEventHistoryModal}
                            >
                                Delete events
                            </a></li>
                        </ul>
                    </>
                }
            </div>
        </div>
    );
};

Title.propTypes = {
    archived: PropTypes.bool.isRequired,
    quickNavigation: PropTypes.element.isRequired
};

const QuickNavigation = ({ navigationOptions, sectionRefs }) => {
    return (
        <>
            {Object.keys(navigationOptions).reverse().map(year => (
                <QuickNavigationYear
                    key={year}
                    year={year}
                    months={navigationOptions[year]}
                    sectionRefs={sectionRefs}
                />
            ))}
        </>
    );
};

QuickNavigation.propTypes = {
    navigationOptions: PropTypes.object.isRequired,
    sectionRefs: PropTypes.oneOfType([
        PropTypes.func,
        PropTypes.shape({ current: PropTypes.instanceOf(Object) }),
    ]).isRequired
};

// Takes year (string) and array of months (numbers not string) with events
// Returns dropdown item with year which expands on hover to show sub-menu
// of clickable months that jump to the matching timeline section
const QuickNavigationYear = ({ year, months, sectionRefs }) => {
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
        sectionRefs.current[yearMonth].scrollIntoView({
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
                onMouseOut={close}
            >
                <summary>{year}</summary>
                <ul>
                    {months.map(month => (
                        <li key={month}>
                            <a onClick={() => jumpTo(`${year}-${month}`)}>
                                {monthNumToName(month)}
                            </a>
                        </li>
                    ))}
                </ul>
            </details>
        </li>
    );
};

QuickNavigationYear.propTypes = {
    year: PropTypes.string.isRequired,
    months: PropTypes.array.isRequired,
    sectionRefs: PropTypes.oneOfType([
        PropTypes.func,
        PropTypes.shape({ current: PropTypes.instanceOf(Object) }),
    ]).isRequired
};

const Timeline = memo(function Timeline({ plantID, formattedEvents, archived }) {
    // Load context set by django template
    const [notes, setNotes] = useState(() => {
        return parseDomContext("notes");
    });
    const [photoUrls, setPhotoUrls] = useState(() => {
        return parseDomContext("photo_urls");
    });

    // Takes timestamp, returns ISO date string (no hours/minutes) in user's timezone
    const timestampToDateString = (timestamp) => {
        return timestampToUserTimezone(timestamp).toISO().split('T')[0];
    };

    // Merges items from notes and photoUrls states into formattedEvents param,
    // then converts to object with YYYY-MM keys (populates MonthSection) each
    // containing an array of objects with events, photos, and notes for a
    // single day (populates TimelineContent component).
    const buildSortedEvents = () => {
        // Deep copy so that notes/photos don't duplicate each time this runs
        const formattedEventsCopy = JSON.parse(JSON.stringify(formattedEvents));

        // Add contents of photoUrls to photos key under correct date
        photoUrls.forEach(photo => {
            const dateKey = timestampToDateString(photo.created);
            if (!formattedEventsCopy[dateKey]) {
                formattedEventsCopy[dateKey] = {events: [], notes: [], photos: []};
            }
            formattedEventsCopy[dateKey]['photos'].push(photo);
        });

        // Add note text to notes key under correct date
        notes.forEach(note => {
            const dateKey = timestampToDateString(note.timestamp);
            if (!formattedEventsCopy[dateKey]) {
                formattedEventsCopy[dateKey] = {events: [], notes: [], photos: []};
            }
            formattedEventsCopy[dateKey]['notes'].push(note);
        });

        // Iterate days chronologically and build object with yyyy-mm keys.
        // Each month key contains an object with yyyy-mm-dd keys and day
        // object values (events, notes, and photos keys containing arrays).
        //
        // Month sections are iterated to populate timeline with divider inserted
        // between each month, day objects populate a single row of the timeline.
        const sortedEvents = {};
        Object.keys(formattedEventsCopy).sort().reverse().forEach(timestamp => {
            // Slice YYYY-MM from timestamp, truncate day
            const yearMonth = timestamp.slice(0, 7);

            // Ensure section for yearMonth exists
            if (!sortedEvents[yearMonth]) {
                sortedEvents[yearMonth] = {};
            }

            // Add day object to yearMonth section
            sortedEvents[yearMonth][timestamp] = {
                events: formattedEventsCopy[timestamp]['events'],
                notes: formattedEventsCopy[timestamp]['notes'],
                photos: formattedEventsCopy[timestamp]['photos']
            }
        });

        return sortedEvents;
    };

    // State mapped to render timeline, rebuild when source objects change
    const [sortedEvents, setSortedEvents] = useState({});
    useEffect(() => {
        setSortedEvents(buildSortedEvents());
    }, [notes, photoUrls, formattedEvents]);

    // Build object used to populate quick navigation menu
    // Contains years as keys, list of month numbers as values
    const navigationOptions = {};
    Object.keys(sortedEvents).forEach(yearMonth => {
        const [year, month] = yearMonth.split('-');
        if (!navigationOptions[year]) {
            navigationOptions[year] = [];
        }
        navigationOptions[year].push(month);
    });

    // Contains object with year-month strings (ie 2024-03) as keys, divider
    // elements as values (used form quick navigation scrolling)
    const sectionRefs = useRef({});

    return (
        <div className={clsx(
            'flex flex-col mt-2 mx-4 md:mx-auto p-4 md:p-8 pt-0 md:pt-0',
            'md:w-full md:max-w-screen-md bg-base-200 rounded-2xl'
        )}>
            <Title
                archived={archived}
                quickNavigation={
                    <QuickNavigation
                        navigationOptions={navigationOptions}
                        sectionRefs={sectionRefs}
                    />
                }
            />
            {Object.keys(sortedEvents).length > 0 ? (
                <div className="grid grid-cols-[min-content_1fr] gap-4 md:gap-8">
                    {Object.keys(sortedEvents).map(yearMonth => (
                        <Fragment key={yearMonth}>
                            <MonthSection
                                yearMonth={yearMonth}
                                days={sortedEvents[yearMonth]}
                                sectionRefs={sectionRefs}
                                archived={archived}
                            />
                        </Fragment>
                    ))}
                </div>
            ) : (
                <div className="text-center text-lg p-4">
                    <p>Events created with the buttons above will appear here</p>
                </div>
            )}

            <NoteModal
                plantID={plantID}
                notes={notes}
                setNotes={setNotes}
            />

            <PhotoModal
                plantID={plantID}
                photoUrls={photoUrls}
                setPhotoUrls={setPhotoUrls}
            />

            <DefaultPhotoModal
                plantID={plantID}
                photoUrls={photoUrls}
            />

            <DeletePhotosModal
                plantID={plantID}
                photoUrls={photoUrls}
                setPhotoUrls={setPhotoUrls}
            />
        </div>
    );
});

Timeline.propTypes = {
    plantID: PropTypes.string.isRequired,
    formattedEvents: PropTypes.object.isRequired,
    archived: PropTypes.bool.isRequired
};

export default Timeline;
