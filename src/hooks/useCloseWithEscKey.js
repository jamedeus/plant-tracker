import { useEffect } from "react";

// Takes isOpen (bool) and onClose callback (closes whatever isOpen controls)
// Adds listener when isOpen is true that closes it when escape key is pressed
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
