import React from 'react';
import PropTypes from 'prop-types';
import clsx from 'clsx';

const LoadingAnimation = ({ className }) => {
    return (
        <div className={clsx(
            'h-36 flex flex-col justify-center',
            className && className
        )}>
            <span className='loading w-16'></span>
        </div>
    );
};

LoadingAnimation.propTypes = {
    className: PropTypes.string
};

export default LoadingAnimation;
