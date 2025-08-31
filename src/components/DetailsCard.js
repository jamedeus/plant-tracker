import React from 'react';
import PropTypes from 'prop-types';

// Shown in dropdown when name in nav bar clicked
const DetailsCard = ({ openEditModal, children }) => {
    return (
        <div className="details-card">
            <div className="card-body text-sm">
                {children}
                <button className="btn h-8 mt-4" onClick={openEditModal}>
                    Edit
                </button>
            </div>
        </div>
    );
};

DetailsCard.propTypes = {
    openEditModal: PropTypes.func.isRequired,
    children: PropTypes.node.isRequired
};

export default DetailsCard;
