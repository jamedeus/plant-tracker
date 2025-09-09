import React from 'react';
import PropTypes from 'prop-types';
import DetailsRow from './DetailsRow';
import { timestampToReadable } from 'src/utils/timestampUtils';
import isoTimestampTzPropType from 'src/types/isoTimestampTzPropType';

// Renders dropdown contents for ManageGroup details section
const GroupDetails = ({ created, location, description }) => {
    if (!location && !description) {
        return <p className="text-center">No details</p>;
    } else {
        return (
            <>
                <div className="grid grid-cols-min-max gap-y-1">
                    <DetailsRow
                        label="Created"
                        value={timestampToReadable(created).split('-')[1].trim()}
                    />
                    {location && <DetailsRow label="Location" value={location} />}
                </div>
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
