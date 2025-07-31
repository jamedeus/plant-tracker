import React, { useState, useRef, useLayoutEffect } from 'react';
import clsx from 'clsx';

const colorMap = {
    red: 'bg-error',
    blue: 'bg-info',
    green: 'bg-success',
    yellow: 'bg-warning'
};

export let showToast, hideToast;

export const Toast = () => {
    // State for text and color, default to blue
    const [message, setMessage] = useState(null);
    const [color, setColor] = useState('blue');
    // State to set fade in/out class
    const [fade, setFade] = useState(false);
    // Used to open popover when shown (promote to top layer)
    const popoverRef = useRef(null);

    // Keep timer reference between showToast calls, used to clear old timer
    // and restart if showToast called again before current timeout expires
    const timerRef = useRef(null);

    // Takes string, color (from colorMap), and timeout milliseconds
    showToast = (message, color, timeout) => {
        // Clear old timer if running
        clearTimeout(timerRef.current);

        // Set color and fade states, then message state (mounts Toast)
        setColor(color);
        setFade(true);
        setMessage(message);

        // Start timer to fade toast out after timeout milliseconds
        timerRef.current = setTimeout(hideToast, timeout);
    };

    // Promote to top layer (same as modal <dialog> elements)
    // Prevents modal backdrop covering toast and reducing readability
    useLayoutEffect(() => {
        if (message) popoverRef.current?.showPopover();
    }, [message]);

    hideToast = () => {
        setFade(false);
        // Wait for fade animation, clear message state (unmounts Toast)
        setTimeout(() => {
            popoverRef.current?.hidePopover();
            setMessage(null);
        }, 500);
    };

    // Rendered when message state set
    return (message &&
        <div
            ref={popoverRef}
            popover="manual"
            role="status"
            className={clsx(
                'toast duration-500',
                fade ? 'opacity-100' : 'opacity-0'
            )}
        >
            <span className={colorMap[color]} onClick={hideToast}>
                {message}
            </span>
        </div>
    );
};
