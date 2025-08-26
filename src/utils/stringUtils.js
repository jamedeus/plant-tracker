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

export {
    capitalize,
    pastTense
};
