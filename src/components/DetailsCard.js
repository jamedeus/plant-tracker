import React from 'react';
import PropTypes from 'prop-types';
import { openEditModal } from 'src/components/EditModal';

// Shown in dropdown when name in nav bar clicked
const DetailsCard = ({ children }) => {
    return (
        <div className={`card card-compact w-72 p-2 mt-2 mx-auto
                        shadow bg-neutral text-neutral-content`}>
            <div className="card-body">
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
