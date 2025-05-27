import React, { memo } from 'react';
import { FaDroplet } from 'react-icons/fa6';

const WaterIcon = memo(function WaterIcon() {
    return <FaDroplet className="fa-inline mr-2 text-info" />;
});

export default WaterIcon;
