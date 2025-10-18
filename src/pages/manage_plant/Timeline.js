import React, { useRef, useState, useLayoutEffect, memo, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { DateTime } from 'luxon';
import { capitalize, pastTense } from 'src/utils/stringUtils';
import { timestampToReadable, timestampToRelativeDays } from 'src/utils/timestampUtils';
import { openNoteModal, openRepotModal, openDivisionModal } from './modals';
import { FaEllipsis, FaPenToSquare } from 'react-icons/fa6';
import { FaCamera } from "react-icons/fa";
import { TrashIcon } from '@heroicons/react/24/solid';
import LazyModal, { useModal } from 'src/components/LazyModal';
import DropdownMenu from 'src/components/DropdownMenu';
import DropdownButton from 'src/components/DropdownButton';
import WaterIcon from 'src/components/WaterIcon';
import FertilizeIcon from 'src/components/FertilizeIcon';
import PruneIcon from 'src/components/PruneIcon';
import RepotIcon from 'src/components/RepotIcon';
import { LuSplit } from "react-icons/lu";
import { TbShovel } from "react-icons/tb";
import { useSelector, useDispatch } from 'react-redux';
import 'src/css/timeline.css';
import {
    photoGalleryOpened,
    photoGalleryIndexChanged,
    deleteModeChanged,
    eventSelected,
    photoSelected,
    noteSelected,
} from './interfaceSlice';
import uuidPropType from 'src/types/uuidPropType';
import dateKeyPropType from 'src/types/dateKeyPropType';
import isoTimestampTzPropType from 'src/types/isoTimestampTzPropType';

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

    const dispatch = useDispatch();

    // Show DeleteModeFooter, close dropdown menu
    const startDeleteMode = () => {
        dispatch(deleteModeChanged({editing: true}));
        document.activeElement.blur();
    };

    // Timeline title ref
    const titleRef = useRef(null);
    // Scrolls page until timeline is aligned with top of page
    // Runs when quick nav menu opened (ensure options are visible)
    const scrollToTimeline = () => titleRef.current.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });

    // Top-right dropdown menu ref
    const menuRef = useRef(null);
    // Scrolls page until all dropdown options are visible (runs when opened)
    const scrollToMenu = () => {
        const rect = menuRef.current.getBoundingClientRect();
        // Only run if bottom of dropdown is outside viewport
        if (rect.bottom >= window.innerHeight) {
            menuRef.current.scrollIntoView({
                behavior: "smooth",
                block: "end"
            });
        }
    };

    const photoModal = useModal();
    const openPhotoModal = useCallback(() => {
        photoModal.open();
        document.activeElement.blur();
    }, [photoModal]);

    return (
        <div
            className={clsx(
                "navbar sticky top-16 scroll-mt-16",
                "bg-base-200 rounded-2xl px-4 z-1"
            )}
            ref={titleRef}
        >
            <div className="w-12">
                {/* Spacer with same width as right side dropdown button */}
            </div>
            <div className="mx-auto my-1">
                {hasNavigationOptions ? (
                    <div
                        className="dropdown dropdown-center"
                        onFocus={scrollToTimeline}
                    >
                        <DropdownButton
                            className="btn btn-ghost text-xl font-bold"
                            title="Timeline quick navigation menu"
                        >
                            History
                        </DropdownButton>
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

            <div className="w-12 dropdown dropdown-end" onFocus={scrollToMenu}>
                {!archived &&
                    <>
                        <DropdownButton
                            className="btn btn-ghost btn-circle size-12"
                            title="More plant actions menu"
                        >
                            <FaEllipsis className="size-6" />
                        </DropdownButton>
                        <DropdownMenu className="scroll-mb-4" menuRef={menuRef}>
                            <li><button onClick={() => openNoteModal()}>
                                <FaPenToSquare className='size-4 mr-2' />
                                Add note
                            </button></li>
                            <li><button onClick={openPhotoModal}>
                                <FaCamera className='size-4 mr-2' />
                                Add photos
                            </button></li>
                            <li><button onClick={openRepotModal}>
                                <TbShovel className='size-5 mr-1' />
                                Repot plant
                            </button></li>
                            <li><button onClick={openDivisionModal}>
                                <LuSplit className='size-4 mr-2 rotate-90' />
                                Divide plant
                            </button></li>
                            {(hasPhotos || hasEvents) &&
                                <li><button onClick={startDeleteMode}>
                                    <TrashIcon className='size-4 mr-2' />
                                    Edit timeline
                                </button></li>
                            }
                        </DropdownMenu>
                    </>
                }
            </div>

            <LazyModal
                ref={photoModal.ref}
                title="Upload Photos"
                ariaLabel="Upload plant photos"
                load={() => import(/* webpackChunkName: "manage_plant_photo-modal" */ "./PhotoModal")}
            />
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
    dateKey: dateKeyPropType.isRequired
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
    dateKey: dateKeyPropType.isRequired
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
    const [selected, setSelected] = useState(false);
    const deleteMode = useSelector((state) => state.interface.deleteMode);

    const dispatch = useDispatch();

    // Add all timestamps to selection when clicked, remove when clicked again
    const handleClick = () => {
        dispatch(eventSelected({
            type: eventType,
            timestamps: timestamps,
            selected: !selected
        }));
        setSelected(!selected);
    };

    // Clear selection when exiting delete mode
    useEffect(() => {
        !deleteMode && setSelected(false);
    }, [deleteMode]);

    return (
        <span
            className={clsx("event-marker", selected && "selected")}
            onClick={deleteMode ? handleClick : null}
            title={timestamps.join('\n')}
        >
            <span className="event-marker-content">
                {eventIconMap[eventType]}
                {pastTense(capitalize(eventType))}
            </span>
        </span>
    );
});

EventMarker.propTypes = {
    eventType: PropTypes.oneOf(Object.keys(eventIconMap)).isRequired,
    timestamps: PropTypes.arrayOf(isoTimestampTzPropType).isRequired
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
                    <Link
                        to={`/manage/${plant.uuid}`}
                        className="plant-link truncate"
                        discover="none"
                    >
                        {plant.name}
                    </Link>
                </div>
            ))}
        </div>
    );
};

