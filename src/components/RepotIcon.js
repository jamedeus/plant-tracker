import React, { memo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMound } from '@fortawesome/free-solid-svg-icons';

const RepotIcon = memo(function RepotIcon() {
    return <FontAwesomeIcon icon={faMound} className="mr-2 text-repot" />;
});

export default RepotIcon;
