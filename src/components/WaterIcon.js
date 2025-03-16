import React, { memo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDroplet } from '@fortawesome/free-solid-svg-icons';

const WaterIcon = memo(function WaterIcon() {
    return <FontAwesomeIcon icon={faDroplet} className="mr-2 text-info" />;
});

export default WaterIcon;