DivisionEventMarker.propTypes = {
    dividedPlants: PropTypes.arrayOf(
        PropTypes.exact({
            name: PropTypes.string.isRequired,
            uuid: uuidPropType.isRequired,
        })
    ).isRequired,
};

// Takes parent plant display name and UUID, renders marker with link to parent
const DividedFromMarker = ({ name, uuid, dateKey }) => {
    return (
        <span className="m-2 text-sm md:text-base line-clamp-1">
            <LuSplit className="fa-inline size-4 rotate-90 mr-2" />
            Divided from&nbsp;
            <Link
                to={`/manage/${uuid}?scrollToDate=${dateKey}`}
                className="plant-link"
                discover="none"
            >
                {name}
            </Link>
        </span>
    );
};

DividedFromMarker.propTypes = {
    name: PropTypes.string.isRequired,
    uuid: uuidPropType.isRequired,
    dateKey: dateKeyPropType.isRequired
};

// Takes photo thumbnail URL, creation timestamp, and database key
// Opens fullscreen gallery showing selected photo when clicked
const PhotoThumbnail = memo(function PhotoThumbnail({ thumbnailUrl, timestamp, index, photoKey }) {
    const dispatch = useDispatch();
    const [selected, setSelected] = useState(false);
    const deleteMode = useSelector((state) => state.interface.deleteMode);

    const openGallery = () => {
        dispatch(photoGalleryIndexChanged({index: index}));
        dispatch(photoGalleryOpened({open: true}));
    };

    // Add/remove photo from selection when clicked
    const handleClick = () => {
        dispatch(photoSelected({
            key: photoKey,
            selected: !selected
        }));
        setSelected(!selected);
    };

    // Clear selection when exiting delete mode
    useEffect(() => {
        !deleteMode && setSelected(false);
    }, [deleteMode]);

    return (
        <div
            className={clsx(
                'photo-thumbnail-timeline cursor-pointer',
                selected && 'selected'
            )}
            onClick={deleteMode ? handleClick : openGallery}
            title={timestampToReadable(timestamp)}
        >
            <img
                loading="lazy"
                draggable={false}
                className="photo-thumbnail"
                src={thumbnailUrl}
                alt={timestampToReadable(timestamp)}
            />
        </div>
    );
});

