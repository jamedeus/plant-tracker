import React, { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { createPortal } from 'react-dom';
import LoadingAnimation from './LoadingAnimation';
import { XMarkIcon } from '@heroicons/react/24/solid';
import 'src/css/suspense.css';

const SuspenseFullscreen = ({ onClose }) => {
    // Create fullscreen overlay div (fades in when mounted)
    const overlayRef = useRef(document.createElement('div'));
    overlayRef.current.className = 'suspense-overlay';
    overlayRef.current.ariaLabel = 'Loading gallery';
    overlayRef.current.role = 'alert';

    // Render overlay immediately on mount, remove after 250ms on unmount
    useEffect(() => {
        document.body.appendChild(overlayRef.current);

        return () => {
            // Wait for lightbox background to fade in (starts transparent)
            // before removing overlay (fix visual flash)
            const timer = setTimeout(() => {
                document.body.removeChild(overlayRef.current);
            }, 250);
            return () => clearTimeout(timer);
        };
    }, []);

    return createPortal(
        <>
            {onClose && (
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 btn-close"
                    aria-label="Close loading overlay"
                >
                    <XMarkIcon className="size-8 min-size-8" />
                </button>
            )}
            <LoadingAnimation />
        </>,
        overlayRef.current
    );
};

SuspenseFullscreen.propTypes = {
    onClose: PropTypes.func
};

export default SuspenseFullscreen;
