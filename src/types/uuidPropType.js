import PropTypes from 'prop-types';
import stringMatchesPattern from './stringMatchesPattern';

// Matches UUID v4: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
export default PropTypes.oneOfType([
    stringMatchesPattern(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
]);
