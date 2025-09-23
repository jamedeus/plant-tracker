import React from 'react';
import PropTypes from 'prop-types';
import DetailsRow from './DetailsRow';
import { timestampToReadable } from 'src/utils/timestampUtils';
import isoTimestampTzPropType from 'src/types/isoTimestampTzPropType';

// Renders dropdown contents for PlantCard, ManagePlant details section
const PlantDetails = ({ created, species, pot_size, description }) => (
    <>
        <div className="grid grid-cols-min-max gap-2">
            <DetailsRow
                label="Created"
                value={timestampToReadable(created).split('-')[1]?.trim()}
            />
            {species && <DetailsRow label="Species" value={species} />}
            {pot_size && <DetailsRow label="Pot size" value={pot_size} />}
        </div>
        {description &&
            <p className="text-left mt-2 line-clamp-6 break-anywhere pl-2 -indent-2">
                <span className="font-bold mr-2">Description:</span>
                <span>{description}</span>
            </p>
        }
    </>
);

PlantDetails.propTypes = {
    created: isoTimestampTzPropType.isRequired,
    species: PropTypes.string,
    pot_size: PropTypes.oneOfType([
        PropTypes.string,
        PropTypes.number
    ]),
    description: PropTypes.string
};

export default PlantDetails;
