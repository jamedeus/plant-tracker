import React, { memo } from 'react';
import { FaScissors } from 'react-icons/fa6';

const PruneIcon = memo(function PruneIcon() {
    return <FaScissors className="fa-inline mr-2 text-prune" />;
});

export default PruneIcon;
