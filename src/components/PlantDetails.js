import React from 'react';
import PropTypes from 'prop-types';

// Renders dropdown contents for PlantCard, ManagePlant details section
const PlantDetails = ({ species, pot_size, description }) => {
    if (!species && !pot_size && !description) {
        return <p className="text-center">No details</p>;
    } else {
        return (
            <>
                <p className={species ? 'flex' : 'hidden'}>
                    <span className="font-semibold">Species:</span>
                    <span className="ml-auto">{species}</span>
                </p>
                <p className={pot_size ? 'flex' : 'hidden'}>
                    <span className="font-semibold">Pot size:</span>
                    <span className="ml-auto">{pot_size}</span>
                </p>
                <div className={description ? 'text-center' : 'hidden'}>
                    <p className="font-semibold mt-3">Description:</p>
                    <p className="text-sm line-clamp-6">{description}</p>
                </div>
            </>
        );
    }
};

PlantDetails.propTypes = {
    species: PropTypes.string,
    pot_size: PropTypes.number,
    description: PropTypes.string
};

export default PlantDetails;
