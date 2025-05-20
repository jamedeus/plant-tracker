import React from 'react';
import LoadingAnimation from './LoadingAnimation';
import 'src/css/suspense.css';

const SuspenseFullscreen = () => {
    return (
        <div
            className='suspense-overlay'
            aria-label="Loading gallery"
            role="alert"
        >
            <LoadingAnimation />
        </div>
    );
};

export default SuspenseFullscreen;
