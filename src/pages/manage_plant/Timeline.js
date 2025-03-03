import React, { useRef, useState, Fragment, memo } from 'react';
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
import NoteModal from './NoteModal';
import DefaultPhotoModal from './DefaultPhotoModal';
import { openRepotModal } from './RepotModal';
import PhotoModal, { openPhotoModal } from './PhotoModal';
import DeletePhotosModal, { openDeletePhotosModal } from './DeletePhotosModal';
import { openEventHistoryModal } from './EventHistoryModal';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faDroplet,
    faSeedling,
    faScissors,
    faMound,
    faEllipsis,
    faPenToSquare
} from '@fortawesome/free-solid-svg-icons';

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

const TimelineDate = memo(({ timestamp }) => {
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
    'water': (
        <FontAwesomeIcon icon={faDroplet} className="mr-2 text-info" />
    ),
    'fertilize': (
        <FontAwesomeIcon icon={faSeedling} className="mr-2 text-success" />
    ),
    'prune': (
        <FontAwesomeIcon icon={faScissors} className="mr-2 text-prune" />
    ),
    'repot': (
        <FontAwesomeIcon icon={faMound} className="mr-2 text-repot" />
    ),
};

const EventMarker = memo(({ eventType }) => {
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

const TimelineContent = memo(({ events, notes, photos, archived, noteModalRef }) => {
    return (
        <div className="flex flex-col bg-neutral rounded-xl p-2 md:p-4">
            <div className="flex flex-row flex-wrap">
                {events.map((e) => {
                    return <EventMarker key={e} eventType={e} />;
                })}
            </div>
            <div className="flex flex-row flex-wrap">
                {photos.map((photo) => {
                    return (
                        <PhotoThumbnail
                            key={photo.key}
                            thumbnailUrl={photo.thumbnail}
                            photoUrl={photo.image}
                            timestamp={photo.created}
                        />
                    );
                })}
            </div>
            <div className="flex flex-col">
                {notes.map((note) => {
                    return (
                        <NoteCollapse
                            key={note.timestamp}
                            note={note}
                            archived={archived}
                            noteModalRef={noteModalRef}
                        />
                    );
                })}
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
const PhotoThumbnail = memo(({ thumbnailUrl, photoUrl, timestamp }) => {
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
                    className={`rounded-lg m-2 object-cover w-[4.9rem]
                                h-[4.9rem] md:w-[5.4rem] md:h-[5.4rem]`}
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

const NoteCollapse = memo(({ note, archived, noteModalRef }) => {
    const [expanded, setExpanded] = useState(false);

    const readableTimestamp = timestampToReadable(note.timestamp);

    const editNote = () => {
        noteModalRef.current.open(note);
    };

    return (
        <div className={clsx(
            'm-2 flex flex-row transition-[max-height] duration-500 md:duration-300 ease-in-out',
            expanded ? 'max-h-[600px] md:max-h-[200px]' : 'max-h-6'
        )}>
            <FontAwesomeIcon
                icon={faPenToSquare}
                className={clsx(
                    'w-4 h-4 mr-2 mt-1',
                    archived || 'cursor-pointer'
                )}
                onClick={archived ? null : editNote}
            />
            <div
                className='cursor-pointer overflow-hidden'
                title={readableTimestamp}
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
const MonthDivider = memo(({ yearMonth, sectionRefs }) => {
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
    yearMonth: PropTypes.string.isRequired
};

// Takes year-month string (ie 2024-03) and array containing object for
// each day within month with events/photos. Returns divider with year and
// month text followed by pairs of divs for each day (populates grid).
const MonthSection = memo(({ yearMonth, days, archived, sectionRefs, noteModalRef }) => {
    return (
        <>
            <MonthDivider yearMonth={yearMonth} sectionRefs={sectionRefs} />
            {days.map((day) => {
                return (
                    <Fragment key={day.timestamp}>
                        <div
                            className="scroll-mt-20"
                            data-date={day.timestamp}
                        >
                            <TimelineDate timestamp={day.timestamp} />
                        </div>
                        <div>
                            <TimelineContent
                                events={day.events}
                                notes={day.notes}
                                photos={day.photos}
                                archived={archived}
                                noteModalRef={noteModalRef}
                            />
                        </div>
                    </Fragment>
                );
            })}
        </>
    );
});

MonthSection.propTypes = {
    yearMonth: PropTypes.string.isRequired,
    days: PropTypes.array.isRequired,
    archived: PropTypes.bool.isRequired
};

const Timeline = ({ plantID, events, archived }) => {
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

    // Convert to object with date strings as keys, object with events and
    // photos keys as values. Both keys in sub-object contain arrays.
    const formattedEvents = Object.entries(events).reduce(
        (acc, [eventType, eventDates]) => {
            eventDates.forEach(date => {
                const dateKey = timestampToDateString(date);
                // Add new date key unless it already exists
                if (!acc[dateKey]) {
                    acc[dateKey] = {events: [], notes: [], photos: []};
                }
                // Add event to date key unless same type already exists
                if (!acc[dateKey]['events'].includes(eventType)) {
                    acc[dateKey]['events'].push(eventType);
                }
            });
            return acc;
        },
        {}
    );

    // Add contents of photoUrls to photos key under correct date
    photoUrls.forEach(photo => {
        const dateKey = timestampToDateString(photo.created);
        if (!formattedEvents[dateKey]) {
            formattedEvents[dateKey] = {events: [], notes: [], photos: []};
        }
        formattedEvents[dateKey]['photos'].push(photo);
    });

    // Add note text to notes key under correct date
    notes.forEach(note => {
        const dateKey = timestampToDateString(note.timestamp);
        if (!formattedEvents[dateKey]) {
            formattedEvents[dateKey] = {events: [], notes: [], photos: []};
        }
        formattedEvents[dateKey]['notes'].push(note);
    });

    // Iterate days chronologically and build object with 1 key per month
    // containing array of day objects (timestamp, events, and photos keys).
    //
    // Month sections are iterated to populate timeline with divider inserted
    // between each month, day objects populate a single row of the timeline.
    const sortedEvents = {};
    Object.keys(formattedEvents).sort().reverse().forEach(timestamp => {
        // Slice YYYY-MM from timestamp, truncate day
        const yearMonth = timestamp.slice(0, 7);

        // Build object used to populate 1 day of timeline
        const day = {
            timestamp: timestamp,
            events: formattedEvents[timestamp]['events'],
            notes: formattedEvents[timestamp]['notes'],
            photos: formattedEvents[timestamp]['photos']
        };

        // Add to correct yearMonth section (or create if first day in month)
        if (!sortedEvents[yearMonth]) {
            sortedEvents[yearMonth] = [day];
        } else {
            sortedEvents[yearMonth].push(day);
        }
    });

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

    // Create ref used to open/close NoteModal
    const noteModalRef = useRef(null);

    // History title with dropdown menu (hover) to jump to month/year sections
    const Title = () => {
        const MenuButton = () => {
            return (
                <div tabIndex={0} role="button" className="btn btn-ghost btn-circle">
                    <FontAwesomeIcon icon={faEllipsis} className="w-6 h-6" />
                </div>
            );
        };

        const MenuOptions = () => {
            return (
                <ul
                    tabIndex={0}
                    className={`dropdown-content z-[1] menu p-2 shadow
                                bg-base-300 rounded-box w-40`}
                >
                    <li><a
                        className="flex justify-end"
                        onClick={() => noteModalRef.current.open()}
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
            );
        };

        return (
            <div className="navbar bg-base-200 rounded-2xl">
                <div className="navbar-start w-auto invisible">
                    <MenuButton />
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
                        <ul
                            tabIndex={0}
                            className={`dropdown-content z-[1] menu p-2 shadow
                                        bg-base-300 rounded-box w-44`}
                        >
                            <QuickNavigation navigationOptions={navigationOptions} />
                        </ul>
                    </div>
                </div>

                <div className="navbar-end w-auto">
                    <div className={clsx(
                        'dropdown dropdown-end',
                        archived && 'invisible'
                    )}>
                        <MenuButton />
                        {!archived && (
                            <MenuOptions />
                        )}
                    </div>
                </div>
            </div>
        );
    };

    const QuickNavigation = ({ navigationOptions }) => {
        return (
            <>
                {Object.keys(navigationOptions).reverse().map(year => {
                    return (
                        <QuickNavigationYear
                            key={year}
                            year={year}
                            months={navigationOptions[year]}
                        />
                    );
                })}
            </>
        );
    };

    QuickNavigation.propTypes = {
        navigationOptions: PropTypes.object.isRequired
    };

    // Takes year (string) and array of months (numbers not string) with events
    // Returns dropdown item with year which expands on hover to show sub-menu
    // of clickable months that jump to the matching timeline section
    const QuickNavigationYear = ({year, months}) => {
        // Create ref used to open sub-menu on hover
        const detailsRef = useRef(null);

        const open = () => {
            detailsRef.current.open = true;
        };

        const close = () => {
            detailsRef.current.open = false;
        };

        // Takes year-month string (ie 2024-03), scrolls to timeline section
        const JumpTo = (yearMonth) => {
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
                        {months.map(month => {
                            return (
                                <li key={month}>
                                    <a onClick={() => JumpTo(`${year}-${month}`)}>
                                        {monthNumToName(month)}
                                    </a>
                                </li>
                            );
                        })}
                    </ul>
                </details>
            </li>
        );
    };

    QuickNavigationYear.propTypes = {
        year: PropTypes.string.isRequired,
        months: PropTypes.array.isRequired
    };

    return (
        <div className={`flex flex-col mt-2 mx-4 md:mx-auto p-4 md:p-8 pt-0 md:pt-0
                        md:w-full md:max-w-screen-md bg-base-200 rounded-2xl`}
        >
            <Title />
            {Object.keys(sortedEvents).length > 0 ? (
                <div className="grid grid-cols-2 grid-cols-[min-content_1fr] gap-4 md:gap-8">
                    {Object.keys(sortedEvents).map(yearMonth => (
                        <Fragment key={yearMonth}>
                            <MonthSection
                                yearMonth={yearMonth}
                                days={sortedEvents[yearMonth]}
                                archived={archived}
                                sectionRefs={sectionRefs}
                                noteModalRef={noteModalRef}
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
                ref={noteModalRef}
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
};

Timeline.propTypes = {
    plantID: PropTypes.string.isRequired,
    events: PropTypes.object.isRequired,
    archived: PropTypes.bool.isRequired
};

export default Timeline;
