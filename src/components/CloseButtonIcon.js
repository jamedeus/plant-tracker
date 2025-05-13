import React, { memo } from 'react';
import { XMarkIcon } from '@heroicons/react/16/solid';

const CloseButtonIcon = memo(function CloseButtonIcon() {
    return <XMarkIcon className="size-8 min-size-8" />;
});

export default CloseButtonIcon;
