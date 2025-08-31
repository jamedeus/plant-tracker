import PropTypes from 'prop-types';
import stringMatchesPattern from './stringMatchesPattern';

// Matches ISO 8601 timestamps with no timezone (YYYY-MM-DDTHH:MM:SS)
export default PropTypes.oneOfType([
    stringMatchesPattern(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/)
]);
