import PropTypes from 'prop-types';

export const pendingPhotoPropType = PropTypes.exact({
    key: PropTypes.number.isRequired,
    photo: PropTypes.string.isRequired,
    preview: PropTypes.oneOf([null]).isRequired,
    thumbnail: PropTypes.oneOf([null]).isRequired,
    timestamp: PropTypes.string.isRequired,
    pending: PropTypes.oneOf([true]).isRequired,
});

export const resolvedPhotoPropType = PropTypes.exact({
    key: PropTypes.number.isRequired,
    photo: PropTypes.string.isRequired,
    preview: PropTypes.string.isRequired,
    thumbnail: PropTypes.string.isRequired,
    timestamp: PropTypes.string.isRequired,
    pending: PropTypes.oneOf([false]).isRequired,
});

export default PropTypes.oneOfType([
    pendingPhotoPropType,
    resolvedPhotoPropType,
]);
