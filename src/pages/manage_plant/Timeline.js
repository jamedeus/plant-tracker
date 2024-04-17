import React, { useState, useRef, Fragment } from 'react';
import PropTypes from 'prop-types';
import { DateTime } from 'luxon';
import { timestampToRelative } from 'src/util';
import CollapseCol from 'src/components/CollapseCol';
import EditableNodeList from 'src/components/EditableNodeList';
import DatetimeInput from 'src/components/DatetimeInput';
import LastEventTime from 'src/components/LastEventTime';
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

    const TimelineContent = ({ events, photos}) => {
        return (
            <div className="flex flex-col bg-neutral rounded-xl p-2 md:p-4">
                <div className="flex flex-row flex-wrap">
                    {events.map((e) => {
                        return <EventMarker eventType={e} />;
                    })}
                </div>
                <div className="flex flex-row flex-wrap">
                    {photos.map((photo) => {
                        return (
                            <PhotoThumbnail
                                thumbnailUrl={photo.thumbnail}
                                photoUrl={photo.image}
                            />
                        );
                    })}
                </div>
            </div>
        );
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
        )
    };

    return (
        <div className="flex flex-col mt-8 px-4 lg:max-w-screen-lg mx-auto w-screen">
            <h1 className="text-xl font-medium text-center mb-4">History</h1>
            <div className="grid grid-cols-2 grid-cols-[min-content_1fr] gap-4 md:gap-8">
                {sortedEvents.map((day) => {
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
            </div>
        </div>
    );
};

Timeline.propTypes = {
    events: PropTypes.object,
    photoUrls: PropTypes.array
};

export default Timeline;
