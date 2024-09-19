import Cookies from 'js-cookie';

// Takes name of context element created with json_script django tag
// Parses JSON contents if it exists and returns, otherwise returns null
function parseDomContext(name) {
    const element = document.getElementById(name);
    /* istanbul ignore else */
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
    capitalize,
    pastTense,
    stringMatchesPattern
};
