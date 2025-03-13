import React from 'react';
import PropTypes from 'prop-types';

// Renders dropdown contents for PlantCard, ManagePlant details section
const PlantDetails = ({ species, pot_size, description }) => {
    if (!species && !pot_size && !description) {
        return <p className="text-center">No details</p>;
    } else {
        return (
            <>
                {species &&
                    <p className='flex'>
                        <span className="font-semibold">Species:</span>
                        <span className="ml-auto text-right">{species}</span>
                    </p>
                }
                {pot_size &&
                    <p className='flex'>
                        <span className="font-semibold">Pot size:</span>
                        <span className="ml-auto text-right">{pot_size}</span>
                    </p>
                }
                {description &&
                    <div className='text-center'>
                        <p className="font-semibold mt-3">Description:</p>
                        <p className="text-sm line-clamp-6">{description}</p>
                    </div>
                }
            </>
        );
    }
};

PlantDetails.propTypes = {
    species: PropTypes.string,
    pot_size: PropTypes.oneOfType([
        PropTypes.string,
        PropTypes.number
    ]),
    description: PropTypes.string
};

export default PlantDetails;