PhotoThumbnail.propTypes = {
    thumbnailUrl: PropTypes.string.isRequired,
    timestamp: isoTimestampTzPropType.isRequired,
    index: PropTypes.number.isRequired,
    photoKey: PropTypes.number.isRequired
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
const NoteCollapse = memo(function NoteCollapse({ text, timestamp }) {
    const dispatch = useDispatch();
    const [selected, setSelected] = useState(false);
    const deleteMode = useSelector((state) => state.interface.deleteMode);

    const toggleSelected = () => {
        dispatch(noteSelected({
            timestamp: timestamp,
            selected: !selected
        }));
        setSelected(!selected);
    };

    const editNote = () => {
        if (!archived && !deleteMode) {
            openNoteModal({ timestamp: timestamp, text: text });
        }
    };

    // Clear selection when exiting delete mode
    useEffect(() => {
        !deleteMode && setSelected(false);
    }, [deleteMode]);

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

    const readableTimestamp = timestampToReadable(timestamp);

    const toggleCollapsed = () => {
        if (!deleteMode && collapsedNoteLines !== 'All') {
            setExpanded(!expanded);
        }
    };

    // Update height when note text edited if expanded
    useEffect(() => {
        /* istanbul ignore else */
        if (textRef.current) {
            expanded && setHeight(textRef.current.scrollHeight + "px");
        }
    }, [text]);

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
                collapse();
            }
        }
    }, [collapsedNoteLines]);

    // User expanded/collapsed note (runs synchronously)
    useLayoutEffect(() => {
        if (expanded) {
            expand();
        } else {
            collapse();
        }
    }, [expanded]);

    return (
        <div
            className={clsx(
                'note-collapse-wrapper',
                selected && 'selected',
                deleteMode && 'cursor-pointer select-none'
            )}
            onClick={deleteMode ? toggleSelected : null}
        >
            <div
                className='note-collapse'
                style={{ maxHeight: height }}
            >
                <FaPenToSquare
                    className={clsx(
                        'fa-inline size-4 mr-2 mt-1',
                        !archived && !deleteMode && 'cursor-pointer'
                    )}
                    onClick={editNote}
                />
                <div
                    className={clsx(
                        collapsedNoteLines !== 'All' && 'cursor-pointer',
                        'overflow-hidden',
                        clamped && clamped
                    )}
                    title={readableTimestamp}
                    ref={textRef}
                    onClick={toggleCollapsed}
                >
                    <span className='note-collapse-text'>
                        {text}
                    </span>
                    <span className='text-xs'>
                        {readableTimestamp.split('-')[0].trim()}
                    </span>
                </div>
            </div>
        </div>
    );
});

NoteCollapse.propTypes = {
    text: PropTypes.string.isRequired,
    timestamp: isoTimestampTzPropType.isRequired
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
                    {Object.entries(contents.events).map(([type, timestamps]) => {
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
                    {Object.values(contents.photos).sort((a, b) => {
                        return a.timestamp.localeCompare(b.timestamp);
                    }).reverse().map((photo) => (
                        <PhotoThumbnail
                            key={photo.key}
                            thumbnailUrl={photo.thumbnail}
                            timestamp={photo.timestamp}
                            index={photos.indexOf(photo)}
                            photoKey={photo.key}
                        />
                    ))}
                </div>
                <div
                    className="flex flex-col"
                    data-testid={`${dateKey}-notes`}
                >
                    {Object.keys(contents.notes).sort().map((timestamp) => (
                        <NoteCollapse
                            key={timestamp}
                            text={contents.notes[timestamp]}
                            timestamp={timestamp}
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
                        dateKey={dateKey}
                    />
                }
            </div>
        </>
    );
});

TimelineDay.propTypes = {
    dateKey: dateKeyPropType.isRequired,
    monthDivider: PropTypes.bool
};

const Timeline = memo(function Timeline() {
    const plantID = useSelector((state) => state.plant.plantDetails.uuid);
    const timelineDays = useSelector((state) => state.timeline.timelineDays);

    // Get array of yyyy-mm-dd keys sorted chronologically (recent first)
    const dayKeys = Object.keys(timelineDays).sort().reverse();

    // Scroll to date specified in qurystring parameter if present
    useEffect(() => {
        const url = new URL(window.location.href);
        const params = url.searchParams;
        const scrollToDate = params.get('scrollToDate');
        if (scrollToDate) {
            const timer = setTimeout(() => {
                const timelineRow = document.querySelector(
                    `[data-date="${scrollToDate}"]`
                );
                timelineRow?.scrollIntoView({
                    behavior: "smooth",
                    block: "start"
                });
                // Remove scrollToDate param from URL after scrolling
                // (should only run once, not when navigating through history)
                url.searchParams.delete("scrollToDate");
                const search = url.searchParams.toString();
                window.history.replaceState(
                    null,
                    "",
                    `${url.pathname}${search ? `?${search}` : ''}${url.hash}`
                );
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [plantID]);

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
