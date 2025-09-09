import React from 'react';
import PropTypes from 'prop-types';
import DetailsRow from './DetailsRow';
import { timestampToReadable } from 'src/utils/timestampUtils';
import isoTimestampTzPropType from 'src/types/isoTimestampTzPropType';

// Renders dropdown contents for PlantCard, ManagePlant details section
const PlantDetails = ({ created, species, pot_size, description }) => {
    if (!species && !pot_size && !description) {
        return <p className="text-center">No details</p>;
    } else {
        return (
            <>
                <div className="grid grid-cols-min-max">
                    <DetailsRow
                        label="Created"
                        value={timestampToReadable(created).split('-')[1].trim()}
                    />
                    {species && <DetailsRow label="Species" value={species} />}
                    {pot_size && <DetailsRow label="Pot size" value={pot_size} />}
                </div>
                {description &&
                    <div className='text-center'>
                        <p className="font-semibold mt-3">Description:</p>
                        <p className="text-sm line-clamp-6 break-anywhere">
                            {description}
                        </p>
                    </div>
                }
            </>
        );
    }
};

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
