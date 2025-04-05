import React, { memo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSeedling } from '@fortawesome/free-solid-svg-icons';

const FertilizeIcon = memo(function FertilizeIcon() {
    return <FontAwesomeIcon icon={faSeedling} className="mr-2 text-success" />;
});

export default FertilizeIcon;
