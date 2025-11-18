import PropTypes from 'prop-types';
import uuidPropType from 'src/types/uuidPropType';
import plantDetailsProptypes from 'src/types/plantDetailsPropTypes';
import photoDetailsProptypes from 'src/types/photoDetailsPropTypes';
import defaultPhotoProptypes from 'src/types/defaultPhotoPropTypes';
import isoTimestampTzPropType from 'src/types/isoTimestampTzPropType';

const stringOrNull = PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.oneOf([null])
]);

const numberOrNull = PropTypes.oneOfType([
    PropTypes.number,
    PropTypes.oneOf([null])
]);

export default PropTypes.exact({
    plant_details: plantDetailsProptypes.isRequired,
    events: PropTypes.exact({
        water: PropTypes.arrayOf(PropTypes.string).isRequired,
        fertilize: PropTypes.arrayOf(PropTypes.string).isRequired,
        prune: PropTypes.arrayOf(PropTypes.string).isRequired,
        repot: PropTypes.arrayOf(PropTypes.string).isRequired,
    }).isRequired,
    notes: PropTypes.objectOf(PropTypes.string).isRequired,
    photos: PropTypes.objectOf(photoDetailsProptypes).isRequired,
    default_photo: defaultPhotoProptypes.isRequired,
    divided_from: PropTypes.exact({
        name: PropTypes.string.isRequired,
        uuid: uuidPropType.isRequired,
        timestamp: isoTimestampTzPropType.isRequired
    }),
    division_events: PropTypes.objectOf(
        PropTypes.arrayOf(
            PropTypes.exact({
                name: PropTypes.string.isRequired,
                uuid: uuidPropType.isRequired,
            })
        )
    ),
    change_events: PropTypes.objectOf(
        PropTypes.exact({
            name_before: stringOrNull,
            name_after: stringOrNull,
            species_before: stringOrNull,
            species_after: stringOrNull,
            description_before: stringOrNull,
            description_after: stringOrNull,
            pot_size_before: numberOrNull,
            pot_size_after: numberOrNull,
            group_before: PropTypes.exact({
                name: PropTypes.string.isRequired,
                uuid: uuidPropType.isRequired,
            }),
            group_after: PropTypes.exact({
                name: PropTypes.string.isRequired,
                uuid: uuidPropType.isRequired,
            })
        })
    ).isRequired
});
