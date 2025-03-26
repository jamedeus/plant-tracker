import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { parseDomContext } from 'src/util';
import { timestampToUserTimezone } from 'src/timestampUtils';

const TimelineContext = createContext();

export const useTimeline = () => useContext(TimelineContext);

export const TimelineProvider = ({ formattedEvents, children }) => {
    // Load context set by django template
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
        const notes = parseDomContext("notes");
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

    // Takes object with timestamp and text keys, adds to timelineDays state
    const addNewNote = (note) => {
        // YYYY-MM-DD in user timezone
        const dateKey = timestampToDateString(note.timestamp);

        setTimelineDays(oldTimelineDays => {
            const newTimelineDays = { ...oldTimelineDays };
            // Add new timestamp key if missing
            if (!newTimelineDays[dateKey]) {
                newTimelineDays[dateKey] = {
                    events: [],
                    notes: [note],
                    photos: []
                };
            } else {
                newTimelineDays[dateKey] = {
                    ...newTimelineDays[dateKey],
                    notes: [ ...newTimelineDays[dateKey].notes, note ]
                };
            }
            return newTimelineDays;
        });
    };

    // Takes note with same timestamp as existing note (timestamp cannot be
    // changed once created), overwrites text in timelineDays state.
    const editExistingNote = (note) => {
        // YYYY-MM-DD in user timezone
        const dateKey = timestampToDateString(note.timestamp);

        const newNotes = timelineDays[dateKey].notes.map(oldNote => {
            if (oldNote.timestamp === note.timestamp) {
                return {timestamp: note.timestamp, text: note.text};
            } else {
                return oldNote;
            }
        });

        setTimelineDays({ ...timelineDays,
            [dateKey]: { ...timelineDays[dateKey],
                notes: newNotes
            }
        });
    };

    // Takes timestamp of deleted note, removes from timelineDays state
    const deleteNote = (noteTime) => {
        // YYYY-MM-DD in user timezone
        const dateKey = timestampToDateString(noteTime);

        setTimelineDays({ ...timelineDays,
            [dateKey]: { ...timelineDays[dateKey],
                notes: timelineDays[dateKey].notes.filter(
                    note => note.timestamp !== noteTime
                )
            }
        });
    };

    // Takes photo URLs from API response when new photos are uploaded
    const addPhotos = (photos) => {
        const newTimelineDays = { ...timelineDays };

        photos.forEach(photo => {
            const dateKey = timestampToDateString(photo.created);
            // Add new timestamp key if missing
            if (!newTimelineDays[dateKey]) {
                newTimelineDays[dateKey] = {
                    events: [],
                    notes: [],
                    photos: [photo]
                };
            } else {
                // Add photo to photos array for correct day
                const newPhotos = [
                    ...newTimelineDays[dateKey].photos, photo
                ];

                // Add to full state sorted chronologically
                newTimelineDays[dateKey] = {
                    ...newTimelineDays[dateKey],
                    photos: newPhotos.sort((a, b) => {
                        return a.created.localeCompare(b.created);
                    }).reverse()
                };
            }
        });

        // Add new URLs to photoUrl state, sort chronologically (used by
        // DeletePhotoModal and DefaultPhotoModal)
        const newPhotoUrls = photoUrls.concat(photos);
        newPhotoUrls.sort((a, b) => {
            return a.created.localeCompare(b.created);
        }).reverse();
        setPhotoUrls(newPhotoUrls);

        // State used by timeline (broken into days)
        setTimelineDays(newTimelineDays);
    };

    // Takes array of deleted photo keys, removes from photoUrls state and from
    // photos key in correct day of timelineDays state
    const deletePhotos = (deleted) => {
        const newTimelineDays = { ...timelineDays };

        const newPhotoUrls = photoUrls.filter(photo => {
            if (deleted.includes(photo.key)) {
                // Parse YYYY-MM-DD from deleted photo timestamp, find in
                // timelineDays state and remove
                const dateKey = timestampToDateString(photo.created);
                newTimelineDays[dateKey].photos = newTimelineDays[dateKey].photos.filter(
                    photo => !deleted.includes(photo.key)
                );
                // Remove timelineDays day if no content left
                if (!newTimelineDays[dateKey].photos.length &&
                    !newTimelineDays[dateKey].events.length &&
                    !newTimelineDays[dateKey].notes.length
                ) {
                    delete newTimelineDays[dateKey];
                }
                // Return nothing (remove from photoUrls)
            } else {
                return photo;
            }
        });

        setPhotoUrls(newPhotoUrls);
        setTimelineDays(newTimelineDays);
    };

    return (
        <TimelineContext.Provider value={{
            timelineDays,
            sectionRefs,
            addNewNote,
            editExistingNote,
            deleteNote,
            photoUrls,
            setPhotoUrls,
            addPhotos,
            deletePhotos
        }}>
            {children}
        </TimelineContext.Provider>
    );
};

TimelineProvider.propTypes = {
    formattedEvents: PropTypes.object.isRequired,
    children: PropTypes.node
};
