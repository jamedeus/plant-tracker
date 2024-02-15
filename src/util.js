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

// Takes name of cookie, returns cookie
function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            let cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

// Takes endpoint and POST body, makes backend request, returns response
async function sendPostRequest(url, body) {
    const csrftoken = getCookie('csrftoken');

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

export {
    parseDomContext,
    getCookie,
    sendPostRequest,
    localToUTC,
    timestampToRelative
};
