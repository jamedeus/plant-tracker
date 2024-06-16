import React, { useRef, useState, useEffect, Fragment } from 'react';
import PropTypes from 'prop-types';
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

const Timeline = ({ plantID, events }) => {
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

    const TimelineDate = ({ timestamp }) => {
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
    };

    TimelineDate.propTypes = {
        timestamp: PropTypes.string
    };

    const TimelineContent = ({ events, notes, photos}) => {
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
                            />
                        );
                    })}
                </div>
            </div>
        );
    };

    TimelineContent.propTypes = {
        events: PropTypes.array,
        notes: PropTypes.array,
        photos: PropTypes.array
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

    const EventMarker = ({ eventType }) => {
        return (
            <span className="m-2 whitespace-nowrap text-sm md:text-base">
                {eventIconMap[eventType]}
                {pastTense(capitalize(eventType))}
            </span>
        );
    };

    EventMarker.propTypes = {
        eventType: PropTypes.string
    };

    // Photo thumbnail that opens larger popover when clicked
    const PhotoThumbnail = ({ thumbnailUrl, photoUrl, timestamp }) => {
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
    };

    PhotoThumbnail.propTypes = {
        thumbnailUrl: PropTypes.string,
        photoUrl: PropTypes.string,
        timestamp: PropTypes.string
    };

    const NoteCollapse = ({ note }) => {
        const [expanded, setExpanded] = useState(false);

        return (
            <div
                className={`m-2 ${expanded ? '' : `line-clamp-1`}`}
                title={timestampToReadable(note.timestamp)}
            >
                <FontAwesomeIcon
                    icon={faPenToSquare}
                    className="w-4 h-4 mr-2 cursor-pointer"
                    onClick={() => noteModalRef.current.open(note)}
                />
                <span
                    className={'cursor-pointer text-sm md:text-base'}
                    onClick={() => setExpanded(!expanded)}
                >
                    {note.text}
                </span>
            </div>
        );
    };

    NoteCollapse.propTypes = {
        note: PropTypes.shape({
            text: PropTypes.string,
            timestamp: PropTypes.string
        })
    };

    // Takes year-month string (ie 2024-03)
    const MonthDivider = ({ yearMonth }) => {
        return (
            <div
                className="divider col-span-2 mt-4 mb-0 font-bold md:text-lg scroll-mt-20"
                ref={el => sectionRefs.current[yearMonth] = el}
            >
                {DateTime.fromFormat(yearMonth, 'yyyy-MM').toFormat('MMMM yyyy')}
            </div>
        );
    };

    MonthDivider.propTypes = {
        yearMonth: PropTypes.string
    };

    // Takes year-month string (ie 2024-03) and array containing object for
    // each day within month with events/photos. Returns divider with year and
    // month text followed by pairs of divs for each day (populates grid).
    const MonthSection = ({ yearMonth, days }) => {
        return (
            <>
                <MonthDivider yearMonth={yearMonth} />
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
                                />
                            </div>
                        </Fragment>
                    );
                })}
            </>
        );
    };

    MonthSection.propTypes = {
        yearMonth: PropTypes.string,
        days: PropTypes.array
    };

    // History title with dropdown menu (hover) to jump to month/year sections
    const Title = () => {
        const MenuButton = () => {
            return (
                <div tabIndex={0} role="button" className="btn btn-ghost btn-circle">
                    <FontAwesomeIcon icon={faEllipsis} className="w-6 h-6" />
                </div>
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
                    <div className="dropdown dropdown-end">
                        <MenuButton />
                        <ul
                            tabIndex={0}
                            className={`dropdown-content z-[1] menu p-2 shadow
                                        bg-base-300 rounded-box w-40`}
                        >
                            <li className="ml-auto"><a onClick={() => noteModalRef.current.open()}>
                                Add note
                            </a></li>
                            <li className="ml-auto"><a onClick={openPhotoModal}>
                                Add photos
                            </a></li>
                            <li className="ml-auto"><a onClick={openDeletePhotosModal}>
                                Delete photos
                            </a></li>
                            <li className="ml-auto"><a onClick={openEventHistoryModal}>
                                Delete events
                            </a></li>
                        </ul>
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
        navigationOptions: PropTypes.object
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

        useEffect(() => {
            if (detailsRef.current) {
                detailsRef.current.addEventListener('mouseover', open);
                detailsRef.current.addEventListener('mouseout', close);
                return () => {
                    if (detailsRef.current) {
                        detailsRef.current.removeEventListener('mouseover', open);
                        detailsRef.current.removeEventListener('mouseout', close);
                    }
                };
            }
        }, []);

        // Takes year-month string (ie 2024-03), scrolls to timeline section
        const JumpTo = (yearMonth) => {
            const timelineSection = sectionRefs.current[yearMonth];
            if (timelineSection) {
                timelineSection.scrollIntoView({
                    behavior: "smooth",
                    block: "start"
                });
            }
            // Close dropdown after click
            document.activeElement.blur();
        };

        // Converts month number to name string (ie 04 -> April)
        const monthNumToName = (month) => {
            return DateTime.fromFormat(month, 'MM').toFormat('MMMM');
        };

        return (
            <li>
                <details ref={detailsRef}>
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
        year: PropTypes.string,
        months: PropTypes.array
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
    plantID: PropTypes.string,
    events: PropTypes.object
};

export default Timeline;
