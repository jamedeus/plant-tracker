import React, { useRef, useEffect, Fragment } from 'react';
import PropTypes from 'prop-types';
import { DateTime } from 'luxon';
import { timestampToRelative } from 'src/util';
import CollapseCol from 'src/components/CollapseCol';
import EditableNodeList from 'src/components/EditableNodeList';
import PhotoModal, { openPhotoModal } from './PhotoModal';
import DefaultPhotoModal, { openDefaultPhotoModal } from './DefaultPhotoModal';
import { useErrorModal } from 'src/context/ErrorModalContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDroplet, faSeedling, faScissors, faMound } from '@fortawesome/free-solid-svg-icons';

const Timeline = ({ events, photoUrls }) => {
    // Takes timestamp, returns ISO date string (no hours/minutes)
    const timestampToDateString = (timestamp) => {
        return DateTime.fromISO(timestamp).setZone('system').toISO().split('T')[0];
    };

    // Convert to object with date strings as keys, object with events and
    // photos keys as values. Both keys in sub-object contain arrays.
    const formattedEvents = Object.entries(events).reduce(
        (acc, [eventType, eventDates]) => {
            eventDates.forEach(date => {
                const dateKey = timestampToDateString(date);
                // Add new date key unless it already exists
                if (!acc[dateKey]) {
                    acc[dateKey] = {events: [], photos: []};
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
            formattedEvents[dateKey] = {events: [], photos: []};
        }
        formattedEvents[dateKey]['photos'].push(photo);
    });

    // Iterate days chronologically and build array of objects with timestamp,
    // events, and photos keys (each object populates 1 row of timeline)
    const sortedEvents = [];
    Object.keys(formattedEvents).sort().reverse().forEach(timestamp => {
        sortedEvents.push({
            timestamp: timestamp,
            events: formattedEvents[timestamp]['events'],
            photos: formattedEvents[timestamp]['photos']
        });
    });

    // Divide into month increments (dividers rendered between), build object
    // with year-month string (ie 2024-03) keys, array of day objects as values
    const splitEvents = {};
    sortedEvents.forEach(day => {
        // Slice YYYY-MM from timestamp, truncate day
        const yearMonth = day.timestamp.slice(0, 7);
        if (!splitEvents[yearMonth]) {
            splitEvents[yearMonth] = [day];
        } else {
            splitEvents[yearMonth].push(day);
        }
    });

    // Build object used to populate quick navigation menu
    // Contains years as keys, list of month numbers as values
    const navigationOptions = {};
    Object.keys(splitEvents).forEach(yearMonth => {
        const [year, month] = yearMonth.split('-');
        if (!navigationOptions[year]) {
            navigationOptions[year] = [month];
        } else {
            navigationOptions[year].push(month);
        }
    });

    const TimelineDate = ({ timestamp }) => {
        return (
            <div className="flex flex-col whitespace-nowrap text-end">
                <span className="md:text-lg">
                    {timestampToRelative(timestamp, true)}
                </span>
                <span className="hidden md:block text-sm">
                    {DateTime.fromISO(timestamp).toFormat('MMMM dd, yyyy')}
                </span>
            </div>
        );
    };

    TimelineDate.propTypes = {
        timestamp: PropTypes.string
    };

    const TimelineContent = ({ events, photos}) => {
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
                            />
                        );
                    })}
                </div>
            </div>
        );
    };

    TimelineContent.propTypes = {
        events: PropTypes.array,
        photos: PropTypes.array
    };

    const EventMarker = ({ eventType }) => {
        switch(eventType) {
            case('water'):
                return (
                    <span className="m-2 whitespace-nowrap text-sm md:text-base">
                        <FontAwesomeIcon
                            icon={faDroplet}
                            className="mr-2 text-info"
                        />
                        Watered
                    </span>
                );
            case('fertilize'):
                return (
                    <span className="m-2 whitespace-nowrap text-sm md:text-base">
                        <FontAwesomeIcon
                            icon={faSeedling}
                            className="mr-2 text-success"
                        />
                        Fertilized
                    </span>
                );
            case('prune'):
                return (
                    <span className="m-2 whitespace-nowrap text-sm md:text-base">
                        <FontAwesomeIcon
                            icon={faScissors}
                            className="mr-2 text-prune"
                        />
                        Pruned
                    </span>
                );
            case('repot'):
                return (
                    <span className="m-2 whitespace-nowrap text-sm md:text-base">
                        <FontAwesomeIcon
                            icon={faMound}
                            className="mr-2 text-repot"
                        />
                        Repoted
                    </span>
                );
        }
    };

    EventMarker.propTypes = {
        eventType: PropTypes.string
    };

    const PhotoThumbnail = ({ thumbnailUrl, photoUrl }) => {
        return (
            <div className="rounded-xl m-2">
                <a href={photoUrl}>
                    <img
                        className="rounded-lg w-16 h-16 object-cover"
                        src={thumbnailUrl}
                    />
                </a>
            </div>
        );
    };

    PhotoThumbnail.propTypes = {
        thumbnailUrl: PropTypes.string,
        photoUrl: PropTypes.string
    };

    // Takes year-month string (ie 2024-03)
    const MonthDivider = ({ yearMonth }) => {
        return (
            <div
                className="divider col-span-2 mt-4 mb-0 font-bold"
                data-yearmonth={yearMonth}
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
                            <div className="my-auto" data-date={day.timestamp}>
                                <TimelineDate timestamp={day.timestamp} />
                            </div>
                            <div>
                                <TimelineContent
                                    events={day.events}
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
        return (
            <div className="dropdown dropdown-center dropdown-hover mx-auto">
                <div
                    tabIndex={0}
                    role="button"
                    className="btn btn-ghost text-center text-xl font-bold m-1"
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
            const timelineSection = document.querySelector(
                `[data-yearmonth="${yearMonth}"]`
            );
            if (timelineSection) {
                timelineSection.scrollIntoView({
                    behavior: "smooth",
                    block: "center"
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
        <div className="flex flex-col mt-8 px-4 lg:max-w-screen-lg mx-auto w-screen">
            <Title />
            <div className="grid grid-cols-2 grid-cols-[min-content_1fr] gap-4 md:gap-8">
                {Object.keys(splitEvents).map(yearMonth => {
                    return (
                        <Fragment key={yearMonth}>
                            <MonthSection
                                key={yearMonth}
                                yearMonth={yearMonth}
                                days={splitEvents[yearMonth]}
                            />
                        </Fragment>
                    );
                })}
            </div>
        </div>
    );
};

Timeline.propTypes = {
    events: PropTypes.object,
    photoUrls: PropTypes.array
};

export default Timeline;
