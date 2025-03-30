import React, { memo } from 'react';
import { XMarkIcon } from '@heroicons/react/16/solid';

const CloseButtonIcon = memo(function CloseButtonIcon() {
    return <XMarkIcon className="w-8 h-8" />;
});

export default CloseButtonIcon;
