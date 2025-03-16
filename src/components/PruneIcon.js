import React, { memo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faScissors } from '@fortawesome/free-solid-svg-icons';

const PruneIcon = memo(function PruneIcon() {
    return <FontAwesomeIcon icon={faScissors} className="mr-2 text-prune" />;
});

export default PruneIcon;
