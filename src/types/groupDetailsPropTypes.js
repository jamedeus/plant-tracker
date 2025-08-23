import PropTypes from 'prop-types';
import uuidPropType from 'src/types/uuidPropType';

export default PropTypes.exact({
    uuid: uuidPropType.isRequired,
    created: PropTypes.string.isRequired,
    name: PropTypes.string,
    display_name: PropTypes.string.isRequired,
    location: PropTypes.string,
    description: PropTypes.string,
    plants: PropTypes.number.isRequired,
    archived: PropTypes.bool.isRequired,
});
