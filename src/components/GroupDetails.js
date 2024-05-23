import React from 'react';
import PropTypes from 'prop-types';

// Renders dropdown contents for ManageGroup details section
const GroupDetails = ({ location, description }) => {
    if (!location && !description) {
        return <p className="text-center">No details</p>;
    } else {
        return (
            <>
                <p className={location ? 'flex' : 'hidden'}>
                    <span className="font-semibold">Location:</span>
                    <span className="ml-auto text-right">{location}</span>
                </p>
                <div className={description ? 'text-center' : 'hidden'}>
                    <p className="font-semibold mt-3">Description:</p>
                    <p className="text-sm line-clamp-6">{description}</p>
                </div>
            </>
        );
    }
};

GroupDetails.propTypes = {
    location: PropTypes.string,
    description: PropTypes.string
};

export default GroupDetails;
