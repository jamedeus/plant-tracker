import React from 'react';
import PropTypes from 'prop-types';

const PlantCard = ({ name, uuid }) => {
    return (
        <div
            className="card bg-neutral text-neutral-content mx-auto w-full"
            onClick={() => window.location.href = `/manage/${uuid}`}
        >
            <div className="card-body text-center">
                <h2 className="card-title mx-auto">{name}</h2>
            </div>
        </div>
    );
};

PlantCard.propTypes = {
    name: PropTypes.string,
    uuid: PropTypes.string
};

export default PlantCard;
