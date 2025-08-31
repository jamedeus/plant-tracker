import PropTypes from 'prop-types';

export default PropTypes.exact({
    key: PropTypes.number.isRequired,
    photo: PropTypes.string.isRequired,
    preview: PropTypes.string.isRequired,
    thumbnail: PropTypes.string.isRequired,
    timestamp: PropTypes.string.isRequired,
});
