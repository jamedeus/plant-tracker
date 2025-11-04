import React from 'react';
import PropTypes from 'prop-types';
import clsx from 'clsx';

const LoadingAnimation = ({ className }) => (
    <span className={clsx('loading w-16', className && className)}></span>
);

LoadingAnimation.propTypes = {
    className: PropTypes.string
};

export default LoadingAnimation;
