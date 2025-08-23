import PropTypes from 'prop-types';

export default PropTypes.exact({
    uuid: PropTypes.string.isRequired,
    created: PropTypes.string.isRequired,
    name: PropTypes.string,
    display_name: PropTypes.string.isRequired,
    location: PropTypes.string,
    description: PropTypes.string,
    plants: PropTypes.number.isRequired,
    archived: PropTypes.bool.isRequired,
});
