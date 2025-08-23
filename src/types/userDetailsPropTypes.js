import PropTypes from 'prop-types';

export default PropTypes.shape({
    username: PropTypes.string.isRequired,
    email: PropTypes.string.isRequired,
    email_verified: PropTypes.bool.isRequired,
    first_name: PropTypes.string.isRequired,
    last_name: PropTypes.string.isRequired,
    date_joined: PropTypes.string.isRequired,
});
