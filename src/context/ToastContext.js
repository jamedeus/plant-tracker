import React, { createContext, useContext, useState, useRef } from 'react';
import PropTypes from 'prop-types';

const colorMap = {
    red: 'alert-error',
    blue: 'alert-info',
    green: 'alert-success',
    yellow: 'alert-warning'
};

const ToastContext = createContext();

export const useToast = () => useContext(ToastContext);

export const ToastProvider = ({ children }) => {
    // State for text and color, default to blue
    const [message, setMessage] = useState(null);
    const [color, setColor] = useState('blue');
    // State to set fade in/out class
    const [fade, setFade] = useState('toast-fade-in');

    // Keep timer reference between showToast calls, used to clear old timer
    // and restart if showToast called again before current timeout expires
    const timerRef = useRef(null);

    // Takes string, color (from colorMap), and timeout milliseconds
    const showToast = (message, color, timeout) => {
        // Clear old timer if running
        if (timerRef.current) {
            clearTimeout(timerRef.current);
        }

        // Set color and fade states, then message state (mounts Toast)
        setColor(color);
        setFade('toast-fade-in');
        setMessage(message);

        // Start timer to fade toast out after timeout milliseconds
        timerRef.current = setTimeout(() => {
            hideToast();
        }, timeout);
    };

    const hideToast = () => {
        setFade('toast-fade-out');
        // Wait for fade animation, clear message state (unmounts Toast)
        setTimeout(() => {
            setMessage(null);
        }, 500);
    };

    // Rendered when message state set
    const Toast = () => {
        return (
            <div className={`toast toast-center ${fade}`} onClick={hideToast}>
                <div className={`alert ${colorMap[color]} gap-0`}>
                    <span>{message}</span>
                </div>
            </div>
        );
    };

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            {message ? <Toast /> : null }
        </ToastContext.Provider>
    );
};

ToastProvider.propTypes = {
    children: PropTypes.node,
};
