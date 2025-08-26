// Takes name of context element created with json_script django tag
// Parses JSON contents if it exists and returns, otherwise returns null
export default function parseDomContext(name) {
    const element = document.getElementById(name);
    /* istanbul ignore else */
    if (element) {
        return JSON.parse(element.textContent);
    } else {
        return null;
    }
}
