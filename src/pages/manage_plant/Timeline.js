import React, { useRef, useState, useLayoutEffect, memo, useEffect, Fragment } from 'react';
import PropTypes from 'prop-types';
import clsx from 'clsx';
import { DateTime } from 'luxon';
import { capitalize, pastTense } from 'src/util';
import { timestampToReadable, timestampToRelativeDays } from 'src/timestampUtils';
import { openNoteModal } from './NoteModal';
import { openRepotModal } from './RepotModal';
import { openPhotoModal } from './PhotoModal';
import { openDivisionModal } from './DivisionModal';
import { openDeletePhotosModal, preloadDeletePhotosModal } from './DeletePhotosModal';
import { openEventHistoryModal } from './EventHistoryModal';
import { FaEllipsis, FaPenToSquare } from 'react-icons/fa6';
import DropdownMenu from 'src/components/DropdownMenu';
import WaterIcon from 'src/components/WaterIcon';
import FertilizeIcon from 'src/components/FertilizeIcon';
import PruneIcon from 'src/components/PruneIcon';
import RepotIcon from 'src/components/RepotIcon';
import { LuSplit } from "react-icons/lu";
import { useSelector, useDispatch } from 'react-redux';
import 'src/css/timeline.css';
import { EVENTS_ORDER } from './timelineSlice';
import { photoGalleryOpened, photoGalleryIndexChanged } from './interfaceSlice';

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
    const hasPhotos = useSelector((state) => state.timeline.hasPhotos);
    const hasEvents = useSelector((state) => state.timeline.hasEvents);
    const navigationOptions = useSelector(
        (state) => state.timeline.navigationOptions
    );
    const hasNavigationOptions = Object.keys(navigationOptions).length > 0;

    return (
        <div className="navbar sticky top-16 bg-base-200 rounded-2xl px-4 z-1">
            <div className="justify-start w-12">
                {/* Spacer with same width as .navbar-end button */}
            </div>
            <div className="mx-auto my-1">
                {hasNavigationOptions ? (
                    <div className="dropdown dropdown-center">
                        <div
                            tabIndex={0}
                            role="button"
                            className="btn btn-ghost text-xl font-bold"
                        >
                            History
                        </div>
                        <DropdownMenu className="min-w-44">
                            <QuickNavigation />
                        </DropdownMenu>
                    </div>

                ) : (
                    <div className="flex items-center text-xl font-bold h-12">
                        History
                    </div>
                )}
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
                            className="btn btn-ghost btn-circle size-12"
                            aria-label="More plant actions menu"
                        >
                            <FaEllipsis className="size-6" />
                        </div>
                        <DropdownMenu className="w-40">
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
                                onClick={openDivisionModal}
                            >
                                Divide plant
                            </button></li>
                            {hasPhotos &&
                                <li><button
                                    className="flex justify-end"
                                    onClick={openDeletePhotosModal}
                                >
                                    Delete photos
                                </button></li>
                            }
                            {hasEvents &&
                                <li><button
                                    className="flex justify-end"
                                    onClick={openEventHistoryModal}
                                >
                                    Delete events
                                </button></li>
                            }
                        </DropdownMenu>
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
            <details>
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
    const timelineFullDate = useSelector((state) => state.settings.timelineFullDate);
    const dateString = DateTime.fromISO(dateKey).toFormat('MMM dd, yyyy');
    return (
        <div className="timeline-timestamp" data-date={dateKey}>
            <div className="tooltip" data-tip={dateString}>
                <span className="text-sm md:text-lg">
                    {getRelativeTimeString(dateKey)}
                </span>
            </div>
            <span className={clsx(
                "text-sm",
                timelineFullDate ? "block" : "hidden"
            )}>
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
    water: <WaterIcon />,
    fertilize: <FertilizeIcon />,
    prune: <PruneIcon />,
    repot: <RepotIcon />,
};

// Takes event type string and array of event timestamps
// Renders timeline marker with icon and type text, shows timestamps on hover
const EventMarker = memo(function EventMarker({ eventType, timestamps }) {
    return (
        <span className="event-marker" title={timestamps.join('\n')}>
            {eventIconMap[eventType]}
            {pastTense(capitalize(eventType))}
        </span>
    );
});

EventMarker.propTypes = {
    eventType: PropTypes.oneOf(Object.keys(eventIconMap)).isRequired,
    timestamps: PropTypes.array.isRequired
};

// Takes array of plant objects (name and uuid keys) that were divided from this
// plant on a given day, renders market with bullet point links to each child
const DivisionEventMarker = ({ dividedPlants }) => {
    const hasChildren = dividedPlants.length > 0;

    return (
        <div className="flex flex-col m-2 text-sm md:text-base">
            <span className={clsx(hasChildren && "mb-1")}>
                <LuSplit className="fa-inline size-4 rotate-90 mr-2" />
                {hasChildren ? "Divided into:" : "Divided"}
            </span>
            {[ ...dividedPlants ].sort(
                (a, b) => a.name.localeCompare(
                    b.name,
                    undefined,
                    // Handle numeric suffix (eg 1, 2, 10 - NOT 1, 10, 2)
                    { numeric: true }
                )
            ).map(plant => (
                <div
                    key={plant.uuid}
                    className="flex items-center ml-6 md:ml-7"
                >
                    <span className="bullet-point mr-2"></span>
                    <a
                        href={`/manage/${plant.uuid}`}
                        className="plant-link truncate"
                    >
                        {plant.name}
                    </a>
                </div>
            ))}
        </div>
    );
};

DivisionEventMarker.propTypes = {
    dividedPlants: PropTypes.arrayOf(
        PropTypes.shape({
            name: PropTypes.string.isRequired,
            uuid: PropTypes.string.isRequired,
        })
    ).isRequired,
};

// Takes parent plant display name and UUID, renders marker with link to parent
const DividedFromMarker = ({ name, uuid }) => {
    return (
        <span className="m-2 text-sm md:text-base line-clamp-1">
            <LuSplit className="fa-inline size-4 rotate-90 mr-2" />
            Divided from&nbsp;
            <a href={`/manage/${uuid}`} className="plant-link">
                {name}
            </a>
        </span>
    );
};

DividedFromMarker.propTypes = {
    name: PropTypes.string.isRequired,
    uuid: PropTypes.string.isRequired
};

// Takes photo thumbnail URL, full-resolution URL, and creation timestamp
// Opens fullscreen gallery showing selected photo when clicked
const PhotoThumbnail = memo(function PhotoThumbnail({ thumbnailUrl, timestamp, index }) {
    const dispatch = useDispatch();

    const openGallery = () => {
        dispatch(photoGalleryIndexChanged({index: index}));
        dispatch(photoGalleryOpened({open: true}));
    };

    return (
        <img
            loading="lazy"
            draggable={false}
            className='photo-thumbnail photo-thumbnail-timeline cursor-pointer'
            src={thumbnailUrl}
            alt={timestampToReadable(timestamp)}
            onClick={openGallery}
            title={timestampToReadable(timestamp)}
        />
    );
});

PhotoThumbnail.propTypes = {
    thumbnailUrl: PropTypes.string.isRequired,
    timestamp: PropTypes.string.isRequired,
    index: PropTypes.number.isRequired
};

// Map collapsedNoteLines setting values to correct line clamp class
const clampedLines = {
    1: 'line-clamp-1',
    2: 'line-clamp-2',
    3: 'line-clamp-3',
    4: 'line-clamp-4',
    All: 'line-clamp-none'
};

// Takes note object (timestamp and text keys), renders element with first line
// of text always visible which expands to show full text when clicked
const NoteCollapse = memo(function NoteCollapse({ note }) {
    // Read collapsed note number of visible lines from settings
    // Collapse disabled if setting is 'All'
    const collapsedNoteLines = useSelector(
        (state) => state.settings.collapsedNoteLines
    );

    // Can't edit if plant archived
    const archived = useSelector((state) => state.plant.plantDetails.archived);

    // Default to full height (updated before first frame by useEffect below)
    const [height, setHeight] = useState('fit-content');
    const [expanded, setExpanded] = useState(false);
    const [clamped, setClamped] = useState(clampedLines[collapsedNoteLines]);

    // Used to measure height of expanded note text
    const textRef = useRef(null);

    const readableTimestamp = timestampToReadable(note.timestamp);

    const toggle = () => {
        setExpanded(!expanded);
    };

    // Update height when note text edited if expanded
    useEffect(() => {
        /* istanbul ignore else */
        if (textRef.current) {
            expanded && setHeight(textRef.current.scrollHeight + "px");
        }
    }, [note]);

    // Expand note to full height
    const expand = () => {
        /* istanbul ignore else */
        if (textRef.current) {
            // Transition height to full expanded text height
            setHeight(textRef.current.scrollHeight + "px");
            // Remove line clamp immediately so expand animation can run
            setClamped('line-clamp-none');
        }
    };

    // Collapse note (or update number of visible lines if already collapsed)
    const collapse = () => {
        /* istanbul ignore else */
        if (textRef.current) {
            // Transition height up/down to configured number of lines
            const lineHeight = getComputedStyle(textRef.current).lineHeight;
            const newHeight = parseInt(lineHeight) * collapsedNoteLines;
            setHeight(newHeight + "px");

            // Height increasing: unclamp immediately so animation can run
            if (newHeight > parseInt(height)) {
                setClamped(clampedLines[collapsedNoteLines]);

            // Height decreasing: wait until animation completes before clamping
            } else {
                const timer = setTimeout(() => {
                    setClamped(clampedLines[collapsedNoteLines]);
                }, 300);
                return () => clearTimeout(timer);
            }
        }
    };

    // Setting changed: Update number of visible lines if note is collapsed
    useEffect(() => {
        // Skip if note is expanded
        if (!expanded) {
            if (collapsedNoteLines === 'All') {
                expand();
            } else {
                return collapse();
            }
        }
    }, [collapsedNoteLines]);

    // User expanded/collapsed note (runs synchronously)
    useLayoutEffect(() => {
        if (expanded) {
            expand();
        } else {
            return collapse();
        }
    }, [expanded]);

    return (
        <div
            className='note-collapse'
            style={{ maxHeight: height }}
        >
            <FaPenToSquare
                className={clsx(
                    'fa-inline size-4 mr-2 mt-1',
                    !archived && 'cursor-pointer'
                )}
                onClick={archived ? null : () => openNoteModal(note)}
            />
            <div
                className={clsx(
                    collapsedNoteLines !== 'All' && 'cursor-pointer',
                    'overflow-hidden',
                    clamped && clamped
                )}
                title={readableTimestamp}
                ref={textRef}
                onClick={collapsedNoteLines !== 'All' ? toggle : null}
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
    // Used to get index of each photo so lightbox can be opened
    // I don't think this should cause any extra renders here since timelineDays
    // must change whenever photos change, but haven't tested.
    const photos = useSelector((state) => state.timeline.photos);

    // Convert events from array of objects with type and timestamp keys to
    // object with type keys (no duplicates) containing array of timestamps
    const eventsByType = contents.events.reduce((acc, { type, timestamp }) => {
        acc[type].push(timestamp);
        return acc;
    // Seed accumulator object with type keys in correct order
    }, Object.fromEntries(EVENTS_ORDER.map(type => [type, []])));

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
                    {Object.entries(eventsByType).map(([type, timestamps]) => {
                        if (timestamps.length) {
                            return <EventMarker
                                key={type}
                                eventType={type}
                                timestamps={timestamps}
                            />;
                        }
                    })}
                </div>
                <div
                    className="timeline-day-photos"
                    data-testid={`${dateKey}-photos`}
                >
                    {[...contents.photos].sort((a, b) => {
                        return a.timestamp.localeCompare(b.timestamp);
                    }).reverse().map((photo) => (
                        <PhotoThumbnail
                            key={photo.key}
                            thumbnailUrl={photo.thumbnail}
                            timestamp={photo.timestamp}
                            index={photos.indexOf(photo)}
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
                {contents.dividedInto &&
                    <DivisionEventMarker dividedPlants={contents.dividedInto} />
                }
                {contents.dividedFrom &&
                    <DividedFromMarker
                        name={contents.dividedFrom.name}
                        uuid={contents.dividedFrom.uuid}
                    />
                }
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
        <div className='section max-w-full'>
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
