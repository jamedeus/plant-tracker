import { useEffect } from "react";

// Takes callback function, adds window listener that calls callback when user
// navigates to page by pressing back button
export const useBackButton = (callback) => {
    useEffect(() => {
        const handleBackButton = (event) => {
            if (event.persisted) {
                callback();
            }
        };

        // Add listener on mount, remove on unmount
        window.addEventListener('pageshow', handleBackButton);
        return () => {
            window.removeEventListener('pageshow', handleBackButton);
        };
    }, []);
};
