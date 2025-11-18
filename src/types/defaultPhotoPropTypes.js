import PropTypes from 'prop-types';
import isoTimestampTzPropType from './isoTimestampTzPropType';

export default PropTypes.exact({
    set: PropTypes.bool.isRequired,
    key: PropTypes.number,
    photo: PropTypes.string,
    preview: PropTypes.string,
    thumbnail: PropTypes.string,
    timestamp: isoTimestampTzPropType,
    pending: PropTypes.bool.isRequired
});
