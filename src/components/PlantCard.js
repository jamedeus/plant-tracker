import React, { memo } from 'react';
import PropTypes from 'prop-types';
import WaterIcon from 'src/components/WaterIcon';
import PlantDetails from 'src/components/PlantDetails';
import InstanceCard from 'src/components/InstanceCard';
import { capitalize } from 'src/utils/stringUtils';
import {
    timestampToRelativeCalendar,
    timestampToReadable
} from 'src/utils/timestampUtils';
import uuidPropType from 'src/types/uuidPropType';
import isoTimestampTzPropType from 'src/types/isoTimestampTzPropType';

const LastWateredSpan = ({ last_watered }) => {
    if (last_watered) {
        return (
            <span
                title={timestampToReadable(last_watered)}
                className='line-clamp-1'
            >
                <WaterIcon />
                {capitalize(timestampToRelativeCalendar(last_watered, true))}
            </span>
        );
    } else {
        return <span>Never watered</span>;
    }
};

LastWateredSpan.propTypes = {
    last_watered: PropTypes.string
};

const PlantCard = memo(function PlantCard({
    display_name,
    uuid,
    created,
    species,
    description,
    pot_size,
    last_watered,
    thumbnail,
    archived=false
}) {
    return (
        <InstanceCard
            thumbnail={thumbnail}
            uuid={uuid}
            title={display_name}
            subtitle={
                <LastWateredSpan last_watered={last_watered} />
            }
            details={
                <PlantDetails
                    created={created}
                    species={species}
                    pot_size={pot_size}
                    description={description}
                />
            }
            archived={archived}
        />
    );
});

PlantCard.propTypes = {
    display_name: PropTypes.string.isRequired,
    uuid: uuidPropType.isRequired,
    created: isoTimestampTzPropType.isRequired,
    species: PropTypes.string,
    description: PropTypes.string,
    pot_size: PropTypes.number,
    last_watered: PropTypes.string,
    thumbnail: PropTypes.string,
    archived: PropTypes.bool
};

export default PlantCard;
