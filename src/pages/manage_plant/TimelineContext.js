import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { parseDomContext } from 'src/util';
import { timestampToUserTimezone } from 'src/timestampUtils';

const TimelineContext = createContext();

export const useTimeline = () => useContext(TimelineContext);

export const TimelineProvider = ({ formattedEvents, children }) => {
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

    // Contains object with year-month strings (ie 2024-03) as keys, divider
    // elements as values (used form quick navigation scrolling)
    const sectionRefs = useRef({});

    // Merges items from notes and photoUrls states into formattedEvents param
    const buildTimelineDays = () => {
        // Deep copy so that notes/photos don't duplicate each time this runs
        const timelineDays = JSON.parse(JSON.stringify(formattedEvents));

        // Add contents of photoUrls to photos key under correct date
        photoUrls.forEach(photo => {
            const dateKey = timestampToDateString(photo.created);
            if (!timelineDays[dateKey]) {
                timelineDays[dateKey] = {events: [], notes: [], photos: []};
            }
            timelineDays[dateKey]['photos'].push(photo);
        });

        // Add note text to notes key under correct date
        notes.forEach(note => {
            const dateKey = timestampToDateString(note.timestamp);
            if (!timelineDays[dateKey]) {
                timelineDays[dateKey] = {events: [], notes: [], photos: []};
            }
            timelineDays[dateKey]['notes'].push(note);
        });

        return timelineDays;
    };

    // Build state used to render timeline on load (updated by effects below)
    const [timelineDays, setTimelineDays] = useState({});
    useEffect(() => {
        setTimelineDays(buildTimelineDays());
    }, []);

    // Takes 2 arrays, returns True if contents are identical, otherwise False
    const compareEvents = (array1, array2) => {
        return array1.length === array2.length &&
            array1.every((value, index) => value === array2[index]);
    };

    // Update state incrementally when formattedEvents is modified (only render
    // day with new/removed events)
    useEffect(() => {
        setTimelineDays(oldTimelineDays => {
            const newTimelineDays = { ...oldTimelineDays };

            // Copy new events from formattedEvents to timelineDays
            Object.keys(formattedEvents).forEach(timestamp => {
                // Add new timestamp key
                if (!newTimelineDays[timestamp]) {
                    newTimelineDays[timestamp] = {
                        ...formattedEvents[timestamp]
                    };
                // Add new events to existing timestamp key
                } else if (!compareEvents(
                    newTimelineDays[timestamp].events,
                    formattedEvents[timestamp].events
                )) {
                    newTimelineDays[timestamp] = {
                        ...newTimelineDays[timestamp],
                        events: [ ...formattedEvents[timestamp].events ]
                    };
                }
            });

            // Remove events that no longer exist in formattedEvents
            Object.keys(newTimelineDays).forEach(timestamp => {
                if (!Object.keys(formattedEvents).includes(timestamp)) {
                    // Clear events array if not already empty
                    if (newTimelineDays[timestamp].events.length) {
                        newTimelineDays[timestamp].events = [];
                    }
                    // Remove whole day section if no notes or photos
                    if (!newTimelineDays[timestamp].notes.length &&
                        !newTimelineDays[timestamp].photos.length
                    ) {
                        delete newTimelineDays[timestamp];
                    }
                }
            });
            return newTimelineDays;
        });
    }, [formattedEvents]);

    // Update state incrementally when notes state is modified (only render day
    // with new/edited/removed note)
    useEffect(() => {
        setTimelineDays(oldTimelineDays => {
            const newTimelineDays = { ...oldTimelineDays };

            // Copy new events from formattedEvents to timelineDays
            notes.forEach(note => {
                const dateKey = timestampToDateString(note.timestamp);
                // Add new timestamp key
                if (!newTimelineDays[dateKey]) {
                    newTimelineDays[dateKey] = {
                        events: [],
                        notes: [note],
                        photos: []
                    };
                // Add new/edited notes to existing timestamp key
                } else if (!newTimelineDays[dateKey].notes.includes(note)) {
                    newTimelineDays[dateKey] = {
                        ...newTimelineDays[dateKey],
                        notes: [ ...newTimelineDays[dateKey].notes, note ]
                    };
                }
            });

            // Remove notes that no longer exist in notes
            Object.entries(newTimelineDays).forEach(([dateKey, contents]) => {
                contents.notes.forEach(oldNote => {
                    if (!notes.includes(oldNote)) {
                        let newNotes = [ ...newTimelineDays[dateKey].notes ];
                        newNotes.splice(
                            newNotes.indexOf(oldNote),
                            1
                        );
                        newTimelineDays[dateKey].notes = newNotes;
                    }
                });
                // Remove whole day section if no notes, photos, or events
                if (!newTimelineDays[dateKey].notes.length &&
                    !newTimelineDays[dateKey].photos.length &&
                    !newTimelineDays[dateKey].events.length
                ) {
                    delete newTimelineDays[dateKey];
                }
            });
            return newTimelineDays;
        });
    }, [notes]);

    // Update state incrementally when photoUrls state is modified (only render
    // day with new/removed photos)
    useEffect(() => {
        setTimelineDays(oldTimelineDays => {
            const newTimelineDays = { ...oldTimelineDays };

            // Copy new events from formattedEvents to timelineDays
            photoUrls.forEach(photo => {
                const dateKey = timestampToDateString(photo.created);
                // Add new timestamp key
                if (!newTimelineDays[dateKey]) {
                    newTimelineDays[dateKey] = {
                        events: [],
                        notes: [],
                        photos: [photo]
                    };
                // Add new photos to existing timestamp key
                } else if (!newTimelineDays[dateKey].photos.includes(photo)) {
                    newTimelineDays[dateKey] = {
                        ...newTimelineDays[dateKey],
                        photos: [ ...newTimelineDays[dateKey].photos, photo ]
                    };
                }
            });

            // Remove photos that no longer exist in photos
            Object.entries(newTimelineDays).forEach(([dateKey, contents]) => {
                contents.photos.forEach(oldPhoto => {
                    if (!photoUrls.includes(oldPhoto)) {
                        let newPhotos = [ ...newTimelineDays[dateKey].photos ];
                        newPhotos.splice(
                            newPhotos.indexOf(oldPhoto),
                            1
                        );
                        newTimelineDays[dateKey].photos = newPhotos;
                    }
                });
                // Remove whole day section if no notes, photos, or events
                if (!newTimelineDays[dateKey].notes.length &&
                    !newTimelineDays[dateKey].photos.length &&
                    !newTimelineDays[dateKey].events.length
                ) {
                    delete newTimelineDays[dateKey];
                }
            });
            return newTimelineDays;
        });
    }, [photoUrls]);

    return (
        <TimelineContext.Provider value={{
            timelineDays,
            sectionRefs,
            notes,
            setNotes,
            photoUrls,
            setPhotoUrls
        }}>
            {children}
        </TimelineContext.Provider>
    );
};

TimelineProvider.propTypes = {
    formattedEvents: PropTypes.object.isRequired,
    children: PropTypes.node
};
