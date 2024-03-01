import React from 'react';
import PropTypes from 'prop-types';

// Renders dropdown contents for ManageTray details section
const TrayDetails = ({ location, description }) => {
    if (!location && !description) {
        return <p className="text-center">No details</p>;
    } else {
        return (
            <>
                <p className={location ? 'flex' : 'hidden'}>
                    <span className="font-semibold">Location:</span>
                    <span className="ml-auto">{location}</span>
                </p>
                <div className={description ? 'text-center' : 'hidden'}>
                    <p className="font-semibold mt-3">Description:</p>
                    <p className="text-sm line-clamp-6">{description}</p>
                </div>
            </>
        );
    }
};

TrayDetails.propTypes = {
    location: PropTypes.string,
    description: PropTypes.string
};

export default TrayDetails;
