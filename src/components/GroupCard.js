import React, { memo } from 'react';
import PropTypes from 'prop-types';
import GroupDetails from 'src/components/GroupDetails';
import InstanceCard from 'src/components/InstanceCard';

const GroupCard = memo(function GroupCard({
    display_name,
    plants,
    uuid,
    location,
    description,
    linkPage=true,
    archived=false
}) {
    return (
        <InstanceCard
            uuid={uuid}
            title={display_name}
            subtitle={<p>Contains {plants} plants</p>}
            details={
                <GroupDetails
                    location={location}
                    description={description}
                />
            }
            linkPage={linkPage}
            archived={archived}
        />
    );
});

GroupCard.propTypes = {
    display_name: PropTypes.string.isRequired,
    plants: PropTypes.number.isRequired,
    uuid: PropTypes.string.isRequired,
    location: PropTypes.string,
    description: PropTypes.string,
    linkPage: PropTypes.bool,
    archived: PropTypes.bool
};

export default GroupCard;
