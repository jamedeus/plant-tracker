// Custom PropTypes string regex validator
export default function stringMatchesPattern(regex) {
    return function(props, propName, componentName) {
        if (props[propName] && !regex.test(props[propName])) {
            throw new Error(`${componentName}.${propName} must match ${regex}`);
        }
    };
}
