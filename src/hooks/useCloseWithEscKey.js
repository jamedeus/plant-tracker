import { useEffect } from "react";

// Takes callback function, adds window listener that calls callback when user
// navigates to page by pressing back button
export const useCloseWithEscKey = (isOpen, onClose) => {
    useEffect(() => {
        if (!isOpen) {
            return;
        }

        const onKey = (e) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', onKey);

        return () => {
            window.removeEventListener('keydown', onKey);
        };
    }, [isOpen, onClose]);
};
