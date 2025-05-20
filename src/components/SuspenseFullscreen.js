import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import LoadingAnimation from './LoadingAnimation';
import 'src/css/suspense.css';

const SuspenseFullscreen = () => {
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

    return createPortal(<LoadingAnimation />, overlayRef.current);
};

export default SuspenseFullscreen;
