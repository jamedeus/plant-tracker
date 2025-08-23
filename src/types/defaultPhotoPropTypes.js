import PropTypes from 'prop-types';

export default PropTypes.exact({
    set: PropTypes.bool.isRequired,
    key: PropTypes.number,
    photo: PropTypes.string,
    preview: PropTypes.string,
    thumbnail: PropTypes.string,
    timestamp: PropTypes.string,
});
