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
    const [message, setMessage] = useState('');
    const [color, setColor] = useState('blue');

    const toastRef = useRef();

    // Keep timer reference between showToast calls, allows clearing old timer
    // to prevent new toast being hidden before timeout expires
    let timer;

    // Takes string, color (from colorMap), and timeout milliseconds
    const showToast = (message, color, timeout) => {
        // Clear old timer if running
        clearTimeout(timer);

        // Set color and message, fade toast in
        setColor(color);
        setMessage(message);
        toastRef.current.classList.remove('opacity-0');

        // Start timer to fade toast out after timeout milliseconds
        timer = setTimeout(() => {
            toastRef.current.classList.add('opacity-0');
            setTimeout(500);
        }, timeout);
    };

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            <div
                ref={toastRef}
                className={"toast toast-center opacity-0 transition-all duration-500"}
            >
                <div className={`alert ${colorMap[color]} gap-0`}>
                    <span>{message}</span>
                </div>
            </div>
        </ToastContext.Provider>
    );
};

ToastProvider.propTypes = {
    children: PropTypes.node,
};
