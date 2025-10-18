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

// Maps last digit to correct ordinal suffix (unless ending in 11, 12, or 13)
const numberSuffixMap = {
    1: 'st',
    2: 'nd',
    3: 'rd'
};

// Takes integer, returns converted to string with correct ordinal suffix
// Examples: 1 -> 1st, 2 -> 2nd, 5 -> 5th, 11 -> 11th, 21 -> 21st, 103 -> 103rd
function intToOrdinal(number) {
    const mod100 = number % 100;
    if (mod100 >= 11 && mod100 <= 13) return `${number}th`;
    return `${number}${numberSuffixMap[number % 10] || 'th'}`;
}

export {
    capitalize,
    pastTense,
    intToOrdinal
};
