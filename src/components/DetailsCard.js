import React from 'react';
import PropTypes from 'prop-types';
import { openEditModal } from 'src/components/EditModal';

// Shown in dropdown when name in nav bar clicked
const DetailsCard = ({ children }) => {
    return (
        <div className="details-card">
            <div className="card-body text-sm">
                {children}
                <button className="btn btn-sm mt-4" onClick={openEditModal}>
                    Edit
                </button>
            </div>
        </div>
    );
};

DetailsCard.propTypes = {
    children: PropTypes.node.isRequired
};

export default DetailsCard;
