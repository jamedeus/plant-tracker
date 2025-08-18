import { useEffect, useRef } from 'react';

// Custom debounce hook
// https://designtechworld.medium.com/create-a-custom-debounce-hook-in-react-114f3f245260
const useDebounce = (callback, delay) => {
    const timeoutRef = useRef(null);

    useEffect(() => {
        // Cleanup the previous timeout on re-render
        return () => {
            clearTimeout(timeoutRef.current);
        };
    }, []);

    const debouncedCallback = (...args) => {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
            callback(...args);
        }, delay);
    };

    return debouncedCallback;
};

export default useDebounce;
