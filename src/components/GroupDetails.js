import React from 'react';
import PropTypes from 'prop-types';
import DetailsRow from './DetailsRow';
import { timestampToReadable } from 'src/utils/timestampUtils';
import isoTimestampTzPropType from 'src/types/isoTimestampTzPropType';

// Renders dropdown contents for ManageGroup details section
const GroupDetails = ({ created, location, description }) => (
    <>
        <div className="grid grid-cols-min-max gap-2">
            <DetailsRow
                label="Created"
                value={timestampToReadable(created).split('-')[1]?.trim()}
            />
            {location && <DetailsRow label="Location" value={location} />}
        </div>
        {description &&
            <p className="text-left mt-2 line-clamp-6 break-anywhere pl-2 -indent-2">
                <span className="font-bold mr-2">Description:</span>
                <span>{description}</span>
            </p>
        }
    </>
);

GroupDetails.propTypes = {
    created: isoTimestampTzPropType.isRequired,
    location: PropTypes.string,
    description: PropTypes.string
};

export default GroupDetails;
