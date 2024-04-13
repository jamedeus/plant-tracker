import React from 'react';
import PropTypes from 'prop-types';

// Displays plant options in AddPlantsModal and RemovePlantsModal
const ManagePlantsCard = ({ name }) => {
    return (
        <div className="card bg-neutral text-neutral-content mx-auto w-full">
            <div className="card-body text-center">
                <h2 className="card-title mx-auto">{name}</h2>
            </div>
        </div>
    );
};

ManagePlantsCard.propTypes = {
    name: PropTypes.string
};

export default ManagePlantsCard;
