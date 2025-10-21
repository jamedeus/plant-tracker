import PropTypes from 'prop-types';

export default PropTypes.shape({
    subscribe: PropTypes.func.isRequired,
    getSnapshot: PropTypes.func.isRequired,
    toggle: PropTypes.func.isRequired,
    bulkUnselect: PropTypes.func.isRequired,
});
