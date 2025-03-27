import { DateTime } from 'luxon';

// Takes isoformat timestamp in local timezone, returns as UTC
function localToUTC(timestamp) {
    return String(DateTime.fromISO(timestamp).toUTC());
}

// Takes isoformat timestamp, returns luxon.DateTime converted to user timezone
function timestampToUserTimezone(timestamp) {
    return DateTime.fromISO(timestamp).setZone('system');
}

// Takes isoformat timestamp, converts to user's timezone and returns in more
// readable format (example: "10:14 AM - May 12, 2024")
function timestampToReadable(timestamp) {
    return timestampToUserTimezone(timestamp).toFormat(
        'hh:mm\u00A0a - MMMM d, yyyy'
    );
}

// Takes isoformat timestamp, returns true if timestamp is on current date in
// user's timezone, otherwise returns false.
//
// Example: 2024-06-05T23:00:00 returns true at any time on 2024-06-05, but
// returns false on 2024-06-06T00:00:00 (less than 24 hours but not same day)
function timestampIsToday(timestamp) {
    const today = DateTime.now().toISODate();
    return timestampToUserTimezone(timestamp).toISODate() === today;
}

// Takes isoformat timestamp, returns true if timestamp is in last 60 seconds.
//
// Example: 2024-06-05T23:00:00 returns true until 2024-06-05T23:01:00
function timestampIsLessThanOneMinuteOld(timestamp) {
    return DateTime.now() - DateTime.fromISO(timestamp) <= 60000;
}


// The functions below convert ISO format timestamps into human-readable
// relative time strings with various formats.
//
// Calendarized relative times will not change until midnight in the user's
// timezone (example: if a 71 hour old timestamp returns "2 days ago" it will
// not change to 3 days after a few hours, even though it is now >72 hours old)
//
// Non-calendarized relative times change based on the absolute amount of time
// that has passed (example: a 47 hour old timestamp will return "1 day ago",
// then an hour later will return "2 days ago" even if its still the same day).


// Takes isoformat timestamp, returns non-calendarized relative time string in
// largest appropriate unit (seconds, minutes, hours, days, months, or years)
function timestampToRelative(timestamp) {
    return timestampToUserTimezone(timestamp).toRelative();
}

// Takes isoformat timestamp, returns calendarized relative time string in days
function timestampToRelativeDays(timestamp) {
    return DateTime.fromISO(
        timestamp
    ).setZone('system').toRelativeCalendar({unit: 'days'});
}

// Takes isoformat timestamp, returns calendarized relative time string in days
// unless timestamp is >30 days old (returns months, or years if >365 days old)
function timestampToRelativeCalendar(timestamp) {
    const date = timestampToUserTimezone(timestamp);
    const daysDiff = DateTime.now().diff(date, 'days').days;

    if (daysDiff < 30) {
        return date.toRelativeCalendar({unit: 'days'});
    } else {
        return date.toRelative();
    }
}

// Takes timestamp, returns ISO date string (YYYY-MM-DD, no hours/minutes) in
// user's timezone
function timestampToDateString (timestamp) {
    return timestampToUserTimezone(timestamp).toISO().split('T')[0];
}

export {
    localToUTC,
    timestampToUserTimezone,
    timestampToReadable,
    timestampIsToday,
    timestampIsLessThanOneMinuteOld,
    timestampToRelative,
    timestampToRelativeDays,
    timestampToRelativeCalendar,
    timestampToDateString
};
