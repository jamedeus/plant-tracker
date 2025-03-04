import React from 'react';
import PropTypes from 'prop-types';
import clsx from 'clsx';

const LoadingAnimation = ({ className }) => {
    return (
        <div className={clsx(
            'h-36 flex flex-col justify-center mx-auto',
            className && className
        )}>
            <span className='loading loading-spinner loading-lg'></span>
        </div>
    )
};

LoadingAnimation.propTypes = {
    className: PropTypes.string
};

export default LoadingAnimation;
