import React, { useState, useRef } from 'react';
import clsx from 'clsx';

const colorMap = {
    red: 'alert-error',
    blue: 'alert-info',
    green: 'alert-success',
    yellow: 'alert-warning'
};

export let showToast;

export const Toast = () => {
    // State for text and color, default to blue
    const [message, setMessage] = useState(null);
    const [color, setColor] = useState('blue');
    // State to set fade in/out class
    const [fade, setFade] = useState(false);

    // Keep timer reference between showToast calls, used to clear old timer
    // and restart if showToast called again before current timeout expires
    const timerRef = useRef(null);

    // Takes string, color (from colorMap), and timeout milliseconds
    showToast = (message, color, timeout) => {
        // Clear old timer if running
        if (timerRef.current) {
            clearTimeout(timerRef.current);
        }

        // Set color and fade states, then message state (mounts Toast)
        setColor(color);
        setFade(true);
        setMessage(message);

        // Start timer to fade toast out after timeout milliseconds
        timerRef.current = setTimeout(() => {
            hideToast();
        }, timeout);
    };

    const hideToast = () => {
        setFade(false);
        // Wait for fade animation, clear message state (unmounts Toast)
        setTimeout(() => {
            setMessage(null);
        }, 500);
    };

    // Rendered when message state set
    return (message &&
        <div
            className={clsx(
                'toast toast-center transition-opacity duration-500 z-100',
                fade ? 'opacity-100' : 'opacity-0'
            )}
            onClick={hideToast}
        >
            <div className={`alert ${colorMap[color]} gap-0`}>
                <span>{message}</span>
            </div>
        </div>
    );
};
