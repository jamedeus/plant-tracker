import React, { memo } from 'react';
import PropTypes from 'prop-types';
import GroupDetails from 'src/components/GroupDetails';
import InstanceCard from 'src/components/InstanceCard';
import uuidPropType from 'src/types/uuidPropType';
import isoTimestampTzPropType from 'src/types/isoTimestampTzPropType';

const GroupCard = memo(function GroupCard({
    display_name,
    plants,
    uuid,
    created,
    location,
    description,
    archived=false
}) {
    return (
        <InstanceCard
            uuid={uuid}
            title={display_name}
            subtitle={<p>Contains {plants} plants</p>}
            details={
                <GroupDetails
                    created={created}
                    location={location}
                    description={description}
                />
            }
            archived={archived}
        />
    );
});

GroupCard.propTypes = {
    display_name: PropTypes.string.isRequired,
    plants: PropTypes.number.isRequired,
    uuid: uuidPropType.isRequired,
    created: isoTimestampTzPropType.isRequired,
    location: PropTypes.string,
    description: PropTypes.string,
    archived: PropTypes.bool
};

export default GroupCard;
