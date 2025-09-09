import React from 'react';
import PropTypes from 'prop-types';
import { timestampToReadable } from 'src/utils/timestampUtils';
import isoTimestampTzPropType from 'src/types/isoTimestampTzPropType';

// Renders dropdown contents for ManageGroup details section
const GroupDetails = ({ created, location, description }) => {
    if (!location && !description) {
        return <p className="text-center">No details</p>;
    } else {
        return (
            <>
                <p className='flex'>
                    <span className="font-semibold break-keep mr-4">
                        Created:
                    </span>
                    <span className="ml-auto text-right line-clamp-1 break-all">
                        {timestampToReadable(created).split('-')[1].trim()}
                    </span>
                </p>
                {location &&
                    <p className='flex'>
                        <span className="font-semibold break-keep mr-4">
                            Location:
                        </span>
                        <span className="ml-auto text-right line-clamp-1 break-all">
                            {location}
                        </span>
                    </p>
                }
                {description &&
                    <div className='text-center'>
                        <p className="font-semibold mt-3">Description:</p>
                        <p className="text-sm line-clamp-6 break-anywhere">
                            {description}
                        </p>
                    </div>
                }
            </>
        );
    }
};

GroupDetails.propTypes = {
    created: isoTimestampTzPropType.isRequired,
    location: PropTypes.string,
    description: PropTypes.string
};

export default GroupDetails;
