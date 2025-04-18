import React from 'react';
import PropTypes from 'prop-types';

// Renders dropdown contents for ManageGroup details section
const GroupDetails = ({ location, description }) => {
    if (!location && !description) {
        return <p className="text-center">No details</p>;
    } else {
        return (
            <>
                {location &&
                    <p className='flex'>
                        <span className="font-semibold break-keep mr-4">
                            Location:
                        </span>
                        <span className="ml-auto text-right line-clamp-1">
                            {location}
                        </span>
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

GroupDetails.propTypes = {
    location: PropTypes.string,
    description: PropTypes.string
};

export default GroupDetails;
