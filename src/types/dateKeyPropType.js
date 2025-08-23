import PropTypes from 'prop-types';
import stringMatchesPattern from './stringMatchesPattern';

// Matches YYYY-MM-DD dateKeys used in Timeline component
export default PropTypes.oneOfType([
    stringMatchesPattern(/^\d{4}-\d{2}-\d{2}$/)
]);
