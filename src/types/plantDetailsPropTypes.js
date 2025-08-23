import PropTypes from 'prop-types';
import uuidPropType from 'src/types/uuidPropType';

export default PropTypes.exact({
    name: PropTypes.string,
    display_name: PropTypes.string.isRequired,
    uuid: uuidPropType.isRequired,
    created: PropTypes.string.isRequired,
    species: PropTypes.string,
    description: PropTypes.string,
    pot_size: PropTypes.number,
    last_watered: PropTypes.string,
    last_fertilized: PropTypes.string,
    thumbnail: PropTypes.string,
    archived: PropTypes.bool.isRequired,
    group: PropTypes.exact({
        name: PropTypes.string.isRequired,
        uuid: uuidPropType.isRequired
    })
});
