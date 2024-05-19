import Cookies from 'js-cookie';
import { DateTime } from 'luxon';

// Takes name of context element created with json_script django tag
// Parses JSON contents if it exists and returns, otherwise returns null
function parseDomContext(name) {
    const element = document.getElementById(name);
    if (element) {
        return JSON.parse(element.textContent);
    } else {
        return null;
    }
}

// Takes endpoint and POST body, makes backend request, returns response
async function sendPostRequest(url, body) {
    const csrftoken = Cookies.get('csrftoken');

    const response = await fetch(url, {
        method: 'POST',
        body: JSON.stringify(body),
        headers: {
            'Accept': 'application/json, text/plain, */*',
            'Content-Type': 'application/json',
            "X-CSRFToken": csrftoken
        }
    });

    return response;
}

// Takes isoformat timestamp in local timezone, returns as UTC
function localToUTC(timestamp) {
    return String(DateTime.fromISO(timestamp).toUTC());
}

// Takes isoformat timestamp, returns relative time string ("5 minutes ago")
function timestampToRelative(timestamp) {
    return DateTime.fromISO(timestamp).setZone('system').toRelative();
}

// Takes isoformat timestamp, returns relative days string ("3 days ago").
// Unit changes to months if timestamp >30 days old (years if >365 days old).
// Return string does not change until midnight in user's timezone (example: if
// timestamp is 3 days ago at 10am it will NOT change to 4 days ago at 11 am).
function timestampToRelativeCalendar(timestamp) {
    const date = DateTime.fromISO(timestamp).setZone('system');
    const daysDiff = DateTime.now().diff(date, 'days').days;

    if (daysDiff < 30) {
        return date.toRelativeCalendar({unit: 'days'});
    } else {
        return date.toRelative();
    }
}

// Takes isoformat timestamp, converts to user's timezone and returns in more
// readable format (example: "10:14 AM - May 12, 2024")
function timestampToReadable(timestamp) {
    return DateTime.fromISO(timestamp).setZone('system').toFormat(
        'hh:mm a - MMMM d, yyyy'
    );
}

// Takes string, returns with first letter capitalized and all others lowercase
function capitalize(text) {
    return text.charAt(0).toUpperCase() + text.toLowerCase().slice(1);
}

// Takes string, returns with "ed" suffix
function pastTense(text) {
    switch(true) {
        case(text.endsWith("ed")):
            return text;
        case(text.endsWith("e")):
            return `${text}d`;
        default:
            return `${text}ed`;
    }
}

// Custom PropTypes string regex validator
function stringMatchesPattern(regex) {
    return function(props, propName, componentName) {
        if (props[propName] && !regex.test(props[propName])) {
            throw new Error(`${componentName}.${propName} must match ${regex}`);
        }
    };
}

export {
    parseDomContext,
    sendPostRequest,
    localToUTC,
    timestampToRelative,
    timestampToRelativeCalendar,
    timestampToReadable,
    capitalize,
    pastTense,
    stringMatchesPattern
};
